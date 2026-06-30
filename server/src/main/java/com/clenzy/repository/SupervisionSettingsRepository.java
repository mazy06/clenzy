package com.clenzy.repository;

import com.clenzy.model.SupervisionSettings;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupervisionSettingsRepository extends JpaRepository<SupervisionSettings, Long> {

    Optional<SupervisionSettings> findByOrganizationId(Long organizationId);

    /** Orgs ayant activé la constellation et non en pause (boucle autonome). */
    List<SupervisionSettings> findByEnabledTrueAndPausedFalse();
}
