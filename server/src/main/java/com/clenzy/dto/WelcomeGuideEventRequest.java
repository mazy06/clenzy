package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Capture d'un evenement guest depuis la page publique du livret.
 * {@code eventType} doit correspondre a {@link com.clenzy.model.WelcomeGuideEventType}
 * (les types inconnus sont ignores cote serveur, sans erreur).
 */
public record WelcomeGuideEventRequest(
        @NotBlank String eventType,
        @Size(max = 255) String detail) {}
