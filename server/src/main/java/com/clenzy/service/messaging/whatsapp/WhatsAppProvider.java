package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;

/**
 * Abstraction des operations d'envoi WhatsApp, implementee une fois par
 * {@link WhatsAppProviderType}. Permet de basculer entre Meta Cloud API et
 * OpenWA self-hosted sans modifier le code metier ({@code WhatsAppChannel},
 * {@code BriefingDelivery}, {@code GuestMessagingService}).
 *
 * <h3>Resolution du provider</h3>
 * {@link WhatsAppProviderResolver} examine la {@link WhatsAppConfig} de l'org
 * et retourne la bonne implementation. Le code appelant n'a donc jamais a
 * faire {@code if (config.getProvider() == META) ... else ...}.
 *
 * <h3>Garanties</h3>
 * <ul>
 *   <li>Les exceptions transversales (timeout, 5xx, service indispo) doivent
 *       remonter en {@link RuntimeException}. Le circuit breaker au niveau
 *       channel se chargera de la resilience.</li>
 *   <li>Le {@code messageId} retourne doit etre unique par-provider mais
 *       opaque pour le code appelant (juste utilise pour journalisation).</li>
 *   <li>{@code sendTemplateMessage} peut throw {@link UnsupportedOperationException}
 *       si le provider ne supporte pas les templates (cas OpenWA). Le code
 *       appelant doit catch et fallback sur sendTextMessage.</li>
 * </ul>
 */
public interface WhatsAppProvider {

    /**
     * Retourne le type de provider implemente. Utilise par le resolver pour
     * faire la correspondance config -> instance Spring.
     */
    WhatsAppProviderType getProviderType();

    /**
     * Envoie un message texte simple. Cap a 4096 caracteres cote Meta,
     * limite plus lache cote OpenWA mais on garde la meme contrainte pour
     * coherence comportementale.
     *
     * @param config configuration de l'org (token / sessionId / etc.)
     * @param phoneNumber numero E.164 (ex: +33612345678)
     * @param text texte brut, max 4096 chars
     * @return ID du message tel que retourne par le provider
     * @throws RuntimeException si l'envoi echoue (transitoire ou permanent)
     */
    String sendTextMessage(WhatsAppConfig config, String phoneNumber, String text);

    /**
     * Envoie un message via un template pre-approuve (Meta only).
     *
     * @throws UnsupportedOperationException si le provider ne supporte pas
     *         les templates (OpenWA). Le code appelant doit catch et
     *         fallback sur {@link #sendTextMessage}.
     */
    String sendTemplateMessage(WhatsAppConfig config, String phoneNumber,
                                String templateName, String language);

    /**
     * Marque un message recu comme "lu" pour mettre a jour le read receipt
     * cote interlocuteur. Best-effort, ne doit jamais throw — log et continue.
     */
    void markAsRead(WhatsAppConfig config, String messageId);
}
