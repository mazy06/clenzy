package com.clenzy.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Corps de génération IA d'un livret d'accueil (champ IA du Studio livret, gated STUDIO_ASSIST).
 * {@code prompt} = description libre OU lien d'annonce ; {@code language} = langue cible (fr/en/ar).
 */
public record WelcomeGuideAiRequest(
    @NotBlank @Size(max = 4000) String prompt,
    @Size(max = 8) String language
) {}
