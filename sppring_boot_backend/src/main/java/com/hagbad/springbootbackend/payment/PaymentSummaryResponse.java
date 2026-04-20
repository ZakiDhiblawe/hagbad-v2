package com.hagbad.springbootbackend.payment;

import java.math.BigDecimal;

public record PaymentSummaryResponse(
    Integer cycleId,
    int totalPayments,
    int dueCount,
    int paidCount,
    int lateCount,
    BigDecimal totalAmountDue,
    BigDecimal totalAmountPaid,
    BigDecimal outstandingAmount
) {
}
