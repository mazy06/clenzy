package com.clenzy.integration.nuki.repository;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NukiConnectionRepository extends JpaRepository<NukiConnection, Long> {

    Optional<NukiConnection> findByOrganizationId(Long orgId);

    Optional<NukiConnection> findByOrganizationIdAndStatus(Long orgId, NukiConnectionStatus status);

    /**
     * Connexions par statut. Utilise par la verification du secret de webhook
     * (I2-IOT-01) : le secret etant chiffre au repos (non deterministe), on ne
     * peut pas filtrer en SQL → on charge les connexions ACTIVE et on compare le
     * token en temps constant cote application.
     */
    List<NukiConnection> findAllByStatus(NukiConnectionStatus status);
}
