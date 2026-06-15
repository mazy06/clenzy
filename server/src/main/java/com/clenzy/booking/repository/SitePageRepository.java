package com.clenzy.booking.repository;

import com.clenzy.booking.model.SitePage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SitePageRepository extends JpaRepository<SitePage, Long> {

    List<SitePage> findBySiteIdOrderBySortOrderAsc(Long siteId);

    Optional<SitePage> findBySiteIdAndPathAndLocale(Long siteId, String path, String locale);

    /** Page commune (sans locale) : repli quand aucune variante localisée n'existe. */
    Optional<SitePage> findBySiteIdAndPathAndLocaleIsNull(Long siteId, String path);

    Optional<SitePage> findByIdAndSiteId(Long id, Long siteId);

    void deleteBySiteId(Long siteId);
}
