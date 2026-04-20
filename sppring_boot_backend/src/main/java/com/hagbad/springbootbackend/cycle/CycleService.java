package com.hagbad.springbootbackend.cycle;

import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupStatus;
import com.hagbad.springbootbackend.groupsettings.GroupSettingsEntity;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CycleService {

    private final CycleRepository cycleRepository;
    private final CycleSupportService cycleSupportService;

    public CycleService(CycleRepository cycleRepository, CycleSupportService cycleSupportService) {
        this.cycleRepository = cycleRepository;
        this.cycleSupportService = cycleSupportService;
    }

    @Transactional
    public CycleResponse create(CycleCreateRequest request, CurrentUser currentUser) {
        Integer groupId = requiredPositive(request.groupId(), "group_id is required");
        if (request.startDate() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "start_date is required");
        }
        CycleFrequency frequency = requiredFrequency(request.frequency());
        Integer customDays = normalizeCustomDays(frequency, request.customDays());

        GroupEntity group = cycleSupportService.requireGroup(groupId);
        cycleSupportService.requireGroupManager(
            groupId,
            currentUser.id(),
            "Only group admins or moderators can manage cycles"
        );

        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot create a cycle for a closed group");
        }
        if (cycleSupportService.groupHasOpenCycle(groupId, null)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Only one pending, paused, or active cycle is allowed at a time for this group"
            );
        }

        CycleEntity cycle = new CycleEntity();
        cycle.setGroupId(groupId);
        cycle.setCreatedBy(currentUser.id());
        cycle.setStartDate(request.startDate());
        cycle.setFrequency(frequency);
        cycle.setCustomDays(customDays);
        cycle.setStatus(CycleStatus.pending);

        return CycleResponse.from(cycleRepository.save(cycle));
    }

    public CycleResponse get(Integer cycleId, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireGroupMember(cycle.getGroupId(), currentUser.id());
        return CycleResponse.from(cycle);
    }

    public List<CycleResponse> listForGroup(Integer groupId, int page, int size, CurrentUser currentUser) {
        if (page < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page must be at least 1");
        }
        if (size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "size must be between 1 and 100");
        }

        cycleSupportService.requireGroup(groupId);
        cycleSupportService.requireGroupMember(groupId, currentUser.id());

        List<CycleEntity> items = cycleRepository.findByGroupIdOrderByCreatedAtDesc(groupId);
        return paginate(items, page, size).stream().map(CycleResponse::from).toList();
    }

    @Transactional
    public CycleResponse start(Integer cycleId, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can change cycle lifecycle"
        );

        if (cycle.getStatus() == CycleStatus.completed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot start a completed cycle");
        }
        if (cycle.getStatus() == CycleStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cycle is already active");
        }

        GroupEntity group = cycleSupportService.requireGroup(cycle.getGroupId());
        if (group.getStatus() != GroupStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot start a cycle in a closed group");
        }
        if (cycleSupportService.groupHasActiveCycle(group.getId(), cycle.getId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Another cycle is already active for this group");
        }

        List<com.hagbad.springbootbackend.cyclemember.CycleMemberEntity> participants =
            cycleSupportService.ensureCycleParticipantsComplete(cycle);
        GroupSettingsEntity settings = cycleSupportService.requireGroupSettings(cycle.getGroupId());
        Integer effectiveCustomDays = cycle.getCustomDays() != null ? cycle.getCustomDays() : settings.getCustomDays();
        cycle.setEndDate(
            cycleSupportService.computeCycleEndDate(
                cycle.getStartDate(),
                cycle.getFrequency(),
                effectiveCustomDays,
                participants.size()
            )
        );

        cycleSupportService.ensureCycleRoundRecords(cycle, currentUser.id());
        cycle.setStatus(CycleStatus.active);
        return CycleResponse.from(cycleRepository.save(cycle));
    }

    @Transactional
    public CycleResponse stop(Integer cycleId, CycleStatus stopAs, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can change cycle lifecycle"
        );

        if (stopAs != CycleStatus.paused && stopAs != CycleStatus.completed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "status must be paused or completed");
        }
        if (cycle.getStatus() == CycleStatus.completed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cycle already completed");
        }
        if (cycle.getStatus() != CycleStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only active cycles can be stopped");
        }
        if (stopAs == CycleStatus.completed) {
            cycleSupportService.ensureCycleReadyForCompletion(cycle);
        }

        cycle.setStatus(stopAs);
        if (stopAs == CycleStatus.completed && cycle.getEndDate() == null) {
            cycle.setEndDate(LocalDate.now());
        }
        return CycleResponse.from(cycleRepository.save(cycle));
    }

    @Transactional
    public CycleResponse update(Integer cycleId, CycleUpdateRequest request, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only group admins or moderators can manage cycles"
        );

        if (cycle.getStatus() == CycleStatus.completed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot update a completed cycle");
        }
        if (request.status() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Use the start/stop endpoints for lifecycle changes");
        }
        if (cycle.getStatus() != CycleStatus.pending) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only pending cycles can be edited");
        }

        if (request.frequency() != null) {
            cycle.setFrequency(request.frequency());
            if (request.frequency() != CycleFrequency.custom_days) {
                cycle.setCustomDays(null);
            }
        }
        if (request.customDays() != null) {
            if (request.customDays() < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "custom_days must be greater than 0");
            }
            cycle.setCustomDays(request.customDays());
        }
        if (request.endDate() != null) {
            cycle.setEndDate(request.endDate());
        }

        if (cycle.getFrequency() == CycleFrequency.custom_days && (cycle.getCustomDays() == null || cycle.getCustomDays() < 1)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "custom_days is required when frequency=custom_days");
        }

        return CycleResponse.from(cycleRepository.save(cycle));
    }

    private Integer requiredPositive(Integer value, String message) {
        if (value == null || value < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

    private CycleFrequency requiredFrequency(CycleFrequency frequency) {
        if (frequency == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "frequency is required");
        }
        return frequency;
    }

    private Integer normalizeCustomDays(CycleFrequency frequency, Integer customDays) {
        if (frequency == CycleFrequency.custom_days) {
            if (customDays == null || customDays < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "custom_days is required when frequency=custom_days");
            }
            return customDays;
        }
        return null;
    }

    private List<CycleEntity> paginate(List<CycleEntity> items, int page, int size) {
        int offset = (page - 1) * size;
        if (offset >= items.size()) {
            return List.of();
        }
        return items.stream().skip(offset).limit(size).toList();
    }
}
