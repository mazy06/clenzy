package com.clenzy.dto;

/**
 * Réponse au call d'initialisation Open Banking : contient l'URL à ouvrir
 * dans le navigateur de l'admin pour signer le SCA bancaire.
 *
 * @param redirectUrl URL hébergée par le provider PIS (GoCardless) où l'admin
 *                    va s'authentifier auprès de sa banque et valider le
 *                    consent. Au retour, le browser reviendra sur
 *                    {@code /api/owner-payout-config/openbanking/callback?ref=...}.
 * @param requisitionId ID de requisition côté provider (à stocker
 *                      temporairement en BDD pour finalize au callback).
 */
public record OpenBankingInitResponse(
    String redirectUrl,
    String requisitionId
) {}
