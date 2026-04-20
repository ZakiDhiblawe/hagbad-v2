package com.hagbad.springbootbackend.payout;

import com.hagbad.springbootbackend.cycle.CycleEntity;
import com.hagbad.springbootbackend.cycle.CycleRepository;
import com.hagbad.springbootbackend.cycle.CycleStatus;
import com.hagbad.springbootbackend.cycle.CycleSupportService;
import com.hagbad.springbootbackend.cyclemember.CycleMemberEntity;
import com.hagbad.springbootbackend.cyclemember.CycleMemberRepository;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PayoutService {

    private final PayoutRepository payoutRepository;
    private final CycleSupportService cycleSupportService;
    private final CycleMemberRepository cycleMemberRepository;
    private final CycleRepository cycleRepository;

    public PayoutService(
        PayoutRepository payoutRepository,
        CycleSupportService cycleSupportService,
        CycleMemberRepository cycleMemberRepository,
        CycleRepository cycleRepository
    ) {
        this.payoutRepository = payoutRepository;
        this.cycleSupportService = cycleSupportService;
        this.cycleMemberRepository = cycleMemberRepository;
        this.cycleRepository = cycleRepository;
    }

    @Transactional
    public PayoutResponse create(PayoutCreateRequest request, CurrentUser currentUser) {
        Integer cycleId = requiredPositive(request.cycleId(), "cycle_id is required");
        Integer cycleMemberId = requiredPositive(request.cycleMemberId(), "cycle_member_id is required");
        if (request.amount() == null || request.amount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
        }

        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(cycleMemberId);
        ensureCycleMemberMatchesCycle(cycle, cycleMember);

        PayoutEntity payout = new PayoutEntity();
        payout.setCycleId(cycleId);
        payout.setCycleMemberId(cycleMemberId);
        payout.setCreatedBy(currentUser.id());
        payout.setAmount(request.amount());
        payout.setNotes(trimToNull(request.notes()));
        payout.setStatus(PayoutStatus.pending);

        try {
            return PayoutResponse.from(payoutRepository.save(payout));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "A payout already exists for this cycle member");
        }
    }

    public PayoutResponse get(Integer payoutId, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        requirePayoutViewAccess(payout, currentUser.id());
        return PayoutResponse.from(payout);
    }

    public List<PayoutResponse> list(
        Integer cycleId,
        Integer cycleMemberId,
        PayoutStatus status,
        int page,
        int size,
        CurrentUser currentUser
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

        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        boolean manager = cycleSupportService.isCycleManager(cycleId, currentUser.id());

        List<PayoutEntity> items = payoutRepository.findByCycleId(cycleId);

        if (cycleMemberId != null) {
            CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(cycleMemberId);
            ensureCycleMemberMatchesCycle(cycle, cycleMember);
            items = items.stream().filter(item -> item.getCycleMemberId().equals(cycleMemberId)).toList();
        }

        if (!manager) {
            CycleMemberEntity ownCycleMember = cycleMemberRepository.findByCycleIdAndUserId(cycleId, currentUser.id())
                .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "Not allowed"));
            items = items.stream().filter(item -> item.getCycleMemberId().equals(ownCycleMember.getId())).toList();
        }

        if (status != null) {
            items = items.stream().filter(item -> item.getStatus() == status).toList();
        }

        List<PayoutEntity> ordered = items.stream()
            .sorted(Comparator.comparing(PayoutEntity::getCreatedAt))
            .toList();

        return paginate(ordered, page, size).stream().map(PayoutResponse::from).toList();
    }

    public PayoutSummaryResponse summary(Integer cycleId, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );

        List<PayoutEntity> payouts = payoutRepository.findByCycleId(cycleId);
        BigDecimal totalAmount = safeDecimalSum(payouts.stream().map(PayoutEntity::getAmount).toList());
        BigDecimal paidAmount = safeDecimalSum(
            payouts.stream().filter(item -> item.getStatus() == PayoutStatus.paid).map(PayoutEntity::getAmount).toList()
        );

        return new PayoutSummaryResponse(
            cycle.getId(),
            payouts.size(),
            (int) payouts.stream().filter(item -> item.getStatus() == PayoutStatus.pending).count(),
            (int) payouts.stream().filter(item -> item.getStatus() == PayoutStatus.approved).count(),
            (int) payouts.stream().filter(item -> item.getStatus() == PayoutStatus.rejected).count(),
            (int) payouts.stream().filter(item -> item.getStatus() == PayoutStatus.paid).count(),
            totalAmount,
            paidAmount,
            totalAmount.subtract(paidAmount)
        );
    }

    @Transactional
    public PayoutResponse update(Integer payoutId, PayoutUpdateRequest request, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        CycleEntity cycle = cycleSupportService.requireCycle(payout.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        if (payout.getStatus() == PayoutStatus.approved || payout.getStatus() == PayoutStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Approved or paid payouts cannot be edited directly");
        }

        if (request.amount() != null) {
            if (request.amount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "amount must be greater than 0");
            }
            payout.setAmount(request.amount());
        }
        if (request.notes() != null) {
            payout.setNotes(trimToNull(request.notes()));
        }

        return PayoutResponse.from(payoutRepository.save(payout));
    }

    @Transactional
    public PayoutResponse approve(Integer payoutId, PayoutDecisionRequest request, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        CycleEntity cycle = cycleSupportService.requireCycle(payout.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        if (payout.getStatus() == PayoutStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Paid payout is already final");
        }
        if (payout.getStatus() == PayoutStatus.approved) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payout is already approved");
        }
        if (!cycleSupportService.previousRoundsArePaid(payout)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Previous payout rounds must be paid before this turn can be approved"
            );
        }
        if (cycleSupportService.cycleHasUnsettledRoundPayments(cycle, payout.getCycleMemberId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "All payments for this payout round must be approved before the payout can be approved"
            );
        }

        BigDecimal collectedTotal = cycleSupportService.roundPaymentTotal(cycle, payout.getCycleMemberId());
        if (payout.getAmount().compareTo(collectedTotal) > 0) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Payout amount exceeds the approved payments collected for this round"
            );
        }

        payout.setStatus(PayoutStatus.approved);
        payout.setApprovedBy(currentUser.id());
        payout.setApprovedAt(OffsetDateTime.now(ZoneOffset.UTC));
        if (request != null && request.notes() != null) {
            payout.setNotes(trimToNull(request.notes()));
        }

        return PayoutResponse.from(payoutRepository.save(payout));
    }

    @Transactional
    public PayoutResponse reject(Integer payoutId, PayoutDecisionRequest request, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        CycleEntity cycle = cycleSupportService.requireCycle(payout.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        if (payout.getStatus() == PayoutStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Paid payout cannot be rejected");
        }

        payout.setStatus(PayoutStatus.rejected);
        payout.setApprovedBy(null);
        payout.setApprovedAt(null);
        payout.setPaidAt(null);
        if (request != null && request.notes() != null) {
            payout.setNotes(trimToNull(request.notes()));
        }

        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(payout.getCycleMemberId());
        cycleMember.setReceived(false);
        cycleMemberRepository.save(cycleMember);

        return PayoutResponse.from(payoutRepository.save(payout));
    }

    @Transactional
    public PayoutResponse pay(Integer payoutId, PayoutDecisionRequest request, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        CycleEntity cycle = cycleSupportService.requireCycle(payout.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        if (payout.getStatus() == PayoutStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payout is already marked as paid");
        }
        if (payout.getStatus() != PayoutStatus.approved) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only approved payouts can be marked as paid");
        }
        if (!cycleSupportService.previousRoundsArePaid(payout)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Previous payout rounds must be paid before this turn can be paid"
            );
        }
        if (cycleSupportService.cycleHasUnsettledRoundPayments(cycle, payout.getCycleMemberId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "All payments for this payout round must be approved before this payout can be paid"
            );
        }

        BigDecimal collectedTotal = cycleSupportService.roundPaymentTotal(cycle, payout.getCycleMemberId());
        if (payout.getAmount().compareTo(collectedTotal) > 0) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Not enough approved round payments are available to mark this payout as paid"
            );
        }

        payout.setStatus(PayoutStatus.paid);
        payout.setPaidAt(OffsetDateTime.now(ZoneOffset.UTC));
        if (request != null && request.notes() != null) {
            payout.setNotes(trimToNull(request.notes()));
        }
        payoutRepository.save(payout);

        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(payout.getCycleMemberId());
        cycleMember.setReceived(true);
        cycleMemberRepository.save(cycleMember);

        if (cycleSupportService.cycleIsReadyForAutoCompletion(cycle)) {
            cycle.setStatus(CycleStatus.completed);
            if (cycle.getEndDate() == null) {
                cycle.setEndDate(LocalDate.now());
            }
            cycleRepository.save(cycle);
        }

        return PayoutResponse.from(payout);
    }

    @Transactional
    public void delete(Integer payoutId, CurrentUser currentUser) {
        PayoutEntity payout = cycleSupportService.requirePayout(payoutId);
        CycleEntity cycle = cycleSupportService.requireCycle(payout.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payouts"
        );
        ensureCycleNotCompleted(cycle);
        ensureCycleIsActive(cycle);

        if (payout.getStatus() == PayoutStatus.approved || payout.getStatus() == PayoutStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Approved or paid payouts cannot be deleted");
        }

        payoutRepository.delete(payout);
    }

    private void ensureCycleMemberMatchesCycle(CycleEntity cycle, CycleMemberEntity cycleMember) {
        if (!cycle.getId().equals(cycleMember.getCycleId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "cycle_member_id does not belong to the provided cycle"
            );
        }
    }

    private void ensureCycleNotCompleted(CycleEntity cycle) {
        if (cycle.getStatus() == CycleStatus.completed) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Cannot manage payouts for a completed cycle");
        }
    }

    private void ensureCycleIsActive(CycleEntity cycle) {
        if (cycle.getStatus() != CycleStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payouts can only be managed while the cycle is active");
        }
    }

    private void requirePayoutViewAccess(PayoutEntity payout, Integer userId) {
        if (cycleSupportService.isCycleManager(payout.getCycleId(), userId)) {
            return;
        }
        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(payout.getCycleMemberId());
        if (!cycleMember.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
    }

    private BigDecimal safeDecimalSum(List<BigDecimal> values) {
        BigDecimal total = BigDecimal.ZERO;
        for (BigDecimal value : values) {
            total = total.add(value);
        }
        return total;
    }

    private Integer requiredPositive(Integer value, String message) {
        if (value == null || value < 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, message);
        }
        return value;
    }

    private List<PayoutEntity> paginate(List<PayoutEntity> items, int page, int size) {
        int offset = (page - 1) * size;
        if (offset >= items.size()) {
            return List.of();
        }
        return items.stream().skip(offset).limit(size).toList();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
