package com.hagbad.springbootbackend.cycle;

import com.hagbad.springbootbackend.cyclemember.CycleMemberEntity;
import com.hagbad.springbootbackend.cyclemember.CycleMemberRepository;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.group.GroupEntity;
import com.hagbad.springbootbackend.group.GroupJpaRepository;
import com.hagbad.springbootbackend.group.GroupStatus;
import com.hagbad.springbootbackend.groupmember.GroupMemberEntity;
import com.hagbad.springbootbackend.groupmember.GroupMemberJpaRepository;
import com.hagbad.springbootbackend.groupmember.GroupMemberRole;
import com.hagbad.springbootbackend.groupsettings.GroupSettingsEntity;
import com.hagbad.springbootbackend.groupsettings.GroupSettingsRepository;
import com.hagbad.springbootbackend.payment.PaymentEntity;
import com.hagbad.springbootbackend.payment.PaymentRepository;
import com.hagbad.springbootbackend.payment.PaymentRules;
import com.hagbad.springbootbackend.payment.PaymentStatus;
import com.hagbad.springbootbackend.payout.PayoutEntity;
import com.hagbad.springbootbackend.payout.PayoutRepository;
import com.hagbad.springbootbackend.payout.PayoutStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CycleSupportService {

    private final CycleRepository cycleRepository;
    private final GroupJpaRepository groupJpaRepository;
    private final GroupMemberJpaRepository groupMemberJpaRepository;
    private final GroupSettingsRepository groupSettingsRepository;
    private final CycleMemberRepository cycleMemberRepository;
    private final PaymentRepository paymentRepository;
    private final PayoutRepository payoutRepository;

    public CycleSupportService(
        CycleRepository cycleRepository,
        GroupJpaRepository groupJpaRepository,
        GroupMemberJpaRepository groupMemberJpaRepository,
        GroupSettingsRepository groupSettingsRepository,
        CycleMemberRepository cycleMemberRepository,
        PaymentRepository paymentRepository,
        PayoutRepository payoutRepository
    ) {
        this.cycleRepository = cycleRepository;
        this.groupJpaRepository = groupJpaRepository;
        this.groupMemberJpaRepository = groupMemberJpaRepository;
        this.groupSettingsRepository = groupSettingsRepository;
        this.cycleMemberRepository = cycleMemberRepository;
        this.paymentRepository = paymentRepository;
        this.payoutRepository = payoutRepository;
    }

    public GroupEntity requireGroup(Integer groupId) {
        return groupJpaRepository.findById(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Group not found"));
    }

    public CycleEntity requireCycle(Integer cycleId) {
        return cycleRepository.findById(cycleId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Cycle not found"));
    }

    public CycleMemberEntity requireCycleMember(Integer cycleMemberId) {
        return cycleMemberRepository.findById(cycleMemberId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Cycle member not found"));
    }

    public PaymentEntity requirePayment(Integer paymentId) {
        return paymentRepository.findById(paymentId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Payment not found"));
    }

    public PayoutEntity requirePayout(Integer payoutId) {
        return payoutRepository.findById(payoutId)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Payout not found"));
    }

    public GroupSettingsEntity requireGroupSettings(Integer groupId) {
        return groupSettingsRepository.findByGroupId(groupId)
            .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "Group settings not found"));
    }

    public boolean isGroupCreator(Integer groupId, Integer userId) {
        return groupJpaRepository.findById(groupId)
            .map(group -> group.getCreatedBy().equals(userId))
            .orElse(false);
    }

    public boolean isGroupAdmin(Integer groupId, Integer userId) {
        return groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(groupId, userId, GroupMemberRole.admin);
    }

    public boolean isGroupModerator(Integer groupId, Integer userId) {
        return groupMemberJpaRepository.existsByGroupIdAndUserIdAndRole(groupId, userId, GroupMemberRole.moderator);
    }

    public boolean isGroupManager(Integer groupId, Integer userId) {
        return isGroupCreator(groupId, userId) || isGroupAdmin(groupId, userId) || isGroupModerator(groupId, userId);
    }

    public boolean isGroupMember(Integer groupId, Integer userId) {
        return isGroupCreator(groupId, userId) || groupMemberJpaRepository.existsByGroupIdAndUserId(groupId, userId);
    }

    public void requireGroupManager(Integer groupId, Integer userId, String message) {
        if (!isGroupManager(groupId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, message);
        }
    }

    public void requireGroupMember(Integer groupId, Integer userId) {
        if (!isGroupMember(groupId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
    }

    public boolean isCycleCreator(Integer cycleId, Integer userId) {
        return cycleRepository.findById(cycleId)
            .map(cycle -> cycle.getCreatedBy().equals(userId))
            .orElse(false);
    }

    public boolean isGroupAdminForCycle(Integer cycleId, Integer userId) {
        CycleEntity cycle = requireCycle(cycleId);
        return isGroupAdmin(cycle.getGroupId(), userId);
    }

    public boolean isGroupModeratorForCycle(Integer cycleId, Integer userId) {
        CycleEntity cycle = requireCycle(cycleId);
        return isGroupModerator(cycle.getGroupId(), userId);
    }

    public boolean isCycleManager(Integer cycleId, Integer userId) {
        CycleEntity cycle = requireCycle(cycleId);
        return isGroupManager(cycle.getGroupId(), userId) || cycle.getCreatedBy().equals(userId);
    }

    public void requireCycleManager(Integer cycleId, Integer userId, String message) {
        if (!isCycleManager(cycleId, userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, message);
        }
    }

    public boolean isGroupMemberForCycle(Integer cycleId, Integer userId) {
        CycleEntity cycle = requireCycle(cycleId);
        return isGroupMember(cycle.getGroupId(), userId);
    }

    public boolean isCycleParticipant(Integer cycleId, Integer userId) {
        return isCycleCreator(cycleId, userId) || cycleMemberRepository.findByCycleIdAndUserId(cycleId, userId).isPresent();
    }

    public boolean canViewCycleMembers(Integer cycleId, Integer userId) {
        return isCycleParticipant(cycleId, userId) || isCycleManager(cycleId, userId);
    }

    public CycleEntity ensureCycleIsPendingSetup(Integer cycleId) {
        CycleEntity cycle = requireCycle(cycleId);
        if (cycle.getStatus() != CycleStatus.pending) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cycle participants can only be changed while the cycle is pending"
            );
        }
        return cycle;
    }

    public boolean payoutOrderTaken(Integer cycleId, Integer payoutOrder, Integer excludeMemberId) {
        return getCycleMembersSorted(cycleId).stream()
            .filter(member -> excludeMemberId == null || !member.getId().equals(excludeMemberId))
            .anyMatch(member -> member.getPayoutOrder().equals(payoutOrder));
    }

    public boolean cycleHasPayoutRecords(Integer cycleId) {
        return payoutRepository.existsByCycleId(cycleId);
    }

    public List<GroupMemberEntity> getGroupMemberRowsForCycle(Integer cycleId) {
        CycleEntity cycle = requireCycle(cycleId);
        return groupMemberJpaRepository.findByGroupIdOrderByJoinedAtAscIdAsc(cycle.getGroupId());
    }

    public List<CycleMemberEntity> getCycleMembersSorted(Integer cycleId) {
        return cycleMemberRepository.findByCycleIdOrderByPayoutOrderAscCreatedAtAscIdAsc(cycleId);
    }

    public boolean groupHasActiveCycle(Integer groupId, Integer excludeCycleId) {
        return cycleRepository.findByGroupIdOrderByCreatedAtDesc(groupId).stream()
            .filter(cycle -> excludeCycleId == null || !cycle.getId().equals(excludeCycleId))
            .anyMatch(cycle -> cycle.getStatus() == CycleStatus.active);
    }

    public boolean groupHasOpenCycle(Integer groupId, Integer excludeCycleId) {
        return cycleRepository.findByGroupIdOrderByCreatedAtDesc(groupId).stream()
            .filter(cycle -> excludeCycleId == null || !cycle.getId().equals(excludeCycleId))
            .anyMatch(cycle -> cycle.getStatus() == CycleStatus.pending
                || cycle.getStatus() == CycleStatus.active
                || cycle.getStatus() == CycleStatus.paused);
    }

    public int frequencyDays(CycleFrequency frequency, Integer customDays) {
        if (frequency == CycleFrequency.daily) {
            return 1;
        }
        if (frequency == CycleFrequency.weekly) {
            return 7;
        }
        if (frequency == CycleFrequency.monthly) {
            return 30;
        }
        if (frequency == CycleFrequency.custom_days) {
            if (customDays == null || customDays < 1) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "custom_days is required for custom_days frequency");
            }
            return customDays;
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Invalid frequency");
    }

    public LocalDate computeCycleEndDate(LocalDate start, CycleFrequency frequency, Integer customDays, int participantCount) {
        if (participantCount <= 1) {
            return start;
        }
        return start.plusDays((long) frequencyDays(frequency, customDays) * (participantCount - 1));
    }

    public List<CycleMemberEntity> ensureCycleParticipantsComplete(CycleEntity cycle) {
        List<CycleMemberEntity> participants = getCycleMembersSorted(cycle.getId());
        if (participants.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Add cycle participants before starting the cycle");
        }

        GroupEntity group = requireGroup(cycle.getGroupId());
        Set<Integer> groupUserIds = getGroupUserIds(group);
        Set<Integer> cycleUserIds = new HashSet<>();
        for (CycleMemberEntity participant : participants) {
            cycleUserIds.add(participant.getUserId());
        }

        List<Integer> missingUserIds = groupUserIds.stream()
            .filter(userId -> !cycleUserIds.contains(userId))
            .sorted()
            .toList();

        if (!missingUserIds.isEmpty()) {
            String missing = missingUserIds.stream().map(String::valueOf).reduce((a, b) -> a + ", " + b).orElse("");
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Every group member must be added before starting the cycle. Missing users: " + missing
            );
        }

        return participants;
    }

    @Transactional
    public void ensureCycleRoundRecords(CycleEntity cycle, Integer createdBy) {
        if (paymentRepository.existsByCycleId(cycle.getId()) || payoutRepository.existsByCycleId(cycle.getId())) {
            return;
        }

        List<CycleMemberEntity> participants = getCycleMembersSorted(cycle.getId());
        if (participants.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Add cycle participants before starting the cycle");
        }

        GroupSettingsEntity settings = requireGroupSettings(cycle.getGroupId());
        Integer effectiveCustomDays = cycle.getCustomDays() != null ? cycle.getCustomDays() : settings.getCustomDays();
        int intervalDays = frequencyDays(cycle.getFrequency(), effectiveCustomDays);
        BigDecimal contributionAmount = settings.getContributionAmount();
        BigDecimal roundPoolAmount = contributionAmount.multiply(BigDecimal.valueOf(participants.size()));
        LocalDate today = LocalDate.now();

        List<PayoutEntity> payouts = new ArrayList<>();
        List<PaymentEntity> payments = new ArrayList<>();
        for (int index = 0; index < participants.size(); index += 1) {
            CycleMemberEntity payoutMember = participants.get(index);
            LocalDate dueDate = cycle.getStartDate().plusDays((long) intervalDays * index);

            PayoutEntity payout = new PayoutEntity();
            payout.setCycleId(cycle.getId());
            payout.setCycleMemberId(payoutMember.getId());
            payout.setCreatedBy(createdBy);
            payout.setAmount(roundPoolAmount);
            payout.setStatus(PayoutStatus.pending);
            payout.setNotes("Round " + (index + 1) + " payout for payout order #" + payoutMember.getPayoutOrder());
            payouts.add(payout);

            for (CycleMemberEntity contributor : participants) {
                PaymentEntity payment = new PaymentEntity();
                payment.setCycleId(cycle.getId());
                payment.setCycleMemberId(contributor.getId());
                payment.setCreatedBy(createdBy);
                payment.setDueDate(dueDate);
                payment.setAmountDue(contributionAmount);
                payment.setAmountPaid(BigDecimal.ZERO);
                payment.setStatus(dueDate.isBefore(today) ? PaymentStatus.late : PaymentStatus.due);
                payment.setNotes("Round " + (index + 1) + " contribution payment");
                payments.add(payment);
            }
        }

        payoutRepository.saveAll(payouts);
        paymentRepository.saveAll(payments);
    }

    @Transactional
    public void syncCyclePayments(Integer cycleId) {
        List<PaymentEntity> items = paymentRepository.findByCycleId(cycleId);
        boolean changed = false;
        for (PaymentEntity item : items) {
            if (item.getAmountPaid() != null
                && item.getAmountDue() != null
                && item.getAmountPaid().compareTo(item.getAmountDue()) > 0) {
                item.setAmountPaid(item.getAmountDue());
                changed = true;
            }
            PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
                item.getAmountDue(),
                item.getAmountPaid(),
                item.getDueDate(),
                item.getPaidAt()
            );
            if (item.getStatus() != normalized.status() || !sameDateTime(item.getPaidAt(), normalized.paidAt())) {
                item.setStatus(normalized.status());
                item.setPaidAt(normalized.paidAt());
                changed = true;
            }
        }
        if (changed) {
            paymentRepository.saveAll(items);
        }
    }

    public void ensureCycleReadyForCompletion(CycleEntity cycle) {
        syncCyclePayments(cycle.getId());

        int participantCount = (int) cycleMemberRepository.countByCycleId(cycle.getId());
        if (participantCount == 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cycle must have participants before it can be completed");
        }

        boolean unsettledPayments = paymentRepository.findByCycleId(cycle.getId()).stream()
            .anyMatch(payment -> payment.getStatus() == PaymentStatus.due || payment.getStatus() == PaymentStatus.late);
        if (unsettledPayments) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "All cycle payments must be fully settled before completion");
        }

        int payoutCount = payoutRepository.findByCycleId(cycle.getId()).size();
        if (payoutCount != participantCount) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Every cycle participant must have a payout record before completion"
            );
        }

        boolean unpaidPayouts = payoutRepository.findByCycleId(cycle.getId()).stream()
            .anyMatch(payout -> payout.getStatus() != PayoutStatus.paid);
        if (unpaidPayouts) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Every payout must be marked as paid before completing the cycle");
        }
    }

    public LocalDate getMemberPayoutRoundDueDate(CycleEntity cycle, Integer cycleMemberId) {
        Integer effectiveCustomDays = cycle.getCustomDays();
        if (cycle.getFrequency() == CycleFrequency.custom_days && effectiveCustomDays == null) {
            effectiveCustomDays = requireGroupSettings(cycle.getGroupId()).getCustomDays();
        }
        int intervalDays = frequencyDays(cycle.getFrequency(), effectiveCustomDays);
        List<CycleMemberEntity> members = getCycleMembersSorted(cycle.getId());
        for (int index = 0; index < members.size(); index += 1) {
            if (members.get(index).getId().equals(cycleMemberId)) {
                return cycle.getStartDate().plusDays((long) intervalDays * index);
            }
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "Cycle member does not belong to this cycle");
    }

    public boolean paymentIsLockedByProcessedPayout(PaymentEntity payment, CycleEntity cycle) {
        PayoutEntity payout = payoutRepository.findByCycleId(cycle.getId()).stream()
            .filter(item -> item.getCycleMemberId().equals(payment.getCycleMemberId()))
            .filter(item -> item.getStatus() == PayoutStatus.approved || item.getStatus() == PayoutStatus.paid)
            .min(Comparator.comparing(PayoutEntity::getCreatedAt))
            .orElse(null);

        if (payout == null) {
            return false;
        }

        LocalDate payoutRoundDueDate = getMemberPayoutRoundDueDate(cycle, payment.getCycleMemberId());
        return !payment.getDueDate().isAfter(payoutRoundDueDate);
    }

    public boolean cycleHasUnsettledRoundPayments(CycleEntity cycle, Integer cycleMemberId) {
        syncCyclePayments(cycle.getId());
        LocalDate roundDueDate = getMemberPayoutRoundDueDate(cycle, cycleMemberId);
        return paymentRepository.findByCycleId(cycle.getId()).stream()
            .filter(payment -> roundDueDate.equals(payment.getDueDate()))
            .anyMatch(payment -> payment.getStatus() == PaymentStatus.due || payment.getStatus() == PaymentStatus.late);
    }

    public BigDecimal roundPaymentTotal(CycleEntity cycle, Integer cycleMemberId) {
        LocalDate roundDueDate = getMemberPayoutRoundDueDate(cycle, cycleMemberId);
        BigDecimal total = BigDecimal.ZERO;
        for (PaymentEntity payment : paymentRepository.findByCycleId(cycle.getId())) {
            if (roundDueDate.equals(payment.getDueDate()) && payment.getStatus() == PaymentStatus.paid) {
                total = total.add(payment.getAmountPaid());
            }
        }
        return total;
    }

    public boolean previousRoundsArePaid(PayoutEntity payout) {
        CycleMemberEntity currentMember = requireCycleMember(payout.getCycleMemberId());
        int currentOrder = currentMember.getPayoutOrder();

        List<CycleMemberEntity> orderedMembers = getCycleMembersSorted(payout.getCycleId());
        List<PayoutEntity> payouts = payoutRepository.findByCycleId(payout.getCycleId());

        for (CycleMemberEntity member : orderedMembers) {
            if (member.getPayoutOrder() >= currentOrder) {
                break;
            }
            PayoutEntity previousPayout = payouts.stream()
                .filter(item -> item.getCycleMemberId().equals(member.getId()))
                .findFirst()
                .orElse(null);
            if (previousPayout != null && previousPayout.getStatus() != PayoutStatus.paid) {
                return false;
            }
        }
        return true;
    }

    public boolean cycleIsReadyForAutoCompletion(CycleEntity cycle) {
        int cycleMemberTotal = (int) cycleMemberRepository.countByCycleId(cycle.getId());
        if (cycleMemberTotal == 0) {
            return false;
        }

        List<PayoutEntity> payouts = payoutRepository.findByCycleId(cycle.getId());
        if (payouts.size() != cycleMemberTotal) {
            return false;
        }
        if (payouts.stream().anyMatch(payout -> payout.getStatus() != PayoutStatus.paid)) {
            return false;
        }

        syncCyclePayments(cycle.getId());
        return paymentRepository.findByCycleId(cycle.getId()).stream().noneMatch(payment ->
            payment.getAmountPaid().compareTo(payment.getAmountDue()) < 0 || payment.getPaidAt() == null
        );
    }

    private Set<Integer> getGroupUserIds(GroupEntity group) {
        Set<Integer> userIds = new HashSet<>();
        userIds.add(group.getCreatedBy());
        for (GroupMemberEntity member : groupMemberJpaRepository.findByGroupId(group.getId())) {
            userIds.add(member.getUserId());
        }
        return userIds;
    }

    private boolean sameDateTime(java.time.OffsetDateTime left, java.time.OffsetDateTime right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.isEqual(right);
    }
}
