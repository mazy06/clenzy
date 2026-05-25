package com.clenzy.repository;

import com.clenzy.model.UserUiPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserUiPreferenceRepository extends JpaRepository<UserUiPreference, Long> {

    List<UserUiPreference> findByKeycloakId(String keycloakId);

    Optional<UserUiPreference> findByKeycloakIdAndPrefKey(String keycloakId, String prefKey);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserUiPreference p WHERE p.keycloakId = :keycloakId AND p.prefKey = :prefKey")
    int deleteByKeycloakIdAndPrefKey(@Param("keycloakId") String keycloakId,
                                     @Param("prefKey") String prefKey);
}
