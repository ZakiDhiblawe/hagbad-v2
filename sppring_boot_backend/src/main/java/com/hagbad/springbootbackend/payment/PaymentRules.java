package com.hagbad.springbootbackend.payment;

import com.hagbad.springbootbackend.exception.ApiException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;

public final class PaymentRules {

    private PaymentRules() {
    }

    public static NormalizedPayment normalizePaymentFields(
        BigDecimal amountDue,
        BigDecimal amountPaid,
        LocalDate dueDate,
        OffsetDateTime paidAt
    ) {
        if (amountDue == null || amountPaid == null || dueDate == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Payment fields are incomplete");
        }
        if (amountPaid.compareTo(amountDue) > 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "amount_paid cannot be greater than amount_due");
        }
        if (paidAt != null && amountPaid.compareTo(amountDue) < 0) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "Only fully submitted payments can be approved");
        }
        if (amountPaid.compareTo(amountDue) >= 0 && paidAt != null) {
            return new NormalizedPayment(PaymentStatus.paid, paidAt);
        }
        return new NormalizedPayment(
            dueDate.isBefore(LocalDate.now()) ? PaymentStatus.late : PaymentStatus.due,
            null
        );
    }

    public static boolean isPendingApproval(PaymentEntity entity) {
        return entity.getAmountPaid() != null
            && entity.getAmountPaid().compareTo(BigDecimal.ZERO) > 0
            && entity.getPaidAt() == null;
    }

    public record NormalizedPayment(PaymentStatus status, OffsetDateTime paidAt) {
    }
}
