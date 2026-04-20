package com.hagbad.springbootbackend.groupsettings;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroupSettingsRepository extends JpaRepository<GroupSettingsEntity, Integer> {

    Optional<GroupSettingsEntity> findByGroupId(Integer groupId);

    boolean existsByGroupId(Integer groupId);
}
