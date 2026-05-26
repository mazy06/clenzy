package com.clenzy.repository;

import com.clenzy.model.AssistantBriefingLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AssistantBriefingLogRepository extends JpaRepository<AssistantBriefingLog, Long> {

    /**
     * Verifie si un briefing a deja ete envoye a un user pour une date donnee.
     * Utilise par le scheduler comme garde-fou idempotence en plus de la
     * contrainte BDD.
     */
    Optional<AssistantBriefingLog> findByKeycloakIdAndBriefingDate(String keycloakId,
                                                                    LocalDate briefingDate);

    /**
     * Logs FAILED a re-tenter : meme jour et tentative recente (le caller filtre
     * sur la fenetre 6h). Utilise par {@code BriefingRetryScheduler}.
     */
    @Query("SELECT l FROM AssistantBriefingLog l "
            + "WHERE l.status = 'FAILED' "
            + "AND l.briefingDate = :date "
            + "AND l.sentAt >= :since "
            + "ORDER BY l.sentAt ASC")
    List<AssistantBriefingLog> findFailedSince(@Param("date") LocalDate date,
                                                  @Param("since") LocalDateTime since);
}
