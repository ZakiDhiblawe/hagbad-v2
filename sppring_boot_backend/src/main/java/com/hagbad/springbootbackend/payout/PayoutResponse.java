package com.hagbad.springbootbackend.payout;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PayoutResponse(
    Integer id,
    Integer cycleId,
    Integer cycleMemberId,
    Integer createdBy,
    Integer approvedBy,
    BigDecimal amount,
    PayoutStatus status,
    String notes,
    OffsetDateTime createdAt,
    OffsetDateTime approvedAt,
    OffsetDateTime paidAt
) {

    public static PayoutResponse from(PayoutEntity entity) {
        return new PayoutResponse(
            entity.getId(),
            entity.getCycleId(),
            entity.getCycleMemberId(),
            entity.getCreatedBy(),
            entity.getApprovedBy(),
            entity.getAmount(),
            entity.getStatus(),
            entity.getNotes(),
            entity.getCreatedAt(),
            entity.getApprovedAt(),
            entity.getPaidAt()
        );
    }
}
