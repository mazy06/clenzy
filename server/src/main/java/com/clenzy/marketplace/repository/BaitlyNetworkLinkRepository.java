package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.BaitlyNetworkLink;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

/** Chaque lecture est bornée par l'organisation, le destinataire ou le secret. */
public interface BaitlyNetworkLinkRepository extends JpaRepository<BaitlyNetworkLink,Long> {
    Page<BaitlyNetworkLink> findByOrganizationId(Long organizationId, Pageable pageable);
    Page<BaitlyNetworkLink> findByProviderId(Long providerId, Pageable pageable);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from BaitlyNetworkLink n where n.organizationId=:org and n.providerId=:provider")
    Optional<BaitlyNetworkLink> lockPair(@Param("org") Long org,@Param("provider") Long provider);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from BaitlyNetworkLink n where n.id=:id")
    Optional<BaitlyNetworkLink> lockId(@Param("id") Long id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select n from BaitlyNetworkLink n where n.tokenHash=:hash")
    Optional<BaitlyNetworkLink> lockToken(@Param("hash") String hash);
}
