package com.clenzy.service.dashboard;

import com.clenzy.model.Property;
import com.clenzy.model.UserRole;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Ce qu'une source a besoin de savoir pour chercher.
 *
 * <p>Un objet paramètre plutôt que six arguments répétés à chaque source, et
 * surtout un <b>instant unique</b> pour toute la collecte : sans lui, deux
 * sources interrogées à une seconde d'écart pourraient se contredire sur ce qui
 * est « en retard ».</p>
 *
 * <p>Les trois représentations du temps viennent toutes du {@link Clock}
 * applicatif. Aucune source ne doit appeler {@code LocalDateTime.now()} ni
 * {@code ZoneId.systemDefault()} : la zone de la JVM n'est pas celle du métier,
 * et un décalage d'un jour sur une date d'arrivée se paie en surréservation.</p>
 *
 * @param organizationId  organisation courante — jamais élargie par une source
 * @param role            rôle du demandeur
 * @param ownerKeycloakId identifiant de l'hôte quand la vue doit se limiter à
 *                        ses logements, {@code null} sinon
 */
public record ActionItemContext(
        Long organizationId,
        UserRole role,
        String ownerKeycloakId,
        Instant now,
        LocalDateTime nowDateTime,
        LocalDate today) {

    /** Contexte de collecte pour une organisation, à l'heure du {@link Clock} applicatif. */
    public static ActionItemContext of(Long organizationId, UserRole role,
                                       String ownerKeycloakId, Clock clock) {
        return new ActionItemContext(organizationId, role, ownerKeycloakId,
                clock.instant(), LocalDateTime.now(clock), LocalDate.now(clock));
    }

    /** Vrai si la vue doit se restreindre aux logements d'un hôte. */
    public boolean isOwnerScoped() {
        return ownerKeycloakId != null;
    }

    /**
     * Vrai si ce logement entre dans le périmètre du demandeur.
     *
     * <p>Rendu ici plutôt que recopié dans chaque source : une source qui
     * oublierait ce filtre exposerait les logements de toute l'organisation à un
     * hôte, et rien ne le lui rappellerait.</p>
     */
    public boolean covers(Property property) {
        if (!isOwnerScoped()) return true;
        return property != null
                && property.getOwner() != null
                && ownerKeycloakId.equals(property.getOwner().getKeycloakId());
    }
}
