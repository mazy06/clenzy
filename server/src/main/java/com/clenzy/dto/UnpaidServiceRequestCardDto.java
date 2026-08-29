package com.clenzy.dto;

import java.math.BigDecimal;

/**
 * Carte déterministe « demande de service impayée » de la constellation du Superviseur
 * (module Finance). Une carte par {@code ServiceRequest} non réglée du logement.
 *
 * <p>Calculée côté serveur (pas de scan LLM). Le bouton « Régler » réutilise le flux
 * de paiement existant de la demande de service
 * ({@code POST /service-requests/{serviceRequestId}/create-payment-session}).</p>
 *
 * <p>i18n : ce DTO ne transporte AUCUN texte destiné à l'utilisateur (pas de
 * français en dur). Il expose des données structurées ({@code title} = titre brut
 * de la demande, {@code category} = famille) ; le front construit les libellés
 * traduits (préfixe « Maintenance », motif, raisonnement) via i18next.</p>
 *
 * @param id               id stable (dédup front) : {@code service-request-<serviceRequestId>}
 * @param serviceRequestId id de la demande de service à régler
 * @param title            titre brut de la demande (donnée, non traduite)
 * @param category         famille : {@code "cleaning"} ou {@code "maintenance"} (pour le préfixe i18n front)
 * @param amount           montant dû (estimatedCost)
 * @param depositAmount    acompte exigible sur le devis approuvé, {@code null}
 *                         s'il n'y en a pas. Il fait PARTIE de {@code amount} —
 *                         ce n'est pas une somme qui s'ajoute.
 * @param depositPaid      {@code true} si cet acompte est déjà encaissé
 * @param stage            échéance appelée par cette carte : {@code "deposit"}
 *                         (l'acompte, avant travaux) ou {@code "balance"} (le
 *                         reste, une fois la prestation facturable). Une carte,
 *                         deux moments — jamais deux cartes concurrentes.
 * @param interventionId   chantier concerné, requis pour régler un acompte
 *                         ({@code POST /payments/create-session}). {@code null}
 *                         sur une échéance de solde, qui passe par la demande.
 */
public record UnpaidServiceRequestCardDto(
        String id,
        Long serviceRequestId,
        String title,
        String category,
        BigDecimal amount,
        BigDecimal depositAmount,
        boolean depositPaid,
        String stage,
        Long interventionId
) {
    /** Échéance « acompte » : dû avant travaux, réglé via l'intervention. */
    public static final String STAGE_DEPOSIT = "deposit";

    /** Échéance « solde » : le reste, une fois la prestation facturable. */
    public static final String STAGE_BALANCE = "balance";
}
