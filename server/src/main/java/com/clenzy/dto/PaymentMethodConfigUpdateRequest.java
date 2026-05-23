package com.clenzy.dto;

import java.util.Map;

/**
 * DTO de mise a jour de la configuration d'un fournisseur de paiement.
 *
 * <p>Tous les champs sont optionnels (null = ne pas modifier). Les secrets
 * ({@code apiKey}, {@code apiSecret}, {@code webhookSecret}) sont chiffres
 * cote service avant stockage. {@code configJson} accueille les champs
 * specifiques par provider (par ex. {@code profileId} pour PayTabs,
 * {@code clientId} pour CMI).</p>
 */
public record PaymentMethodConfigUpdateRequest(
    Boolean enabled,
    String countryCodes,
    Boolean sandboxMode,
    String apiKey,
    String apiSecret,
    String webhookSecret,
    Map<String, Object> configJson
) {}
