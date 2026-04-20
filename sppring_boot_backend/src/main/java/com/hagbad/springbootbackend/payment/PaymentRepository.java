package com.hagbad.springbootbackend.payment;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<PaymentEntity, Integer> {

    boolean existsByCycleId(Integer cycleId);

    boolean existsByCycleMemberId(Integer cycleMemberId);

    List<PaymentEntity> findByCycleId(Integer cycleId);
}
