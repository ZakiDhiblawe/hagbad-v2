package com.hagbad.springbootbackend.groupsettings;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "group_settings")
public class GroupSettingsEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Integer id;

    @Column(name = "group_id", nullable = false)
    private Integer groupId;

    @Column(name = "contribution_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal contributionAmount;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "frequency", nullable = false, columnDefinition = "settings_frequency")
    private SettingsFrequency frequency;

    @Column(name = "custom_days")
    private Integer customDays;

    @Column(name = "allow_late", nullable = false)
    private boolean allowLate;

    @Column(name = "late_penalty", precision = 12, scale = 2)
    private BigDecimal latePenalty;

    @Column(name = "auto_start_cycle", nullable = false)
    private boolean autoStartCycle;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getGroupId() {
        return groupId;
    }

    public void setGroupId(Integer groupId) {
        this.groupId = groupId;
    }

    public BigDecimal getContributionAmount() {
        return contributionAmount;
    }

    public void setContributionAmount(BigDecimal contributionAmount) {
        this.contributionAmount = contributionAmount;
    }

    public SettingsFrequency getFrequency() {
        return frequency;
    }

    public void setFrequency(SettingsFrequency frequency) {
        this.frequency = frequency;
    }

    public Integer getCustomDays() {
        return customDays;
    }

    public void setCustomDays(Integer customDays) {
        this.customDays = customDays;
    }

    public boolean isAllowLate() {
        return allowLate;
    }

    public void setAllowLate(boolean allowLate) {
        this.allowLate = allowLate;
    }

    public BigDecimal getLatePenalty() {
        return latePenalty;
    }

    public void setLatePenalty(BigDecimal latePenalty) {
        this.latePenalty = latePenalty;
    }

    public boolean isAutoStartCycle() {
        return autoStartCycle;
    }

    public void setAutoStartCycle(boolean autoStartCycle) {
        this.autoStartCycle = autoStartCycle;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now(ZoneOffset.UTC);
        }
        if (frequency == null) {
            frequency = SettingsFrequency.monthly;
        }
    }
}
