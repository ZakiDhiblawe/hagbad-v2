package com.hagbad.springbootbackend.payment;

import com.hagbad.springbootbackend.cycle.CycleEntity;
import com.hagbad.springbootbackend.cycle.CycleStatus;
import com.hagbad.springbootbackend.cycle.CycleSupportService;
import com.hagbad.springbootbackend.cyclemember.CycleMemberEntity;
import com.hagbad.springbootbackend.cyclemember.CycleMemberRepository;
import com.hagbad.springbootbackend.exception.ApiException;
import com.hagbad.springbootbackend.groupsettings.GroupSettingsEntity;
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
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final CycleSupportService cycleSupportService;
    private final CycleMemberRepository cycleMemberRepository;

    public PaymentService(
        PaymentRepository paymentRepository,
        CycleSupportService cycleSupportService,
        CycleMemberRepository cycleMemberRepository
    ) {
        this.paymentRepository = paymentRepository;
        this.cycleSupportService = cycleSupportService;
        this.cycleMemberRepository = cycleMemberRepository;
    }

    @Transactional
    public PaymentResponse create(PaymentCreateRequest request, CurrentUser currentUser) {
        Integer cycleId = requiredPositive(request.cycleId(), "cycle_id is required");
        Integer cycleMemberId = requiredPositive(request.cycleMemberId(), "cycle_member_id is required");
        if (request.dueDate() == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "due_date is required");
        }

        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage payments"
        );
        ensureCycleCanAcceptPayments(cycle);

        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(cycleMemberId);
        ensureCycleMemberMatchesCycle(cycle, cycleMember);

        BigDecimal amountDue = request.amountDue();
        if (amountDue == null) {
            GroupSettingsEntity settings = cycleSupportService.requireGroupSettings(cycle.getGroupId());
            amountDue = settings.getContributionAmount();
        }
        BigDecimal amountPaid = request.amountPaid() == null ? BigDecimal.ZERO : request.amountPaid();

        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            amountDue,
            amountPaid,
            request.dueDate(),
            request.paidAt()
        );

        PaymentEntity payment = new PaymentEntity();
        payment.setCycleId(cycleId);
        payment.setCycleMemberId(cycleMemberId);
        payment.setCreatedBy(currentUser.id());
        payment.setDueDate(request.dueDate());
        payment.setAmountDue(amountDue);
        payment.setAmountPaid(amountPaid);
        payment.setStatus(normalized.status());
        payment.setPaidAt(normalized.paidAt());
        payment.setNotes(trimToNull(request.notes()));

        try {
            return PaymentResponse.from(paymentRepository.save(payment));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Payment already exists for this cycle member on that due date"
            );
        }
    }

    @Transactional
    public PaymentResponse get(Integer paymentId, CurrentUser currentUser) {
        PaymentEntity payment = cycleSupportService.requirePayment(paymentId);
        requirePaymentViewAccess(payment, currentUser.id());
        if (syncPaymentStatus(payment)) {
            payment = paymentRepository.save(payment);
        }
        return PaymentResponse.from(payment);
    }

    @Transactional
    public List<PaymentResponse> list(
        Integer cycleId,
        Integer cycleMemberId,
        PaymentStatus status,
        LocalDate dueFrom,
        LocalDate dueTo,
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
        cycleSupportService.syncCyclePayments(cycleId);

        List<PaymentEntity> items = paymentRepository.findByCycleId(cycleId);

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
        if (dueFrom != null) {
            items = items.stream().filter(item -> !item.getDueDate().isBefore(dueFrom)).toList();
        }
        if (dueTo != null) {
            items = items.stream().filter(item -> !item.getDueDate().isAfter(dueTo)).toList();
        }

        List<PaymentEntity> ordered = items.stream()
            .sorted(Comparator.comparing(PaymentEntity::getDueDate).thenComparing(PaymentEntity::getCreatedAt))
            .toList();

        return paginate(ordered, page, size).stream().map(PaymentResponse::from).toList();
    }

    @Transactional
    public PaymentSummaryResponse summary(Integer cycleId, CurrentUser currentUser) {
        CycleEntity cycle = cycleSupportService.requireCycle(cycleId);
        cycleSupportService.requireCycleManager(
            cycleId,
            currentUser.id(),
            "Only a group admin or moderator can manage payments"
        );

        cycleSupportService.syncCyclePayments(cycleId);
        List<PaymentEntity> items = paymentRepository.findByCycleId(cycleId);

        int dueCount = (int) items.stream().filter(item -> item.getStatus() == PaymentStatus.due).count();
        int paidCount = (int) items.stream().filter(item -> item.getStatus() == PaymentStatus.paid).count();
        int lateCount = (int) items.stream().filter(item -> item.getStatus() == PaymentStatus.late).count();
        BigDecimal totalAmountDue = safeDecimalSum(items.stream().map(PaymentEntity::getAmountDue).toList());
        BigDecimal totalAmountPaid = safeDecimalSum(
            items.stream()
                .filter(item -> item.getStatus() == PaymentStatus.paid)
                .map(PaymentEntity::getAmountPaid)
                .toList()
        );

        return new PaymentSummaryResponse(
            cycle.getId(),
            items.size(),
            dueCount,
            paidCount,
            lateCount,
            totalAmountDue,
            totalAmountPaid,
            totalAmountDue.subtract(totalAmountPaid)
        );
    }

    @Transactional
    public PaymentResponse update(Integer paymentId, PaymentUpdateRequest request, CurrentUser currentUser) {
        PaymentEntity payment = cycleSupportService.requirePayment(paymentId);
        CycleEntity cycle = cycleSupportService.requireCycle(payment.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payments"
        );
        ensureCycleCanAcceptPayments(cycle);

        if (cycleSupportService.paymentIsLockedByProcessedPayout(payment, cycle)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot edit payments from rounds already locked by an approved or paid payout"
            );
        }

        if (request.dueDate() != null) {
            payment.setDueDate(request.dueDate());
        }
        if (request.amountDue() != null) {
            payment.setAmountDue(request.amountDue());
        }
        if (request.amountPaid() != null) {
            payment.setAmountPaid(request.amountPaid());
        }
        if (request.notes() != null) {
            payment.setNotes(trimToNull(request.notes()));
        }

        OffsetDateTime paidAt = (request.amountPaid() != null || request.paidAt() != null)
            ? request.paidAt()
            : payment.getPaidAt();
        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            payment.getAmountDue(),
            payment.getAmountPaid(),
            payment.getDueDate(),
            paidAt
        );
        payment.setStatus(normalized.status());
        payment.setPaidAt(normalized.paidAt());

        try {
            return PaymentResponse.from(paymentRepository.save(payment));
        } catch (DataIntegrityViolationException ex) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Another payment already exists for this cycle member on that due date"
            );
        }
    }

    @Transactional
    public PaymentResponse submit(Integer paymentId, PaymentSubmissionRequest request, CurrentUser currentUser) {
        PaymentEntity payment = cycleSupportService.requirePayment(paymentId);
        CycleEntity cycle = cycleSupportService.requireCycle(payment.getCycleId());
        ensureCycleCanAcceptPayments(cycle);

        if (syncPaymentStatus(payment)) {
            payment = paymentRepository.save(payment);
        }

        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(payment.getCycleMemberId());
        if (!cycleMember.getUserId().equals(currentUser.id())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Only the payment owner can submit this payment");
        }
        if (payment.getStatus() == PaymentStatus.paid || payment.getPaidAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This payment is already approved");
        }
        if (cycleSupportService.paymentIsLockedByProcessedPayout(payment, cycle)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot submit payments for rounds already locked by an approved or paid payout"
            );
        }

        BigDecimal submittedAmount = request != null && request.amountPaid() != null
            ? request.amountPaid()
            : payment.getAmountDue();
        if (submittedAmount.compareTo(payment.getAmountDue()) != 0) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Only the full scheduled contribution can be submitted for approval"
            );
        }

        payment.setAmountPaid(submittedAmount);
        payment.setPaidAt(null);
        if (request != null && request.notes() != null) {
            payment.setNotes(trimToNull(request.notes()));
        }
        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            payment.getAmountDue(),
            payment.getAmountPaid(),
            payment.getDueDate(),
            null
        );
        payment.setStatus(normalized.status());
        payment.setPaidAt(normalized.paidAt());

        return PaymentResponse.from(paymentRepository.save(payment));
    }

    @Transactional
    public PaymentResponse approve(Integer paymentId, PaymentDecisionRequest request, CurrentUser currentUser) {
        PaymentEntity payment = cycleSupportService.requirePayment(paymentId);
        CycleEntity cycle = cycleSupportService.requireCycle(payment.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payments"
        );
        ensureCycleCanAcceptPayments(cycle);

        if (syncPaymentStatus(payment)) {
            payment = paymentRepository.save(payment);
        }

        if (payment.getStatus() == PaymentStatus.paid || payment.getPaidAt() != null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "This payment is already approved");
        }
        if (!PaymentRules.isPendingApproval(payment)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "The member has not submitted this payment for approval yet"
            );
        }

        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            payment.getAmountDue(),
            payment.getAmountPaid(),
            payment.getDueDate(),
            OffsetDateTime.now(ZoneOffset.UTC)
        );
        payment.setStatus(normalized.status());
        payment.setPaidAt(normalized.paidAt());
        if (request != null && request.notes() != null) {
            payment.setNotes(trimToNull(request.notes()));
        }

        return PaymentResponse.from(paymentRepository.save(payment));
    }

    @Transactional
    public void delete(Integer paymentId, CurrentUser currentUser) {
        PaymentEntity payment = cycleSupportService.requirePayment(paymentId);
        CycleEntity cycle = cycleSupportService.requireCycle(payment.getCycleId());
        cycleSupportService.requireCycleManager(
            cycle.getId(),
            currentUser.id(),
            "Only a group admin or moderator can manage payments"
        );
        ensureCycleCanAcceptPayments(cycle);

        if (cycleSupportService.paymentIsLockedByProcessedPayout(payment, cycle)) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "Cannot delete payments from rounds already locked by an approved or paid payout"
            );
        }
        if (payment.getAmountPaid().compareTo(BigDecimal.ZERO) > 0 || payment.getStatus() == PaymentStatus.paid) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Paid payment records cannot be deleted");
        }

        paymentRepository.delete(payment);
    }

    private void ensureCycleCanAcceptPayments(CycleEntity cycle) {
        if (cycle.getStatus() != CycleStatus.active) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payments can only be managed while the cycle is active");
        }
    }

    private void ensureCycleMemberMatchesCycle(CycleEntity cycle, CycleMemberEntity cycleMember) {
        if (!cycle.getId().equals(cycleMember.getCycleId())) {
            throw new ApiException(
                HttpStatus.BAD_REQUEST,
                "cycle_member_id does not belong to the provided cycle"
            );
        }
    }

    private void requirePaymentViewAccess(PaymentEntity payment, Integer userId) {
        if (cycleSupportService.isCycleManager(payment.getCycleId(), userId)) {
            return;
        }
        CycleMemberEntity cycleMember = cycleSupportService.requireCycleMember(payment.getCycleMemberId());
        if (!cycleMember.getUserId().equals(userId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Not allowed");
        }
    }

    private boolean syncPaymentStatus(PaymentEntity payment) {
        if (payment.getAmountPaid() != null
            && payment.getAmountDue() != null
            && payment.getAmountPaid().compareTo(payment.getAmountDue()) > 0) {
            payment.setAmountPaid(payment.getAmountDue());
        }
        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            payment.getAmountDue(),
            payment.getAmountPaid(),
            payment.getDueDate(),
            payment.getPaidAt()
        );
        boolean changed = payment.getStatus() != normalized.status()
            || !sameDateTime(payment.getPaidAt(), normalized.paidAt());
        payment.setStatus(normalized.status());
        payment.setPaidAt(normalized.paidAt());
        return changed;
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

    private List<PaymentEntity> paginate(List<PaymentEntity> items, int page, int size) {
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

    private boolean sameDateTime(OffsetDateTime left, OffsetDateTime right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.isEqual(right);
    }
}
