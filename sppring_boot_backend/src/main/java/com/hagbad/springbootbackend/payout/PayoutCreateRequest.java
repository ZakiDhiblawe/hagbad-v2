package com.hagbad.springbootbackend.payout;

import java.math.BigDecimal;

public record PayoutCreateRequest(
    Integer cycleId,
    Integer cycleMemberId,
    BigDecimal amount,
    String notes
) {
}
