package com.hagbad.springbootbackend.cycle;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CycleRepository extends JpaRepository<CycleEntity, Integer> {

    List<CycleEntity> findByGroupIdOrderByCreatedAtDesc(Integer groupId);
}
