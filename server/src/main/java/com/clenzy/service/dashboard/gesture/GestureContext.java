package com.clenzy.service.dashboard.gesture;

import com.clenzy.model.ActionItem;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;

/**
 * Ce dont un geste a besoin pour s'exécuter.
 *
 * <p>L'action est déjà chargée et son organisation déjà vérifiée : un
 * gestionnaire n'a pas à redémontrer qu'il a le droit d'agir. C'était la raison
 * d'être du point d'entrée unique, et elle survit au découpage — la
 * vérification reste faite une fois, en amont, pour tous.</p>
 *
 * @param assigneeTeamId équipe choisie, pour les gestes d'assignation
 * @param scheduledAt    date choisie, pour les gestes de replanification
 */
public record GestureContext(
        ActionItem item,
        Long orgId,
        Long assigneeTeamId,
        LocalDateTime scheduledAt,
        Jwt jwt) {

    /** L'objet métier visé — réservation, caution, intervention… */
    public Long targetId() {
        return item.getTargetId();
    }

    /** Identifiant Keycloak de la personne qui agit. */
    public String actorId() {
        return jwt == null ? null : jwt.getSubject();
    }
}
