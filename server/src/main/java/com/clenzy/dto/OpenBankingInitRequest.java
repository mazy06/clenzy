package com.clenzy.dto;

/**
 * Requête pour initier le SCA bancaire d'un consent Open Banking.
 *
 * @param institutionId identifiant de la banque chez GoCardless (ex:
 *                      {@code "BNP_PARIBAS_BNPAFRPP"}, {@code "SANDBOXFINANCE_SFIN0000"}
 *                      pour le sandbox). Liste obtenue via
 *                      {@code GET /api/v2/institutions/?country=FR}.
 * @param provider provider PIS : {@code "GOCARDLESS"} (seul supporté en MVP)
 */
public record OpenBankingInitRequest(
    String institutionId,
    String provider
) {}
