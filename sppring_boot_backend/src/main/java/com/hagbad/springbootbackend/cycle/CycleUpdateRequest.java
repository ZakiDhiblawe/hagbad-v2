package com.hagbad.springbootbackend.cycle;

import java.time.LocalDate;

public record CycleUpdateRequest(
    CycleStatus status,
    LocalDate endDate,
    CycleFrequency frequency,
    Integer customDays
) {
}
