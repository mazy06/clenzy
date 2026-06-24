package com.clenzy.dto;

/**
 * Brouillon de livret d'accueil généré par l'IA (champ IA du Studio livret). {@code sections} est une
 * chaîne JSON d'un tableau de sections (même format que {@code WelcomeGuide.sections}, parsé côté front).
 */
public record GeneratedGuideDto(String welcomeMessage, String sections) {}
