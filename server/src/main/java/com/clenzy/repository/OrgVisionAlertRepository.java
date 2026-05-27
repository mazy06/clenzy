package com.clenzy.repository;

import com.clenzy.model.OrgVisionAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface OrgVisionAlertRepository extends JpaRepository<OrgVisionAlert, Long> {

    Optional<OrgVisionAlert> findByOrganizationId(Long organizationId);

    /**
     * Liste de toutes les configs actives — utilise par le scheduler hebdo pour
     * iterer sur les orgs opt-in. Pas de filtre tenant : c'est un job systeme.
     */
    @Override
    List<OrgVisionAlert> findAll();

    /**
     * Compare-and-swap : ne met a jour {@code last_alerted_at} que si la
     * valeur actuelle n'a pas change depuis {@code expectedLastAlertedAt}
     * (null compris). Empeche le double-envoi d'alerte en HA multi-instance :
     * deux instances qui lisent {@code null} en meme temps verront l'UPDATE
     * etre 1 pour la 1ere et 0 pour la 2eme.
     *
     * @return 1 si l'UPDATE a applique, 0 si une autre instance a deja alerte
     */
    @Modifying
    @Query("UPDATE OrgVisionAlert a SET a.lastAlertedAt = :newValue "
            + "WHERE a.id = :id "
            + "AND (a.lastAlertedAt IS NULL AND :expected IS NULL "
            + "     OR a.lastAlertedAt = :expected)")
    int casLastAlertedAt(@Param("id") Long id,
                          @Param("expected") LocalDateTime expectedLastAlertedAt,
                          @Param("newValue") LocalDateTime newValue);
}
