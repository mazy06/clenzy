package com.clenzy.booking.repository;

import com.clenzy.booking.model.BlogPost;
import com.clenzy.booking.model.SiteStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BlogPostRepository extends JpaRepository<BlogPost, Long> {

    List<BlogPost> findBySiteIdOrderByPublishedAtDesc(Long siteId);

    /** Articles publiés d'un site (liste publique / RSS / sitemap), du plus récent au plus ancien. */
    List<BlogPost> findBySiteIdAndStatusOrderByPublishedAtDesc(Long siteId, SiteStatus status);

    Optional<BlogPost> findBySiteIdAndSlugAndLocale(Long siteId, String slug, String locale);

    Optional<BlogPost> findBySiteIdAndSlugAndLocaleIsNull(Long siteId, String slug);

    Optional<BlogPost> findByIdAndSiteId(Long id, Long siteId);
}
