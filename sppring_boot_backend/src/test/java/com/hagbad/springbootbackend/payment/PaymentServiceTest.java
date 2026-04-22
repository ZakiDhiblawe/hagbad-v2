package com.hagbad.springbootbackend.payment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.hagbad.springbootbackend.cycle.CycleEntity;
import com.hagbad.springbootbackend.cycle.CycleStatus;
import com.hagbad.springbootbackend.cycle.CycleSupportService;
import com.hagbad.springbootbackend.security.CurrentUser;
import java.lang.reflect.Proxy;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class PaymentServiceTest {

    @Test
    void approveRepairsLegacyPendingPaymentBeforeApproval() {
        PaymentEntity payment = new PaymentEntity();
        payment.setId(55);
        payment.setCycleId(8);
        payment.setCycleMemberId(13);
        payment.setAmountDue(new BigDecimal("25.00"));
        payment.setAmountPaid(new BigDecimal("25.00"));
        payment.setDueDate(LocalDate.now());
        payment.setStatus(PaymentStatus.paid);
        payment.setPaidAt(null);

        CycleEntity cycle = new CycleEntity();
        cycle.setId(8);
        cycle.setStatus(CycleStatus.active);
        cycle.setStartDate(LocalDate.now());

        AtomicInteger saveCalls = new AtomicInteger();
        PaymentRepository paymentRepository = (PaymentRepository) Proxy.newProxyInstance(
            PaymentRepository.class.getClassLoader(),
            new Class<?>[] { PaymentRepository.class },
            (proxy, method, args) -> {
                if ("save".equals(method.getName())) {
                    saveCalls.incrementAndGet();
                    return args[0];
                }
                if ("equals".equals(method.getName())) {
                    return proxy == args[0];
                }
                if ("hashCode".equals(method.getName())) {
                    return System.identityHashCode(proxy);
                }
                if ("toString".equals(method.getName())) {
                    return "PaymentRepositoryStub";
                }
                throw new UnsupportedOperationException("Unexpected repository method: " + method.getName());
            }
        );

        CycleSupportService cycleSupportService = new CycleSupportService(null, null, null, null, null, null, null) {
            @Override
            public PaymentEntity requirePayment(Integer paymentId) {
                return payment;
            }

            @Override
            public CycleEntity requireCycle(Integer cycleId) {
                return cycle;
            }

            @Override
            public void requireCycleManager(Integer cycleId, Integer userId, String message) {
                // Allowed for this test.
            }
        };

        PaymentService paymentService = new PaymentService(paymentRepository, cycleSupportService, null);
        CurrentUser currentUser = new CurrentUser(1, "admin@example.com", "sid-1");

        PaymentResponse response = paymentService.approve(55, new PaymentDecisionRequest(null), currentUser);

        assertEquals(2, saveCalls.get());
        assertEquals(PaymentStatus.paid, response.status());
        assertNotNull(response.paidAt());
    }
}
