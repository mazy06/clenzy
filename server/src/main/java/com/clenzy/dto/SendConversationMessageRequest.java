package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;

public record SendConversationMessageRequest(
    @NotBlank String content,
    String contentHtml,
    /**
     * true = note d'equipe, consignee dans le fil sans etre transmise au
     * voyageur. Absent ou false = reponse reelle, livree sur le canal.
     * Boolean (et non boolean) : un ancien client qui n'envoie pas le champ
     * doit continuer a produire un message reel, pas un NullPointerException.
     */
    Boolean internalNote
) {
    /** Message reel (forme historique, sans drapeau) — garde les appelants compilables. */
    public SendConversationMessageRequest(String content, String contentHtml) {
        this(content, contentHtml, null);
    }

    /** Le champ est optionnel : son absence vaut « message reel ». */
    public boolean isInternalNote() {
        return Boolean.TRUE.equals(internalNote);
    }
}
