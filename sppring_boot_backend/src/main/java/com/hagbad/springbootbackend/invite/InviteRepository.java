package com.hagbad.springbootbackend.invite;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface InviteRepository extends JpaRepository<InviteEntity, Integer> {

    List<InviteEntity> findByGroupIdOrderByCreatedAtDesc(Integer groupId);

    List<InviteEntity> findByGroupIdAndUsedFalse(Integer groupId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from InviteEntity i where i.code = :code")
    Optional<InviteEntity> findByCodeForUpdate(@Param("code") String code);
}
