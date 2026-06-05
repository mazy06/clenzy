package com.clenzy.integration.netatmo.repository;

import com.clenzy.integration.netatmo.model.NetatmoConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Acces aux connexions Netatmo. Isolation multi-tenant via le filtre Hibernate
 * organizationFilter (le callback OAuth est public → resolution par user_id).
 */
public interface NetatmoConnectionRepository extends JpaRepository<NetatmoConnection, Long> {

    Optional<NetatmoConnection> findByUserId(String userId);
}
