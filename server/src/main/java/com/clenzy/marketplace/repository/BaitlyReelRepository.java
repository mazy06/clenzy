package com.clenzy.marketplace.repository;
import com.clenzy.marketplace.model.BaitlyReel;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.domain.*;
import java.time.Instant;
import java.util.*;
public interface BaitlyReelRepository extends JpaRepository<BaitlyReel,UUID> {
    List<BaitlyReel> findTop100BySocialProfileIdOrderByCreatedAtDesc(UUID profileId);
    long countBySocialProfileIdAndCreatedAtAfter(UUID profileId,Instant after);
    long countBySocialProfileId(UUID profileId);
    Optional<BaitlyReel> findBySocialProfileIdAndInstagramMediaId(UUID profileId,String mediaId);
    void deleteBySocialProfileId(UUID profileId);
    @Query("SELECT r FROM BaitlyReel r JOIN BaitlySocialProfile p ON p.id=r.socialProfileId WHERE r.published=true AND p.published=true AND p.instagramTokenEncrypted IS NOT NULL AND p.instagramTokenExpiresAt>CURRENT_TIMESTAMP ORDER BY r.createdAt DESC,r.id DESC")
    List<BaitlyReel> publicFeed(Pageable pageable);
}
