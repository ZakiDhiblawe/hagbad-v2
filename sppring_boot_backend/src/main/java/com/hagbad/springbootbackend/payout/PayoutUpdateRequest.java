package com.hagbad.springbootbackend.payout;

import java.math.BigDecimal;

public record PayoutUpdateRequest(
    BigDecimal amount,
    String notes
) {
}
