package com.hagbad.springbootbackend.groupmember;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupMemberJpaRepository extends JpaRepository<GroupMemberEntity, Integer> {

    Optional<GroupMemberEntity> findByGroupIdAndUserId(Integer groupId, Integer userId);

    boolean existsByGroupIdAndUserId(Integer groupId, Integer userId);

    boolean existsByGroupIdAndUserIdAndRole(Integer groupId, Integer userId, GroupMemberRole role);

    List<GroupMemberEntity> findByGroupIdOrderByJoinedAtAscIdAsc(Integer groupId);

    List<GroupMemberEntity> findByGroupId(Integer groupId);
}
