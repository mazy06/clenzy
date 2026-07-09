package com.clenzy.dto;

/** Un tour de conversation de supervision restitué à l'historique (sortie). */
public record SupervisionConversationMessageDto(
        String id,
        String role,     // "operator" | "orchestrator"
        String content,
        String at) {}    // ISO
