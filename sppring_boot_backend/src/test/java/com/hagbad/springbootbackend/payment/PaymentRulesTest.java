package com.hagbad.springbootbackend.payment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class PaymentRulesTest {

    @Test
    void normalizePaymentFieldsKeepsSubmittedPaymentPendingApproval() {
        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            new BigDecimal("50.00"),
            new BigDecimal("50.00"),
            LocalDate.now().plusDays(1),
            null
        );

        assertEquals(PaymentStatus.due, normalized.status());
        assertNull(normalized.paidAt());
    }

    @Test
    void normalizePaymentFieldsMarksApprovedPaymentAsPaid() {
        OffsetDateTime approvedAt = OffsetDateTime.now();

        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            new BigDecimal("50.00"),
            new BigDecimal("50.00"),
            LocalDate.now().plusDays(1),
            approvedAt
        );

        assertEquals(PaymentStatus.paid, normalized.status());
        assertEquals(approvedAt, normalized.paidAt());
    }

    @Test
    void normalizePaymentFieldsKeepsOverdueSubmissionLateUntilApproval() {
        PaymentRules.NormalizedPayment normalized = PaymentRules.normalizePaymentFields(
            new BigDecimal("50.00"),
            new BigDecimal("50.00"),
            LocalDate.now().minusDays(1),
            null
        );

        assertEquals(PaymentStatus.late, normalized.status());
        assertNull(normalized.paidAt());
    }
}
