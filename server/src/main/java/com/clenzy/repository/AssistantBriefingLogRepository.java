package com.clenzy.repository;

import com.clenzy.model.AssistantBriefingLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Optional;

public interface AssistantBriefingLogRepository extends JpaRepository<AssistantBriefingLog, Long> {

    /**
     * Verifie si un briefing a deja ete envoye a un user pour une date donnee.
     * Utilise par le scheduler comme garde-fou idempotence en plus de la
     * contrainte BDD.
     */
    Optional<AssistantBriefingLog> findByKeycloakIdAndBriefingDate(String keycloakId,
                                                                    LocalDate briefingDate);
}
