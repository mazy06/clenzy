package com.clenzy.repository;

import com.clenzy.model.WelcomeGuideEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WelcomeGuideEntryRepository extends JpaRepository<WelcomeGuideEntry, Long> {

    List<WelcomeGuideEntry> findByGuideIdOrderByCreatedAtDesc(Long guideId);

    List<WelcomeGuideEntry> findTop100ByGuideIdOrderByCreatedAtDesc(Long guideId);
}
