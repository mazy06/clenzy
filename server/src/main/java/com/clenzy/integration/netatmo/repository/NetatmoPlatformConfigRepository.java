package com.clenzy.integration.netatmo.repository;

import com.clenzy.integration.netatmo.model.NetatmoPlatformConfig;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Acces a la configuration plateforme Netatmo (singleton). NON org-scopee.
 */
public interface NetatmoPlatformConfigRepository extends JpaRepository<NetatmoPlatformConfig, Long> {

    Optional<NetatmoPlatformConfig> findFirstByOrderByIdAsc();
}
