package com.clenzy.dto;

import java.util.List;

/**
 * Les photos de fin de mission d'une intervention.
 *
 * <p>Ce sont elles, et elles seules, qui conditionnent le paiement du
 * prestataire : {@code HousekeeperPayoutService.isProofComplete} n'accepte la
 * complétion que si au moins une photo de phase « après » existe.</p>
 *
 * <p>La carte les montre avant le geste. Sans elles, « Terminer déclenche le
 * paiement » restait une phrase abstraite ; avec elles, on voit ce qu'on
 * atteste — ou l'absence de ce qu'on atteste.</p>
 *
 * @param photos tableau JSON de données en base64, tel que le produit
 *               {@code InterventionPhotoService} — le même format que celui
 *               déjà servi à l'écran des interventions
 * @param proofComplete vrai si au moins une photo de fin existe, donc si le
 *                      paiement pourra effectivement partir
 */
public record InterventionProofDto(String photos, boolean proofComplete) {}
