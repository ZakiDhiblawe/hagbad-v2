package com.hagbad.springbootbackend.payout;

import java.math.BigDecimal;

public record PayoutSummaryResponse(
    Integer cycleId,
    int totalPayouts,
    int pendingCount,
    int approvedCount,
    int rejectedCount,
    int paidCount,
    BigDecimal totalAmount,
    BigDecimal paidAmount,
    BigDecimal remainingAmount
) {
}
