package com.clenzy.dto;

/**
 * Brouillon de livret d'accueil généré par l'IA (champ IA du Studio livret). {@code sections} et
 * {@code pois} sont des chaînes JSON de tableaux (mêmes formats que {@code WelcomeGuide.sections} /
 * {@code WelcomeGuide.pois}, parsés côté front). {@code pois} = recommandations du quartier ;
 * {@code area} = ville/quartier inféré (contexte de géocodage côté front).
 */
public record GeneratedGuideDto(String welcomeMessage, String sections, String pois, String area) {}
