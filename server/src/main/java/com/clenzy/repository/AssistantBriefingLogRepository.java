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
     * Logs FAILED a re-tenter dans la fenetre {@code since}.
     *
     * <p>Ne filtre PAS sur {@code briefing_date} : un briefing echoue a 23h UTC
     * et reverifie a 00h30 UTC le lendemain doit etre re-tente (sinon on perd
     * le creneau de fin de soiree). La fenetre {@code sentAt >= since}
     * (typiquement 6h glissantes) est la seule borne, et la garde idempotence
     * BDD (unique sur {@code (keycloak_id, briefing_date)}) protege contre les
     * doublons.</p>
     */
    @Query("SELECT l FROM AssistantBriefingLog l "
            + "WHERE l.status = 'FAILED' "
            + "AND l.sentAt >= :since "
            + "ORDER BY l.sentAt ASC")
    List<AssistantBriefingLog> findFailedSince(@Param("since") LocalDateTime since);
}
