package com.hagbad.springbootbackend.invite;

import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupJpaRepository;
import com.hagbad.springbootbackend.group.GroupPrivacy;
import com.hagbad.springbootbackend.group.GroupStatus;
import com.hagbad.springbootbackend.groupmember.GroupMemberEntity;
import com.hagbad.springbootbackend.groupmember.GroupMemberJpaRepository;
import com.hagbad.springbootbackend.groupmember.GroupMemberResponse;
import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import com.hagbad.springbootbackend.security.CurrentUser;
import com.hagbad.springbootbackend.user.UserEntity;
import com.hagbad.springbootbackend.user.UserJpaRepository;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class InviteService {

    private final InviteRepository inviteRepository;
    private final GroupJpaRepository groupJpaRepository;
    private final GroupMemberJpaRepository groupMemberJpaRepository;
    private final UserJpaRepository userJpaRepository;
    private final SecureRandom secureRandom = new SecureRandom();

    public InviteService(
        InviteRepository inviteRepository,
        GroupJpaRepository groupJpaRepository,
        GroupMemberJpaRepository groupMemberJpaRepository,
        UserJpaRepository userJpaRepository
    ) {
        this.inviteRepository = inviteRepository;
        this.groupJpaRepository = groupJpaRepository;
        this.groupMemberJpaRepository = groupMemberJpaRepository;
        this.userJpaRepository = userJpaRepository;
    }

    @Transactional
    public InviteResponse create(InviteCreateRequest request, CurrentUser currentUser) {
        Integer groupId = requiredGroupId(request.groupId());
        GroupEntity group = requireGroup(groupId);
        requireCreatorAdminOrModerator(group, currentUser.id());

        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group is not active");
        }
        if (group.getPrivacy() != GroupPrivacy.private_group || group.isVisible()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invite codes are only available for hidden private groups");
        }

        OffsetDateTime expiresAt = request.expiresAt();
        if (expiresAt != null && expiresAt.isBefore(nowUtc().plusNanos(1))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "expires_at must be in the future");
        }

        boolean hasActiveInvite = inviteRepository.findByGroupIdAndUsedFalse(groupId).stream()
            .anyMatch(invite -> invite.getExpiresAt() == null || invite.getExpiresAt().isAfter(nowUtc()));
        if (hasActiveInvite) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Deactivate the current active code before generating a new one");
        }

        for (int i = 0; i < 5; i += 1) {
            try {
                InviteEntity invite = new InviteEntity();
                invite.setGroupId(groupId);
                invite.setCreatedBy(currentUser.id());
                invite.setCode(generateCode());
                invite.setExpiresAt(expiresAt);
                invite.setUsed(false);
                return InviteResponse.from(inviteRepository.save(invite));
            } catch (Exception ex) {
                // try another code if a uniqueness conflict happened
            }
        }

        throw new ApiException(HttpStatus.BAD_REQUEST, "Could not generate unique invite code");
    }

    public List<InviteResponse> list(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireCreatorAdminOrModerator(group, currentUser.id());
        return inviteRepository.findByGroupIdOrderByCreatedAtDesc(groupId).stream().map(InviteResponse::from).toList();
    }

    @Transactional
    public GroupMemberResponse redeem(InviteRedeemRequest request, CurrentUser currentUser) {
        if (request.code() == null || request.code().trim().isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "code is required");
        }
        InviteEntity invite = inviteRepository.findByCodeForUpdate(request.code().trim())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Invite not found"));

        if (invite.isUsed()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invite code is inactive");
        }
        if (invite.getExpiresAt() != null && !invite.getExpiresAt().isAfter(nowUtc())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Invite expired");
        }

        GroupEntity group = requireGroup(invite.getGroupId());
        if (group.getStatus() == GroupStatus.closed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group is closed");
        }
        if (group.getPrivacy() != GroupPrivacy.private_group || group.isVisible()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This invite code is no longer available");
        }
        if (groupMemberJpaRepository.existsByGroupIdAndUserId(group.getId(), currentUser.id())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You are already a member of this group");
        }

        GroupMemberEntity member = new GroupMemberEntity();
        member.setGroupId(group.getId());
        member.setUserId(currentUser.id());
        member.setRole(GroupMemberRole.member);
        GroupMemberEntity saved = groupMemberJpaRepository.save(member);

        UserEntity user = userJpaRepository.findById(currentUser.id()).orElse(null);
        saved.setFullName(user == null ? null : user.getFullName());
        saved.setProfileImage(user == null ? null : user.getProfileImage());
        return GroupMemberResponse.from(saved);
    }

    @Transactional
    public void delete(Integer inviteId, CurrentUser currentUser) {
        InviteEntity invite = inviteRepository.findById(inviteId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Invite not found"));
        GroupEntity group = requireGroup(invite.getGroupId());
        requireCreatorOrAdmin(group, currentUser.id());
        if (!invite.isUsed()) {
            invite.setUsed(true);
            inviteRepository.save(invite);
        }
    }

    private Integer requiredGroupId(Integer groupId) {
        if (groupId == null || groupId < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "group_id is required");
        }
        return groupId;
    }

    private GroupEntity requireGroup(Integer groupId) {
        return groupJpaRepository.findById(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    private void requireCreatorAdminOrModerator(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.moderator)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
    }

    private void requireCreatorOrAdmin(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Only group creator or admin can deactivate invite codes");
    }

    private OffsetDateTime nowUtc() {
        return OffsetDateTime.now(ZoneOffset.UTC);
    }

    private String generateCode() {
        byte[] bytes = new byte[16];
        secureRandom.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
