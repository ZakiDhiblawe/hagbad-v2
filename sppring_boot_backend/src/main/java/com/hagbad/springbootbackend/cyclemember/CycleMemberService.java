package com.hagbad.springbootbackend.cyclemember;

import com.hagbad.springbootbackend.cycle.CycleEntity;
import com.hagbad.springbootbackend.cycle.CycleSupportService;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.groupmember.GroupMemberEntity;
import com.hagbad.springbootbackend.payment.PaymentRepository;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CycleMemberService {

    private final CycleMemberRepository cycleMemberRepository;
    private final CycleSupportService cycleSupportService;
    private final PaymentRepository paymentRepository;

    public CycleMemberService(
        CycleMemberRepository cycleMemberRepository,
        CycleSupportService cycleSupportService,
        PaymentRepository paymentRepository
    ) {
        this.cycleMemberRepository = cycleMemberRepository;
        this.cycleSupportService = cycleSupportService;
        this.paymentRepository = paymentRepository;
    }

    @Transactional
    public CycleMemberResponse add(CycleMemberCreateRequest request, com.hagbad.springbootbackend.security.CurrentUser currentUser) {
        Integer cycleId = requiredPositive(request.cycleId(), "cycle_id is required");
        Integer userId = requiredPositive(request.userId(), "user_id is required");

        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage cycle participants"
        );
        cycleSupportService.ensureCycleIsPendingSetup(cycleId);

        if (!cycleSupportService.isGroupMemberForCycle(cycleId, userId)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "User must already belong to the group before joining a cycle"
            );
        }

        Integer payoutOrder = request.payoutOrder();
        if (payoutOrder == null) {
            List<CycleMemberEntity> members = cycleSupportService.getCycleMembersSorted(cycleId);
            payoutOrder = members.isEmpty() ? 1 : members.get(members.size() - 1).getPayoutOrder() + 1;
        }
        if (payoutOrder < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "payout_order must be greater than 0");
        }
        if (cycleSupportService.payoutOrderTaken(cycleId, payoutOrder, null)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payout order already assigned in this cycle");
        }

        CycleMemberEntity entity = new CycleMemberEntity();
        entity.setCycleId(cycleId);
        entity.setUserId(userId);
        entity.setPayoutOrder(payoutOrder);

        try {
            return CycleMemberResponse.from(cycleMemberRepository.save(entity));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Member or order conflict");
        }
    }

    @Transactional
    public List<CycleMemberResponse> fill(CycleMemberFillRequest request, com.hagbad.springbootbackend.security.CurrentUser currentUser) {
        Integer cycleId = requiredPositive(request.cycleId(), "cycle_id is required");
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage cycle participants"
        );
        cycleSupportService.ensureCycleIsPendingSetup(cycleId);

        String orderMode = request.orderMode() == null || request.orderMode().isBlank()
            ? "manual"
            : request.orderMode().trim().toLowerCase();
        if (!"manual".equals(orderMode) && !"random".equals(orderMode)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "order_mode must be manual or random");
        }

        Set<Integer> existingUserIds = cycleSupportService.getCycleMembersSorted(cycleId).stream()
            .map(CycleMemberEntity::getUserId)
            .collect(Collectors.toSet());
        List<GroupMemberEntity> groupMemberRows = cycleSupportService.getGroupMemberRowsForCycle(cycleId);

        List<Integer> eligibleUserIds = new ArrayList<>();
        for (GroupMemberEntity item : groupMemberRows) {
            if (!existingUserIds.contains(item.getUserId())) {
                eligibleUserIds.add(item.getUserId());
            }
        }

        if (eligibleUserIds.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Every group member is already in this cycle");
        }

        if ("random".equals(orderMode)) {
            Collections.shuffle(eligibleUserIds);
        }

        List<CycleMemberEntity> existingMembers = cycleSupportService.getCycleMembersSorted(cycleId);
        int nextOrder = existingMembers.isEmpty() ? 1 : existingMembers.get(existingMembers.size() - 1).getPayoutOrder() + 1;

        List<CycleMemberEntity> created = new ArrayList<>();
        for (Integer userId : eligibleUserIds) {
            CycleMemberEntity member = new CycleMemberEntity();
            member.setCycleId(cycleId);
            member.setUserId(userId);
            member.setPayoutOrder(nextOrder);
            created.add(member);
            nextOrder += 1;
        }

        try {
            return cycleMemberRepository.saveAll(created).stream().map(CycleMemberResponse::from).toList();
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Could not add the remaining group members to this cycle"
            );
        }
    }

    public List<CycleMemberResponse> list(
        Integer cycleId,
        int page,
        int size,
        Integer order,
        com.hagbad.springbootbackend.security.CurrentUser currentUser
    ) {
        if (cycleId == null || cycleId < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "cycle_id is required");
        }
        if (page < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "page must be at least 1");
        }
        if (size < 1 || size > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "size must be between 1 and 100");
        }

        if (!cycleSupportService.canViewCycleMembers(cycleId, currentUser.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }

        List<CycleMemberEntity> items = cycleSupportService.getCycleMembersSorted(cycleId);
        if (order != null) {
            items = items.stream().filter(item -> item.getPayoutOrder().equals(order)).toList();
        }

        return paginate(items, page, size).stream().map(CycleMemberResponse::from).toList();
    }

    public CycleMemberResponse get(Integer memberId, com.hagbad.springbootbackend.security.CurrentUser currentUser) {
        CycleMemberEntity entity = cycleMemberRepository.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        if (!cycleSupportService.canViewCycleMembers(entity.getCycleId(), currentUser.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
        return CycleMemberResponse.from(entity);
    }

    @Transactional
    public CycleMemberResponse update(
        Integer memberId,
        CycleMemberUpdateRequest request,
        com.hagbad.springbootbackend.security.CurrentUser currentUser
    ) {
        CycleMemberEntity entity = cycleMemberRepository.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));
        cycleSupportService.ensureCycleIsPendingSetup(entity.getCycleId());

        if (request.payoutOrder() != null) {
            cycleSupportService.requireCycleManager(
                entity.getCycleId(),
                currentUser.id(),
                "Only a group admin or moderator can manage cycle participants"
            );
            if (cycleSupportService.cycleHasPayoutRecords(entity.getCycleId())) {
                throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "Cannot change payout order after payout records have been created"
                );
            }
            if (request.payoutOrder() < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "payout_order must be greater than 0");
            }
            if (cycleSupportService.payoutOrderTaken(entity.getCycleId(), request.payoutOrder(), entity.getId())) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "Payout order already assigned in this cycle");
            }
            entity.setPayoutOrder(request.payoutOrder());
        }

        if (request.received() != null) {
            boolean allowed = entity.getUserId().equals(currentUser.id())
                || cycleSupportService.isCycleCreator(entity.getCycleId(), currentUser.id())
                || cycleSupportService.isGroupAdminForCycle(entity.getCycleId(), currentUser.id());
            if (!allowed) {
                throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
            }
            entity.setReceived(request.received());
        }

        return CycleMemberResponse.from(cycleMemberRepository.save(entity));
    }

    @Transactional
    public void delete(Integer memberId, com.hagbad.springbootbackend.security.CurrentUser currentUser) {
        CycleMemberEntity entity = cycleMemberRepository.findById(memberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Not found"));

        cycleSupportService.requireCycleManager(
            entity.getCycleId(),
            currentUser.id(),
            "Only a group admin or moderator can manage cycle participants"
        );
        cycleSupportService.ensureCycleIsPendingSetup(entity.getCycleId());

        if (cycleSupportService.cycleHasPayoutRecords(entity.getCycleId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot remove a cycle member after payout records have been created"
            );
        }
        if (paymentRepository.existsByCycleMemberId(entity.getId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot remove a cycle member after payments have been recorded"
            );
        }

        cycleMemberRepository.delete(entity);
    }

    private Integer requiredPositive(Integer value, String message) {
        if (value == null || value < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

    private List<CycleMemberEntity> paginate(List<CycleMemberEntity> items, int page, int size) {
        List<CycleMemberEntity> ordered = items.stream()
            .sorted(Comparator
                .comparing(CycleMemberEntity::getPayoutOrder)
                .thenComparing(CycleMemberEntity::getCreatedAt)
                .thenComparing(CycleMemberEntity::getId))
            .toList();
        int offset = (page - 1) * size;
        if (offset >= ordered.size()) {
            return List.of();
        }
        return ordered.stream().skip(offset).limit(size).toList();
    }
}
