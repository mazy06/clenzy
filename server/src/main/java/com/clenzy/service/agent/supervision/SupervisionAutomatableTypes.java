package com.clenzy.service.agent.supervision;

import com.clenzy.model.SupervisionAutonomy;

import java.util.List;
import java.util.Optional;

/**
 * Catalogue serveur des types d'action AUTOMATISABLES de la constellation
 * (Vagues 1 + 2) — source de vérité partagée par {@link AutoApplyGate} (borne
 * dure) et {@link SupervisionAutoRuleService} (exposition UI).
 *
 * <p>Chaque type porte son <b>niveau maximum</b> (matrice du plan
 * {@code PLAN-AUTONOMIE-CONSTELLATION.md}) : une règle org ne peut JAMAIS
 * dépasser ce plafond, quel que soit le niveau du module :</p>
 * <ul>
 *   <li>{@code CLEANING_REQUEST}, {@code REVIEW_DRAFT_REPLY} → FULL (N2,
 *       silencieux autorisé — actions sans risque, idempotentes) ;</li>
 *   <li>{@code PRICE_DROP} → NOTIFY (N1 via cadre yield — un ajustement
 *       tarifaire auto reste toujours notifié) ;</li>
 *   <li>{@code CALENDAR_BLOCK}, {@code DEPOSIT_RELEASE}, {@code DEPOSIT_REFUND}
 *       → NOTIFY (N1 — jamais silencieux pour une fermeture de ventes ou une
 *       caution ; les cautions auto = LIBÉRATIONS de hold uniquement, zéro
 *       débit — invariant MONEY_TOOLS intact) ;</li>
 *   <li>{@code PAYMENT_REMINDER} (V3) → NOTIFY (N1 borné : 1ʳᵉ relance
 *       uniquement + 72 h min, cf. enveloppe du gate — un email voyageur est
 *       irréversible, jamais silencieux).</li>
 * </ul>
 *
 * <p>Les cartes scan LLM sont ABSENTES : N0 (le gate rend CARD pour tout type
 * hors catalogue — les Règles de Confiance des cartes ne suggèrent QUE des
 * types de ce catalogue).</p>
 */
public final class SupervisionAutomatableTypes {

    /** Un type automatisable : module (agent) porteur + niveau maximum autorisé. */
    public record AutomatableType(String actionType, String moduleKey, SupervisionAutonomy maxLevel) {}

    /** Catalogue ordonné (ordre d'affichage UI). */
    public static final List<AutomatableType> CATALOG = List.of(
            new AutomatableType(SupervisionActionType.CLEANING_REQUEST, "ops", SupervisionAutonomy.FULL),
            // FULL : la réassignation silencieuse existe déjà (attemptAutoAssign +
            // scheduler 15 min) — l'autonomie ne fait que la rendre visible/gouvernable.
            new AutomatableType(SupervisionActionType.REASSIGN_CLEANING, "ops", SupervisionAutonomy.FULL),
            new AutomatableType(SupervisionActionType.REVIEW_DRAFT_REPLY, "rep", SupervisionAutonomy.FULL),
            new AutomatableType(SupervisionActionType.PRICE_DROP, "rev", SupervisionAutonomy.NOTIFY),
            new AutomatableType(SupervisionActionType.CALENDAR_BLOCK, "ops", SupervisionAutonomy.NOTIFY),
            new AutomatableType(SupervisionActionType.DEPOSIT_RELEASE, "fin", SupervisionAutonomy.NOTIFY),
            new AutomatableType(SupervisionActionType.DEPOSIT_REFUND, "fin", SupervisionAutonomy.NOTIFY),
            new AutomatableType(SupervisionActionType.PAYMENT_REMINDER, "fin", SupervisionAutonomy.NOTIFY));

    public static Optional<AutomatableType> find(String actionType) {
        return CATALOG.stream().filter(t -> t.actionType().equals(actionType)).findFirst();
    }

    private SupervisionAutomatableTypes() {}
}
