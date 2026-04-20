package com.hagbad.springbootbackend.joinrequest;

import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupJpaRepository;
import com.hagbad.springbootbackend.group.GroupPrivacy;
import com.hagbad.springbootbackend.group.GroupStatus;
import com.hagbad.springbootbackend.groupmember.GroupMemberEntity;
import com.hagbad.springbootbackend.groupmember.GroupMemberJpaRepository;
import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import com.hagbad.springbootbackend.security.CurrentUser;
import com.hagbad.springbootbackend.user.UserEntity;
import com.hagbad.springbootbackend.user.UserJpaRepository;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class JoinRequestService {

    private final JoinRequestRepository joinRequestRepository;
    private final GroupJpaRepository groupJpaRepository;
    private final GroupMemberJpaRepository groupMemberJpaRepository;
    private final UserJpaRepository userJpaRepository;

    public JoinRequestService(
        JoinRequestRepository joinRequestRepository,
        GroupJpaRepository groupJpaRepository,
        GroupMemberJpaRepository groupMemberJpaRepository,
        UserJpaRepository userJpaRepository
    ) {
        this.joinRequestRepository = joinRequestRepository;
        this.groupJpaRepository = groupJpaRepository;
        this.groupMemberJpaRepository = groupMemberJpaRepository;
        this.userJpaRepository = userJpaRepository;
    }

    @Transactional
    public JoinRequestResponse create(JoinRequestCreateRequest request, CurrentUser currentUser) {
        Integer groupId = request.groupId();
        if (groupId == null || groupId < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "group_id is required");
        }
        GroupEntity group = requireGroup(groupId);

        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group is not active");
        }
        if (group.getPrivacy() != GroupPrivacy.private_group) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Join requests are only for private groups");
        }
        if (!group.isVisible()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Join requests are unavailable for hidden groups");
        }
        if (groupMemberJpaRepository.existsByGroupIdAndUserId(groupId, currentUser.id())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You are already a member of this group");
        }
        if (joinRequestRepository.findByGroupIdAndUserIdAndStatus(groupId, currentUser.id(), JoinRequestStatus.pending).isPresent()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "You already have a pending join request for this group");
        }

        JoinRequestEntity entity = new JoinRequestEntity();
        entity.setGroupId(groupId);
        entity.setUserId(currentUser.id());
        entity.setStatus(JoinRequestStatus.pending);
        JoinRequestEntity saved = joinRequestRepository.save(entity);
        UserEntity user = requireUser(currentUser.id());
        return JoinRequestResponse.from(saved, user.getFullName(), user.getProfileImage());
    }

    public List<JoinRequestResponse> listMine(CurrentUser currentUser) {
        UserEntity user = requireUser(currentUser.id());
        return joinRequestRepository.findByUserIdOrderByRequestedAtDesc(currentUser.id()).stream()
            .map(item -> JoinRequestResponse.from(item, user.getFullName(), user.getProfileImage()))
            .toList();
    }

    public List<JoinRequestResponse> listGroup(Integer groupId, JoinRequestStatus status, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireJoinRequestReviewer(group, currentUser.id());

        if (group.getPrivacy() != GroupPrivacy.private_group || !group.isVisible()) {
            return List.of();
        }

        List<JoinRequestEntity> rows = status == null
            ? joinRequestRepository.findByGroupIdOrderByRequestedAtAsc(groupId)
            : joinRequestRepository.findByGroupIdAndStatusOrderByRequestedAtAsc(groupId, status);
        return rows.stream().map(this::toResponse).toList();
    }

    public List<JoinRequestResponse> listManaged(JoinRequestStatus status, CurrentUser currentUser) {
        List<Integer> managedGroupIds = new ArrayList<>();
        for (GroupEntity group : groupJpaRepository.findAll()) {
            boolean manages = group.getCreatedBy().equals(currentUser.id())
                || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), currentUser.id(), GroupMemberRole.admin)
                || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), currentUser.id(), GroupMemberRole.moderator);
            if (manages && group.getPrivacy() == GroupPrivacy.private_group && group.isVisible()) {
                managedGroupIds.add(group.getId());
            }
        }
        if (managedGroupIds.isEmpty()) {
            return List.of();
        }

        List<JoinRequestResponse> results = new ArrayList<>();
        for (Integer groupId : managedGroupIds) {
            results.addAll(listGroup(groupId, status, currentUser));
        }
        return results;
    }

    public JoinRequestResponse get(Integer requestId, CurrentUser currentUser) {
        JoinRequestEntity joinRequest = requireJoinRequest(requestId);
        GroupEntity group = requireGroup(joinRequest.getGroupId());
        boolean isOwner = joinRequest.getUserId().equals(currentUser.id());
        boolean isManager = canApproveJoinRequests(group, currentUser.id());
        if (!isOwner && !isManager) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed to view this join request");
        }
        return toResponse(joinRequest);
    }

    @Transactional
    public JoinRequestResponse decide(Integer requestId, JoinRequestDecisionRequest request, CurrentUser currentUser) {
        JoinRequestEntity joinRequest = requireJoinRequest(requestId);
        GroupEntity group = requireGroup(joinRequest.getGroupId());
        String action = request == null || request.action() == null ? "" : request.action().trim().toLowerCase();

        if ("approve".equals(action)) {
            requireJoinRequestReviewer(group, currentUser.id());
        } else if ("reject".equals(action)) {
            if (!canRejectJoinRequests(group, currentUser.id())) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Only group creator or admin can reject join requests");
            }
        } else {
            throw new ApiException(HttpStatus.BAD_REQUEST, "action is invalid");
        }

        if (joinRequest.getStatus() != JoinRequestStatus.pending) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This join request has already been handled");
        }

        if ("reject".equals(action)) {
            joinRequest.setStatus(JoinRequestStatus.rejected);
            joinRequest.setHandledBy(currentUser.id());
            return toResponse(joinRequestRepository.save(joinRequest));
        }

        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Group is not active");
        }
        if (groupMemberJpaRepository.existsByGroupIdAndUserId(group.getId(), joinRequest.getUserId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "User is already a member of this group");
        }

        GroupMemberEntity member = new GroupMemberEntity();
        member.setGroupId(group.getId());
        member.setUserId(joinRequest.getUserId());
        member.setRole(GroupMemberRole.member);
        groupMemberJpaRepository.save(member);

        joinRequest.setStatus(JoinRequestStatus.approved);
        joinRequest.setHandledBy(currentUser.id());
        return toResponse(joinRequestRepository.save(joinRequest));
    }

    @Transactional
    public void cancel(Integer requestId, CurrentUser currentUser) {
        JoinRequestEntity joinRequest = requireJoinRequest(requestId);
        if (!joinRequest.getUserId().equals(currentUser.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "You can only cancel your own join request");
        }
        if (joinRequest.getStatus() != JoinRequestStatus.pending) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only pending requests can be cancelled");
        }
        joinRequestRepository.delete(joinRequest);
    }

    private JoinRequestResponse toResponse(JoinRequestEntity entity) {
        UserEntity user = requireUser(entity.getUserId());
        return JoinRequestResponse.from(
            entity,
            user.getFullName() == null ? "User #" + entity.getUserId() : user.getFullName(),
            user.getProfileImage()
        );
    }

    private UserEntity requireUser(Integer userId) {
        return userJpaRepository.findById(userId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "User not found"));
    }

    private GroupEntity requireGroup(Integer groupId) {
        return groupJpaRepository.findById(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    private JoinRequestEntity requireJoinRequest(Integer requestId) {
        return joinRequestRepository.findById(requestId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Join request not found"));
    }

    private boolean canApproveJoinRequests(GroupEntity group, Integer userId) {
        return group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.moderator);
    }

    private boolean canRejectJoinRequests(GroupEntity group, Integer userId) {
        return group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin);
    }

    private void requireJoinRequestReviewer(GroupEntity group, Integer userId) {
        if (!canApproveJoinRequests(group, userId)) {
            throw new ApiException(
                HttpStatus.FORBIDDEN,
                "Only group creator, admin, or moderator can review join requests"
            );
        }
    }
}
