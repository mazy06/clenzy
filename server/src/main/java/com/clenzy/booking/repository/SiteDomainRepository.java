package com.clenzy.booking.repository;

import com.clenzy.booking.model.SiteDomain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiteDomainRepository extends JpaRepository<SiteDomain, Long> {

    /** Résolution par domaine custom / hostname (service SSR). */
    Optional<SiteDomain> findByHostname(String hostname);

    List<SiteDomain> findBySiteId(Long siteId);

    List<SiteDomain> findByOrganizationId(Long organizationId);

    Optional<SiteDomain> findByIdAndOrganizationId(Long id, Long organizationId);

    boolean existsByHostname(String hostname);
}
