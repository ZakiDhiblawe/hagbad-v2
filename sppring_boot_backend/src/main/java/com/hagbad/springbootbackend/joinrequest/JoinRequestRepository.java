package com.hagbad.springbootbackend.joinrequest;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JoinRequestRepository extends JpaRepository<JoinRequestEntity, Integer> {

    Optional<JoinRequestEntity> findByGroupIdAndUserIdAndStatus(Integer groupId, Integer userId, JoinRequestStatus status);

    List<JoinRequestEntity> findByUserIdOrderByRequestedAtDesc(Integer userId);

    List<JoinRequestEntity> findByGroupIdOrderByRequestedAtAsc(Integer groupId);

    List<JoinRequestEntity> findByGroupIdAndStatusOrderByRequestedAtAsc(Integer groupId, JoinRequestStatus status);
}
