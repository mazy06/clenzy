package com.clenzy.booking.repository;

import com.clenzy.booking.model.Site;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SiteRepository extends JpaRepository<Site, Long> {

    List<Site> findByOrganizationId(Long organizationId);

    Optional<Site> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Résolution par sous-domaine `{slug}.clenzy.site` (service SSR). */
    Optional<Site> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
