package com.clenzy.marketplace.dto;

import com.clenzy.marketplace.model.EngagementMode;
import com.clenzy.marketplace.model.ProviderStatus;

import java.math.BigDecimal;
import java.util.List;

/**
 * Criteres de recherche du catalogue.
 *
 * <p>Tout champ vide signifie « pas de contrainte ». C'est ce qui permet a
 * l'ecran de composer librement ses filtres sans que le service ait a connaitre
 * leurs combinaisons.</p>
 *
 * @param query            texte libre : nom, raison sociale, courriel, ville
 * @param statuses         etats retenus ; vide = tous
 * @param engagementModes  modes d'engagement retenus ; vide = tous
 * @param categoryCodes    le professionnel doit proposer AU MOINS une prestation
 *                         active dans l'un de ces metiers
 * @param serviceCodes     il doit proposer AU MOINS une prestation active
 *                         correspondant a l'une de ces entrees du catalogue —
 *                         le filtre fin, celui qui rend le referentiel utile
 * @param countryCode      pays de la base ou d'une zone declaree
 * @param department       departement d'une zone declaree
 * @param city             ville de la base ou d'une zone declaree
 * @param minRating        note moyenne minimale ; exclut les fiches sans note
 * @param verifiedOnly     ne retenir que les fiches verifiees
 * @param complianceAlert  {@code true} = seulement les fiches a piece expiree ou
 *                         expirant sous trente jours ; {@code false} = seulement
 *                         les fiches sans alerte ; {@code null} = indifferent
 * @param acceptsUrgent    ne retenir que ceux qui acceptent l'urgence
 * @param hasOrganization  {@code true} = rattache a une organisation porteuse,
 *                         {@code false} = sans organisation, {@code null} = indifferent
 * @param organizationId   organisation porteuse precise
 * @param availableOnDay   jour ISO (1 = lundi) ; retient aussi ceux qui n'ont
 *                         rien declare, puisque l'absence de declaration vaut
 *                         disponible
 * @param sort             clef de tri : {@code recent} (defaut), {@code name},
 *                         {@code rating}, {@code missions}
 */
public record ProviderSearchCriteria(
    String query,
    List<ProviderStatus> statuses,
    List<EngagementMode> engagementModes,
    List<String> categoryCodes,
    List<String> serviceCodes,
    String countryCode,
    String department,
    String city,
    BigDecimal minRating,
    boolean verifiedOnly,
    Boolean complianceAlert,
    boolean acceptsUrgent,
    Boolean hasOrganization,
    Long organizationId,
    Short availableOnDay,
    String sort,
    int page,
    int size
) {
    /** Bornes de pagination : une page non bornee laisserait un appel sortir tout le catalogue. */
    public ProviderSearchCriteria {
        page = Math.max(0, page);
        size = size <= 0 ? 24 : Math.min(size, 100);
    }
}
