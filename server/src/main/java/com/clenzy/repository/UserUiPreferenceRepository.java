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

    /**
     * Upsert ATOMIQUE (INSERT ... ON CONFLICT) sur la contrainte unique (keycloak_id, pref_key).
     * Remplace l'ancien check-then-act (find puis save) qui, sur deux PUT concurrents de la meme
     * cle, faisait echouer le 2e sur la contrainte unique -> 500 (cf. regle CLAUDE.md #8 :
     * check-then-act interdit sur ressources partagees). pref_value est jsonb -> CAST explicite.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query(value = """
            INSERT INTO user_ui_preferences (keycloak_id, pref_key, pref_value, created_at, updated_at)
            VALUES (:keycloakId, :prefKey, CAST(:prefValue AS jsonb), NOW(), NOW())
            ON CONFLICT (keycloak_id, pref_key)
            DO UPDATE SET pref_value = CAST(:prefValue AS jsonb), updated_at = NOW()
            """, nativeQuery = true)
    void upsertPreference(@Param("keycloakId") String keycloakId,
                          @Param("prefKey") String prefKey,
                          @Param("prefValue") String prefValue);

    @Modifying
    @Transactional
    @Query("DELETE FROM UserUiPreference p WHERE p.keycloakId = :keycloakId AND p.prefKey = :prefKey")
    int deleteByKeycloakIdAndPrefKey(@Param("keycloakId") String keycloakId,
                                     @Param("prefKey") String prefKey);
}
