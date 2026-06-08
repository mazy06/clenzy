package com.clenzy.repository;

import com.clenzy.model.WelcomeGuideEvent;
import com.clenzy.model.WelcomeGuideEventType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface WelcomeGuideEventRepository extends JpaRepository<WelcomeGuideEvent, Long> {

    /** Compte par type d'evenement pour un livret : {@code [WelcomeGuideEventType, Long]}. */
    @Query("SELECT e.eventType, COUNT(e) FROM WelcomeGuideEvent e " +
           "WHERE e.guideId = :guideId GROUP BY e.eventType")
    List<Object[]> countByTypeForGuide(@Param("guideId") Long guideId);

    /** Serie quotidienne pour un type donne depuis {@code since} : {@code ['YYYY-MM-DD', Long]} (Postgres). */
    @Query(value = "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS d, COUNT(*) " +
                   "FROM welcome_guide_events " +
                   "WHERE guide_id = :guideId AND event_type = :eventType AND created_at >= :since " +
                   "GROUP BY d ORDER BY d", nativeQuery = true)
    List<Object[]> dailyCountForGuide(@Param("guideId") Long guideId,
                                      @Param("eventType") String eventType,
                                      @Param("since") LocalDateTime since);

    /** Top details (ex: activites les plus cliquees) : {@code [String, Long]} ordonne desc. */
    @Query("SELECT e.detail, COUNT(e) FROM WelcomeGuideEvent e " +
           "WHERE e.guideId = :guideId AND e.eventType = :eventType AND e.detail IS NOT NULL " +
           "GROUP BY e.detail ORDER BY COUNT(e) DESC")
    List<Object[]> topDetailForGuide(@Param("guideId") Long guideId,
                                     @Param("eventType") WelcomeGuideEventType eventType,
                                     Pageable pageable);

    /** Supprime tous les événements analytics d'un livret (nettoyage à la suppression du livret). */
    @Modifying
    @Query("delete from WelcomeGuideEvent e where e.guideId = :guideId")
    int deleteByGuideId(@Param("guideId") Long guideId);
}
