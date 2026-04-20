package com.hagbad.springbootbackend.group;

import com.hagbad.springbootbackend.config.AppProperties;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.groupmember.GroupMemberEntity;
import com.hagbad.springbootbackend.groupmember.GroupMemberRepository;
import com.hagbad.springbootbackend.groupmember.GroupMemberResponse;
import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

@Service
public class GroupService {

    private static final Set<String> ALLOWED_IMAGE_EXTENSIONS = Set.of(".jpg", ".jpeg", ".png", ".webp", ".gif");
    private static final long MAX_GROUP_IMAGE_BYTES = 5L * 1024L * 1024L;

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final Path filesRoot;
    private final Path groupProfileDir;
    private final Path groupCoverDir;

    public GroupService(
        GroupRepository groupRepository,
        GroupMemberRepository groupMemberRepository,
        AppProperties properties
    ) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.filesRoot = properties.resolveFilesRoot();
        this.groupProfileDir = filesRoot.resolve("groups").resolve("profile");
        this.groupCoverDir = filesRoot.resolve("groups").resolve("cover");
    }

    public List<GroupResponse> listGroups(
        CurrentUser currentUser,
        boolean mine,
        boolean explore,
        String search,
        String role,
        boolean managed,
        int page,
        int size
    ) {
        if (mine && explore) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use either mine or explore, not both");
        }
        if (page < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page must be at least 1");
        }
        if (size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "size must be between 1 and 100");
        }

        GroupMemberRole parsedRole = parseMemberRole(role);
        if (parsedRole != null && !mine) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Role filter is only available for my groups");
        }
        if (managed && !mine) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Managed filter is only available for my groups");
        }

        return groupRepository.listGroups(
            currentUser.id(),
            mine,
            explore,
            search,
            parsedRole,
            managed,
            page,
            size
        ).stream().map(GroupResponse::from).toList();
    }

    public GroupResponse getGroup(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireAccess(group, currentUser.id());
        return GroupResponse.from(group);
    }

    @Transactional
    public GroupResponse createGroup(
        CurrentUser currentUser,
        String name,
        String description,
        String privacy,
        boolean visible,
        MultipartFile groupImage,
        MultipartFile coverImage
    ) {
        String cleanName = normalizeName(name);
        if (groupRepository.existsByName(cleanName)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group name already exists");
        }

        List<String> savedPaths = new ArrayList<>();
        try {
            GroupEntity group = groupRepository.insert(
                cleanName,
                normalizeOptionalText(description),
                parsePrivacy(privacy, true),
                visible,
                currentUser.id()
            );

            groupMemberRepository.insert(group.getId(), currentUser.id(), GroupMemberRole.admin);

            if (hasUpload(groupImage)) {
                group.setGroupImage(saveGroupMedia(group.getId(), groupImage, "profile", null));
                savedPaths.add(group.getGroupImage());
            }

            if (hasUpload(coverImage)) {
                group.setCoverImage(saveGroupMedia(group.getId(), coverImage, "cover", null));
                savedPaths.add(group.getCoverImage());
            }

            if (!savedPaths.isEmpty()) {
                groupRepository.update(group);
            }

            return GroupResponse.from(requireGroup(group.getId()));
        } catch (DataIntegrityViolationException ex) {
            savedPaths.forEach(this::deleteGroupMedia);
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group name already exists");
        } catch (RuntimeException ex) {
            savedPaths.forEach(this::deleteGroupMedia);
            throw ex;
        }
    }

    @Transactional
    public GroupResponse updateGroup(
        Integer groupId,
        CurrentUser currentUser,
        String name,
        String description,
        String privacy,
        Boolean visible,
        String statusValue,
        MultipartFile groupImage,
        MultipartFile coverImage,
        boolean removeGroupImage,
        boolean removeCoverImage
    ) {
        GroupEntity group = requireGroup(groupId);
        GroupMemberEntity membership = groupMemberRepository.findMembership(groupId, currentUser.id()).orElse(null);
        GroupMemberRole membershipRole = membership == null ? null : membership.getRole();
        boolean creatorAccess = group.getCreatedBy().equals(currentUser.id());
        boolean adminAccess = creatorAccess || membershipRole == GroupMemberRole.admin;
        boolean moderatorAccess = membershipRole == GroupMemberRole.moderator;

        if (!(adminAccess || moderatorAccess)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }

        if (name != null && !adminAccess) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only group admins can change the group name");
        }
        if (privacy != null && !adminAccess) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only group admins can change privacy");
        }
        if (visible != null && !adminAccess) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only group admins can change visibility");
        }
        if (statusValue != null && !adminAccess) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only group admins can change group status");
        }
        if ((removeGroupImage || hasUpload(groupImage)) && !adminAccess) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only group admins can update the group photo");
        }
        if ((removeCoverImage || hasUpload(coverImage)) && !(adminAccess || moderatorAccess)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only admins or moderators can update the cover photo");
        }

        if (name != null) {
            String cleanName = normalizeName(name);
            if (groupRepository.existsByNameExcludingId(cleanName, groupId)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Group name already exists");
            }
            group.setName(cleanName);
        }
        if (description != null) {
            group.setDescription(normalizeOptionalText(description));
        }
        if (privacy != null) {
            GroupPrivacy parsedPrivacy = parsePrivacy(privacy, false);
            if (parsedPrivacy != null) {
                group.setPrivacy(parsedPrivacy);
            }
        }
        if (statusValue != null) {
            GroupStatus parsedStatus = parseStatus(statusValue);
            if (parsedStatus != null) {
                group.setStatus(parsedStatus);
            }
        }
        if (visible != null) {
            group.setVisible(visible);
        }

        if (removeGroupImage) {
            deleteGroupMedia(group.getGroupImage());
            group.setGroupImage(null);
        }
        if (removeCoverImage) {
            deleteGroupMedia(group.getCoverImage());
            group.setCoverImage(null);
        }
        if (hasUpload(groupImage)) {
            group.setGroupImage(saveGroupMedia(group.getId(), groupImage, "profile", group.getGroupImage()));
        }
        if (hasUpload(coverImage)) {
            group.setCoverImage(saveGroupMedia(group.getId(), coverImage, "cover", group.getCoverImage()));
        }

        try {
            groupRepository.update(group);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group name already exists");
        }
        return GroupResponse.from(requireGroup(groupId));
    }

    @Transactional
    public GroupMemberResponse joinGroup(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group is not active");
        }
        if (group.getPrivacy() != GroupPrivacy.public_group) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only public groups can be joined directly");
        }
        if (groupMemberRepository.findMembership(groupId, currentUser.id()).isPresent()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You are already a member of this group");
        }

        try {
            GroupMemberEntity member = groupMemberRepository.insert(groupId, currentUser.id(), GroupMemberRole.member);
            return GroupMemberResponse.from(
                groupMemberRepository.findByIdWithProfile(member.getId()).orElse(member)
            );
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Could not join this group");
        }
    }

    @Transactional
    public GroupResponse closeGroup(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireCreator(group, currentUser.id());
        if (group.getStatus() == GroupStatus.closed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group already closed");
        }
        group.setStatus(GroupStatus.closed);
        groupRepository.update(group);
        return GroupResponse.from(requireGroup(groupId));
    }

    @Transactional
    public void deleteGroup(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireCreator(group, currentUser.id());
        groupRepository.deleteGroupWithDependencies(groupId);
        deleteGroupMedia(group.getGroupImage());
        deleteGroupMedia(group.getCoverImage());
    }

    public GroupEntity requireGroup(Integer groupId) {
        return groupRepository.findById(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    public void requireAccess(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)) {
            return;
        }
        if (groupMemberRepository.findMembership(group.getId(), userId).isPresent()) {
            return;
        }
        if (group.getPrivacy() == GroupPrivacy.public_group && group.isVisible()) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
    }

    private void requireCreator(GroupEntity group, Integer userId) {
        if (!group.getCreatedBy().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
    }

    private String normalizeName(String name) {
        String value = name == null ? "" : name.trim();
        if (value.length() < 2) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Name must be at least 2 characters");
        }
        return value;
    }

    private String normalizeOptionalText(String value) {
        String trimmed = value == null ? "" : value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private GroupPrivacy parsePrivacy(String value, boolean required) {
        String raw = value == null ? "" : value.trim().toLowerCase();
        if (raw.isEmpty()) {
            return required ? GroupPrivacy.public_group : null;
        }
        if ("public".equals(raw)) {
            return GroupPrivacy.public_group;
        }
        if ("private".equals(raw)) {
            return GroupPrivacy.private_group;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Privacy must be public or private");
    }

    private GroupStatus parseStatus(String value) {
        String raw = value == null ? "" : value.trim().toLowerCase();
        if (raw.isEmpty()) {
            return null;
        }
        if ("active".equals(raw)) {
            return GroupStatus.active;
        }
        if ("closed".equals(raw)) {
            return GroupStatus.closed;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Status must be active or closed");
    }

    private GroupMemberRole parseMemberRole(String value) {
        String raw = value == null ? "" : value.trim().toLowerCase();
        if (raw.isEmpty() || "all".equals(raw)) {
            return null;
        }
        if ("admin".equals(raw)) {
            return GroupMemberRole.admin;
        }
        if ("moderator".equals(raw)) {
            return GroupMemberRole.moderator;
        }
        if ("member".equals(raw)) {
            return GroupMemberRole.member;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Role must be admin, moderator, or member");
    }

    private boolean hasUpload(MultipartFile file) {
        return file != null && !file.isEmpty() && StringUtils.hasText(file.getOriginalFilename());
    }

    private String saveGroupMedia(Integer groupId, MultipartFile upload, String mediaKind, String existingPath) {
        byte[] data;
        try {
            Files.createDirectories(groupProfileDir);
            Files.createDirectories(groupCoverDir);
            data = upload.getBytes();
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store group image");
        }

        if (data.length == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Uploaded group image is empty");
        }
        if (data.length > MAX_GROUP_IMAGE_BYTES) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group image must be 5 MB or smaller");
        }

        String suffix = normalizeImageExtension(upload);
        Path folder = "profile".equals(mediaKind) ? groupProfileDir : groupCoverDir;
        Path destination = folder.resolve(groupId + suffix);
        String newPath = "profile".equals(mediaKind)
            ? "/files/groups/profile/" + destination.getFileName()
            : "/files/groups/cover/" + destination.getFileName();

        if (StringUtils.hasText(existingPath) && !existingPath.equals(newPath)) {
            deleteGroupMedia(existingPath);
        }

        try {
            Files.write(destination, data);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not store group image");
        }
        return newPath;
    }

    private String normalizeImageExtension(MultipartFile upload) {
        String filename = upload.getOriginalFilename();
        String suffix = "";
        if (StringUtils.hasText(filename) && filename.contains(".")) {
            suffix = filename.substring(filename.lastIndexOf(".")).toLowerCase();
        }

        if (".jpeg".equals(suffix)) {
            suffix = ".jpg";
        }
        if (!StringUtils.hasText(suffix)) {
            String contentType = upload.getContentType() == null ? "" : upload.getContentType().toLowerCase();
            if ("image/jpeg".equals(contentType)) {
                suffix = ".jpg";
            } else if ("image/png".equals(contentType)) {
                suffix = ".png";
            } else if ("image/webp".equals(contentType)) {
                suffix = ".webp";
            } else if ("image/gif".equals(contentType)) {
                suffix = ".gif";
            }
        }
        if (!ALLOWED_IMAGE_EXTENSIONS.contains(suffix)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group image must be JPG, PNG, WEBP, or GIF");
        }
        return suffix;
    }

    private void deleteGroupMedia(String pathValue) {
        if (!StringUtils.hasText(pathValue)) {
            return;
        }
        if (!pathValue.startsWith("/files/groups/profile/") && !pathValue.startsWith("/files/groups/cover/")) {
            return;
        }
        Path target = filesRoot.resolve(pathValue.replaceFirst("^/files/", ""));
        try {
            Files.deleteIfExists(target);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not remove group image");
        }
    }
}
