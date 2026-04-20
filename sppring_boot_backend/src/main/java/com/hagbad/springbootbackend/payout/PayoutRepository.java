package com.hagbad.springbootbackend.payout;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PayoutRepository extends JpaRepository<PayoutEntity, Integer> {

    boolean existsByCycleId(Integer cycleId);

    List<PayoutEntity> findByCycleId(Integer cycleId);
}
