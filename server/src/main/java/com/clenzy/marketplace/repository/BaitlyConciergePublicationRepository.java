package com.clenzy.marketplace.repository;
import com.clenzy.marketplace.model.BaitlyConciergePublication;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
public interface BaitlyConciergePublicationRepository extends JpaRepository<BaitlyConciergePublication,Long> {
    List<BaitlyConciergePublication> findByPublishedTrueAndPeriodStartOrderByProviderId(LocalDate periodStart);
    List<BaitlyConciergePublication> findByPublishedTrueOrderByProviderId();
}
