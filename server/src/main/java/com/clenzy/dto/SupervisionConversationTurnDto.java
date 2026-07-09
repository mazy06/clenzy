package com.clenzy.dto;

/** Un tour à persister (entrée du POST) : rôle + contenu. */
public record SupervisionConversationTurnDto(
        String role,     // "operator" | "orchestrator"
        String content) {}
