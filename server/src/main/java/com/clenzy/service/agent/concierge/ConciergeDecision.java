package com.clenzy.service.agent.concierge;

/**
 * Décision du concierge sur un message guest entrant (C2).
 *
 * @param autoSendSafe l'agent peut-il envoyer sa réponse SANS validation humaine ?
 *                     Conservateur : {@code true} uniquement pour une intention
 *                     FAQ claire, sans aucun signal de risque.
 * @param reason       motif (audit / feed) : {@code faq}, {@code risk_or_negative},
 *                     {@code not_whitelisted}.
 */
public record ConciergeDecision(boolean autoSendSafe, String reason) {}
