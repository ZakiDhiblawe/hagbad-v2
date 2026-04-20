package com.hagbad.springbootbackend.groupsettings;

import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupJpaRepository;
import com.hagbad.springbootbackend.group.GroupPrivacy;
import com.hagbad.springbootbackend.groupmember.GroupMemberJpaRepository;
import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import com.hagbad.springbootbackend.security.CurrentUser;
import jakarta.transaction.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class GroupSettingsService {

    private final GroupSettingsRepository groupSettingsRepository;
    private final GroupJpaRepository groupJpaRepository;
    private final GroupMemberJpaRepository groupMemberJpaRepository;

    public GroupSettingsService(
        GroupSettingsRepository groupSettingsRepository,
        GroupJpaRepository groupJpaRepository,
        GroupMemberJpaRepository groupMemberJpaRepository
    ) {
        this.groupSettingsRepository = groupSettingsRepository;
        this.groupJpaRepository = groupJpaRepository;
        this.groupMemberJpaRepository = groupMemberJpaRepository;
    }

    @Transactional
    public GroupSettingsResponse create(GroupSettingsCreateRequest request, CurrentUser currentUser) {
        Integer groupId = requiredGroupId(request.groupId());
        GroupEntity group = requireGroup(groupId);
        requireCreatorAdminOrModerator(group, currentUser.id());

        if (groupSettingsRepository.existsByGroupId(groupId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Settings already exist for this group");
        }

        GroupSettingsEntity entity = new GroupSettingsEntity();
        entity.setGroupId(groupId);
        entity.setContributionAmount(requiredPositive(request.contributionAmount(), "contribution_amount"));
        entity.setFrequency(requiredFrequency(request.frequency()));
        entity.setCustomDays(request.customDays());
        entity.setAllowLate(Boolean.TRUE.equals(request.allowLate()));
        entity.setLatePenalty(request.latePenalty());
        entity.setAutoStartCycle(Boolean.TRUE.equals(request.autoStartCycle()));

        applyRules(entity);
        return GroupSettingsResponse.from(groupSettingsRepository.save(entity));
    }

    public GroupSettingsResponse get(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        if (group.getPrivacy() == GroupPrivacy.private_group
            && !group.getCreatedBy().equals(currentUser.id())
            && !groupMemberJpaRepository.existsByGroupIdAndUserId(groupId, currentUser.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        return GroupSettingsResponse.from(requireSettings(groupId));
    }

    @Transactional
    public GroupSettingsResponse update(Integer groupId, GroupSettingsUpdateRequest request, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireCreatorAdminOrModerator(group, currentUser.id());

        GroupSettingsEntity entity = requireSettings(groupId);
        if (request.contributionAmount() != null) {
            entity.setContributionAmount(requiredPositive(request.contributionAmount(), "contribution_amount"));
        }
        if (request.frequency() != null) {
            entity.setFrequency(request.frequency());
        }
        if (request.customDays() != null) {
            entity.setCustomDays(request.customDays());
        }
        if (request.allowLate() != null) {
            entity.setAllowLate(request.allowLate());
        }
        if (request.latePenalty() != null) {
            entity.setLatePenalty(request.latePenalty());
        }
        if (request.autoStartCycle() != null) {
            entity.setAutoStartCycle(request.autoStartCycle());
        }

        applyRules(entity);
        return GroupSettingsResponse.from(groupSettingsRepository.save(entity));
    }

    @Transactional
    public void delete(Integer groupId, CurrentUser currentUser) {
        GroupEntity group = requireGroup(groupId);
        requireCreatorOrAdmin(group, currentUser.id());
        groupSettingsRepository.delete(requireSettings(groupId));
    }

    private void applyRules(GroupSettingsEntity entity) {
        if (entity.getFrequency() == SettingsFrequency.custom_days && (entity.getCustomDays() == null || entity.getCustomDays() < 1)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "custom_days is required when frequency=custom_days");
        }
        if (entity.getFrequency() != SettingsFrequency.custom_days) {
            entity.setCustomDays(null);
        }
        if (!entity.isAllowLate()) {
            entity.setLatePenalty(null);
        }
    }

    private Integer requiredGroupId(Integer groupId) {
        if (groupId == null || groupId < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "group_id is required");
        }
        return groupId;
    }

    private java.math.BigDecimal requiredPositive(java.math.BigDecimal value, String field) {
        if (value == null || value.signum() <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, field + " must be greater than 0");
        }
        return value;
    }

    private SettingsFrequency requiredFrequency(SettingsFrequency frequency) {
        if (frequency == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "frequency is required");
        }
        return frequency;
    }

    private GroupEntity requireGroup(Integer groupId) {
        return groupJpaRepository.findById(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    private GroupSettingsEntity requireSettings(Integer groupId) {
        return groupSettingsRepository.findByGroupId(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group settings not found"));
    }

    private void requireCreatorOrAdmin(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
    }

    private void requireCreatorAdminOrModerator(GroupEntity group, Integer userId) {
        if (group.getCreatedBy().equals(userId)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.admin)
            || groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(group.getId(), userId, GroupMemberRole.moderator)) {
            return;
        }
        throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
    }
}
