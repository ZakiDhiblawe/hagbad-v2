package com.hagbad.springbootbackend.payment;

import java.math.BigDecimal;

public record PaymentSubmissionRequest(
    BigDecimal amountPaid,
    String notes
) {
}
