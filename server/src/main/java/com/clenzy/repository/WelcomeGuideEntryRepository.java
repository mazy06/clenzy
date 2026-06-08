package com.clenzy.repository;

import com.clenzy.model.WelcomeGuideEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WelcomeGuideEntryRepository extends JpaRepository<WelcomeGuideEntry, Long> {

    List<WelcomeGuideEntry> findByGuideIdOrderByCreatedAtDesc(Long guideId);

    List<WelcomeGuideEntry> findTop100ByGuideIdOrderByCreatedAtDesc(Long guideId);

    /** Supprime toutes les entrées de livre d'or d'un livret (suppression en cascade applicative). */
    @Modifying
    @Query("delete from WelcomeGuideEntry e where e.guide.id = :guideId")
    int deleteByGuideId(@Param("guideId") Long guideId);
}
