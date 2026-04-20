package com.hagbad.springbootbackend.cyclemember;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleMemberRepository extends JpaRepository<CycleMemberEntity, Integer> {

    Optional<CycleMemberEntity> findByCycleIdAndUserId(Integer cycleId, Integer userId);

    boolean existsByCycleId(Integer cycleId);

    boolean existsByCycleIdAndUserId(Integer cycleId, Integer userId);

    List<CycleMemberEntity> findByCycleIdOrderByPayoutOrderAscCreatedAtAscIdAsc(Integer cycleId);

    long countByCycleId(Integer cycleId);
}
