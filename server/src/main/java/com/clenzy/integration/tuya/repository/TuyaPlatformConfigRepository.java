package com.clenzy.integration.tuya.repository;

import com.clenzy.integration.tuya.model.TuyaPlatformConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TuyaPlatformConfigRepository extends JpaRepository<TuyaPlatformConfig, Long> {

    /** Singleton : la (seule) ligne de config plateforme Tuya. */
    Optional<TuyaPlatformConfig> findFirstByOrderByIdAsc();
}
