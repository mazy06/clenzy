package com.clenzy.marketplace.model;

/**
 * Qui paie la prestation.
 *
 * <p>Decide du chemin comptable : une depense refacturee au proprietaire
 * ({@code provider_expenses}), une vente au voyageur ({@code upsell_orders}) ou
 * une facture de commission. Les trois chemins existaient deja ; rien ne les
 * choisissait.</p>
 */
public enum ServicePayer {
    /** Le proprietaire ou la conciergerie pour son compte. */
    OWNER,
    /** Le voyageur — candidat naturel a la vente additionnelle. */
    GUEST,
    /** L'agence elle-meme (logistique interne). */
    AGENCY
}
