package com.hagbad.springbootbackend.groupsettings;

import java.math.BigDecimal;

public record GroupSettingsUpdateRequest(
    BigDecimal contributionAmount,
    SettingsFrequency frequency,
    Integer customDays,
    Boolean allowLate,
    BigDecimal latePenalty,
    Boolean autoStartCycle
) {
}
