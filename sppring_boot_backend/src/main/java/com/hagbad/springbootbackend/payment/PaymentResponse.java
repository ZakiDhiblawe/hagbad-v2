package com.hagbad.springbootbackend.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PaymentResponse(
    Integer id,
    Integer cycleId,
    Integer cycleMemberId,
    Integer createdBy,
    LocalDate dueDate,
    BigDecimal amountDue,
    BigDecimal amountPaid,
    PaymentStatus status,
    OffsetDateTime paidAt,
    String notes,
    OffsetDateTime createdAt,
    boolean pendingApproval
) {

    public static PaymentResponse from(PaymentEntity entity) {
        return new PaymentResponse(
            entity.getId(),
            entity.getCycleId(),
            entity.getCycleMemberId(),
            entity.getCreatedBy(),
            entity.getDueDate(),
            entity.getAmountDue(),
            entity.getAmountPaid(),
            entity.getStatus(),
            entity.getPaidAt(),
            entity.getNotes(),
            entity.getCreatedAt(),
            PaymentRules.isPendingApproval(entity)
        );
    }
}
