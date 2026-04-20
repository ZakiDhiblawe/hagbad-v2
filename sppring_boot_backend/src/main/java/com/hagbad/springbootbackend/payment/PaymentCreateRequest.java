package com.hagbad.springbootbackend.payment;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PaymentCreateRequest(
    Integer cycleId,
    Integer cycleMemberId,
    LocalDate dueDate,
    BigDecimal amountDue,
    BigDecimal amountPaid,
    OffsetDateTime paidAt,
    String notes
) {
}
