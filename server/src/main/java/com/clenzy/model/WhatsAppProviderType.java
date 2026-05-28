package com.clenzy.model;

/**
 * Provider WhatsApp utilise par une organisation.
 *
 * <h3>{@link #META}</h3>
 * Meta WhatsApp Cloud API officielle (graph.facebook.com v18.0). Default
 * historique. Necessite un Meta Business Manager verifie, un numero WhatsApp
 * Business approuve, et un token permanent. Conforme ToS, features completes
 * (templates approuves, boutons interactifs, listes), SLA 99.95%, mais
 * facture par conversation ($0.014-$0.07/conversation).
 *
 * <h3>{@link #OPENWA}</h3>
 * Instance OpenWA self-hosted (whatsapp-web.js via Puppeteer). Provider
 * optionnel, gratuit (hors infra), setup ultra-rapide (scan QR code).
 * <b>Hors ToS Meta</b> — disclaimer obligatoire dans l'UI de configuration.
 * Risque ban du compte WhatsApp en cas d'abus ou de detection automation.
 * Features limitees (texte/media uniquement, pas de templates approuves,
 * pas de boutons interactifs), throughput plafonne (20 msg/min, 200/h).
 * Adapte aux trials, MVP, marches ou Meta n'est pas viable.
 */
public enum WhatsAppProviderType {
    META,
    OPENWA
}
