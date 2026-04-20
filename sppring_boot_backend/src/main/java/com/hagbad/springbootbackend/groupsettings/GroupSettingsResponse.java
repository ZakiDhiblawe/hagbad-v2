package com.hagbad.springbootbackend.groupsettings;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record GroupSettingsResponse(
    Integer id,
    Integer groupId,
    BigDecimal contributionAmount,
    SettingsFrequency frequency,
    Integer customDays,
    boolean allowLate,
    BigDecimal latePenalty,
    boolean autoStartCycle,
    OffsetDateTime createdAt
) {

    public static GroupSettingsResponse from(GroupSettingsEntity entity) {
        return new GroupSettingsResponse(
            entity.getId(),
            entity.getGroupId(),
            entity.getContributionAmount(),
            entity.getFrequency(),
            entity.getCustomDays(),
            entity.isAllowLate(),
            entity.getLatePenalty(),
            entity.isAutoStartCycle(),
            entity.getCreatedAt()
        );
    }
}
