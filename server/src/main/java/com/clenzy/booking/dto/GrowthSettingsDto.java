package com.clenzy.booking.dto;

/**
 * Réglages de croissance org-level du booking engine (CLZ Domaine 2), avec compteurs réels.
 * Les drapeaux sont réellement appliqués : capture de leads (endpoint /leads) et relance de
 * panier abandonné (scheduler). Les compteurs sont en lecture seule (ignorés en écriture).
 *
 * @param leadCaptureEnabled            la capture de leads est-elle active pour l'org (gate endpoint /leads)
 * @param leadCapturePopupEnabled       le popup exit-intent est-il affiché dans le widget (opt-in)
 * @param abandonedCartRecoveryEnabled  la relance de panier abandonné est-elle active
 * @param contactsCaptured              nombre de contacts marketing capturés (org)
 * @param cartsRecovered                nombre de paniers relancés (statut RECOVERY_SENT)
 * @param loyaltyCreditPercent          crédit fidélité gagné par séjour direct (% ; NULL/0 = désactivé)
 * @param referralCreditCents           crédit de parrainage par côté (centimes ; NULL/0 = désactivé)
 */
public record GrowthSettingsDto(
        boolean leadCaptureEnabled,
        boolean leadCapturePopupEnabled,
        boolean abandonedCartRecoveryEnabled,
        long contactsCaptured,
        long cartsRecovered,
        Integer loyaltyCreditPercent,
        Integer referralCreditCents
) {}
