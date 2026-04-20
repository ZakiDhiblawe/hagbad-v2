package com.hagbad.springbootbackend.cycle;

import java.time.LocalDate;

public record CycleCreateRequest(
    Integer groupId,
    LocalDate startDate,
    CycleFrequency frequency,
    Integer customDays,
    Boolean autoStart
) {
}
