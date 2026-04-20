package com.hagbad.springbootbackend.groupmember;

import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupService;
import com.hagbad.springbootbackend.security.CurrentUser;
import com.hagbad.springbootbackend.user.UserEntity;
import com.hagbad.springbootbackend.user.UserRepository;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GroupMemberService {

    private final GroupMemberRepository groupMemberRepository;
    private final GroupService groupService;
    private final UserRepository userRepository;

    public GroupMemberService(
        GroupMemberRepository groupMemberRepository,
        GroupService groupService,
        UserRepository userRepository
    ) {
        this.groupMemberRepository = groupMemberRepository;
        this.groupService = groupService;
        this.userRepository = userRepository;
    }

    @Transactional
    public GroupMemberResponse addMember(GroupMemberCreateRequest request, CurrentUser currentUser) {
        if (request.groupId() == null || request.groupId() < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "group_id is required");
        }
        if (request.userId() == null || request.userId() < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "user_id is required");
        }

        GroupEntity group = groupService.requireGroup(request.groupId());
        requireCreatorOrAdmin(group, currentUser.id());

        UserEntity targetUser = userRepository.findById(request.userId())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));

        if (groupMemberRepository.findMembership(group.getId(), request.userId()).isPresent()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User is already a member");
        }

        GroupMemberRole role = parseRoleOrDefault(request.role());

        try {
            GroupMemberEntity member = groupMemberRepository.insert(group.getId(), request.userId(), role);
            GroupMemberEntity enriched = groupMemberRepository.findByIdWithProfile(member.getId()).orElse(member);
            if (enriched.getFullName() == null) {
                enriched.setFullName(targetUser.getFullName());
                enriched.setProfileImage(targetUser.getProfileImage());
            }
            return GroupMemberResponse.from(enriched);
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User is already a member");
        }
    }

    public List<GroupMemberResponse> listMembers(
        Integer groupId,
        String roleValue,
        int page,
        int size,
        CurrentUser currentUser
    ) {
        if (groupId == null || groupId < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "group_id is required");
        }
        if (page < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page must be at least 1");
        }
        if (size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "size must be between 1 and 100");
        }

        GroupEntity group = groupService.requireGroup(groupId);
        if (!group.getCreatedBy().equals(currentUser.id())
            && groupMemberRepository.findMembership(groupId, currentUser.id()).isEmpty()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }

        GroupMemberRole role = parseRoleOptional(roleValue);
        return groupMemberRepository.listMembers(groupId, role, page, size)
            .stream()
            .map(GroupMemberResponse::from)
            .toList();
    }

    @Transactional
    public GroupMemberResponse updateMember(Integer memberId, GroupMemberUpdateRequest request, CurrentUser currentUser) {
        GroupMemberEntity member = requireMember(memberId);
        GroupEntity group = groupService.requireGroup(member.getGroupId());
        requireCreatorOrAdmin(group, currentUser.id());

        GroupMemberRole newRole = parseRoleRequired(request == null ? null : request.role());

        if (member.getUserId().equals(group.getCreatedBy()) && newRole != GroupMemberRole.admin) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Creator must remain an admin");
        }

        if (member.getRole() == GroupMemberRole.admin && newRole != GroupMemberRole.admin) {
            long otherAdminCount = groupMemberRepository.countOtherAdmins(group.getId(), member.getId());
            if (otherAdminCount == 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot demote the last admin");
            }
        }

        groupMemberRepository.updateRole(memberId, newRole);
        return GroupMemberResponse.from(requireMemberWithProfile(memberId));
    }

    @Transactional
    public void removeMember(Integer memberId, CurrentUser currentUser) {
        GroupMemberEntity member = requireMember(memberId);
        GroupEntity group = groupService.requireGroup(member.getGroupId());
        requireCreatorOrAdmin(group, currentUser.id());

        if (member.getUserId().equals(group.getCreatedBy())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Creator cannot be removed");
        }

        promoteSuccessorIfNeeded(group, member);
        groupMemberRepository.deleteById(memberId);
    }

    @Transactional
    public void leaveGroup(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = groupService.requireGroup(groupId);
        GroupMemberEntity member = groupMemberRepository.findMembership(groupId, currentUser.id())
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "You are not a member of this group"));

        if (member.getUserId().equals(group.getCreatedBy())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Group creator cannot leave until ownership transfer is supported"
            );
        }

        promoteSuccessorIfNeeded(group, member);
        groupMemberRepository.deleteById(member.getId());
    }

    private void promoteSuccessorIfNeeded(GroupEntity group, GroupMemberEntity member) {
        if (member.getRole() != GroupMemberRole.admin) {
            return;
        }

        if (groupMemberRepository.countOtherAdmins(group.getId(), member.getId()) > 0) {
            return;
        }

        GroupMemberEntity successor = groupMemberRepository.findSuccessor(group.getId(), member.getId(), GroupMemberRole.moderator)
            .or(() -> groupMemberRepository.findSuccessor(group.getId(), member.getId(), GroupMemberRole.member))
            .orElseThrow(() -> new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot remove the last admin because there is no other member to promote"
            ));

        groupMemberRepository.updateRole(successor.getId(), GroupMemberRole.admin);
    }

    private void requireCreatorOrAdmin(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)) {
            return;
        }
        if (groupMemberRepository.isAdmin(group.getId(), userId)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
    }

    private GroupMemberEntity requireMember(Integer memberId) {
        return groupMemberRepository.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group member not found"));
    }

    private GroupMemberEntity requireMemberWithProfile(Integer memberId) {
        return groupMemberRepository.findByIdWithProfile(memberId)
            .orElseGet(() -> requireMember(memberId));
    }

    private GroupMemberRole parseRoleOptional(String roleValue) {
        String raw = roleValue == null ? "" : roleValue.trim().toLowerCase();
        if (raw.isEmpty() || "all".equals(raw)) {
            return null;
        }
        return parseRoleRequired(raw);
    }

    private GroupMemberRole parseRoleOrDefault(String roleValue) {
        String raw = roleValue == null ? "" : roleValue.trim().toLowerCase();
        if (raw.isEmpty()) {
            return GroupMemberRole.member;
        }
        return parseRoleRequired(raw);
    }

    private GroupMemberRole parseRoleRequired(String roleValue) {
        String raw = roleValue == null ? "" : roleValue.trim().toLowerCase();
        if (raw.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Role is required");
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
}
