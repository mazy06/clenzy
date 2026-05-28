package com.clenzy.dto;

import com.clenzy.model.WhatsAppProviderType;

/**
 * Patch request pour {@link com.clenzy.model.WhatsAppConfig}. Tous les champs
 * sont optionnels (null = ne pas modifier). L'UI envoie uniquement ce qui a
 * change. Le controller fait le merge selectif sur l'entite existante.
 */
public record UpdateWhatsAppConfigRequest(
    /** Bascule le provider actif. META par defaut, OPENWA en mode self-hosted. */
    WhatsAppProviderType provider,
    // ─── Meta Cloud API ──────────────────────────────────────────────
    String apiToken,
    String phoneNumberId,
    String businessAccountId,
    String webhookVerifyToken,
    // ─── OpenWA self-hosted ──────────────────────────────────────────
    String openwaSessionId,
    String openwaApiKey,
    // ─── Common ──────────────────────────────────────────────────────
    Boolean enabled
) {}
