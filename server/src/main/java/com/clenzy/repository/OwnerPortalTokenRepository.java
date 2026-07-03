package com.clenzy.repository;

import com.clenzy.model.OwnerPortalToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OwnerPortalTokenRepository extends JpaRepository<OwnerPortalToken, Long> {

    Optional<OwnerPortalToken> findByToken(UUID token);

    List<OwnerPortalToken> findByOrganizationIdAndOwnerIdOrderByCreatedAtDesc(
            Long organizationId, Long ownerId);
}
