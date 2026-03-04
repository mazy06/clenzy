package com.clenzy.integration.nuki.repository;

import com.clenzy.integration.nuki.model.NukiConnection;
import com.clenzy.integration.nuki.model.NukiConnection.NukiConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface NukiConnectionRepository extends JpaRepository<NukiConnection, Long> {

    Optional<NukiConnection> findByOrganizationId(Long orgId);

    Optional<NukiConnection> findByOrganizationIdAndStatus(Long orgId, NukiConnectionStatus status);
}
