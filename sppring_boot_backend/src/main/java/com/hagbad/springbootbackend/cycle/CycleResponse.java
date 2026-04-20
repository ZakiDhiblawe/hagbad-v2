package com.hagbad.springbootbackend.cycle;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record CycleResponse(
    Integer id,
    Integer groupId,
    Integer createdBy,
    LocalDate startDate,
    LocalDate endDate,
    CycleFrequency frequency,
    Integer customDays,
    CycleStatus status,
    OffsetDateTime createdAt
) {

    public static CycleResponse from(CycleEntity entity) {
        return new CycleResponse(
            entity.getId(),
            entity.getGroupId(),
            entity.getCreatedBy(),
            entity.getStartDate(),
            entity.getEndDate(),
            entity.getFrequency(),
            entity.getCustomDays(),
            entity.getStatus(),
            entity.getCreatedAt()
        );
    }
}
