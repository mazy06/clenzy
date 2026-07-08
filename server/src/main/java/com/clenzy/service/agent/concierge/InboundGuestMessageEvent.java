package com.clenzy.service.agent.concierge;

/**
 * Événement applicatif émis après enregistrement d'un message guest ENTRANT
 * (org-scopé). Consommé par le {@link ConciergeAgentService} en {@code @Async}
 * post-commit pour générer un brouillon de réponse IA (C1). Découplé : la couche
 * messagerie ne dépend pas du concierge.
 */
public record InboundGuestMessageEvent(Long organizationId, Long conversationId) {}
