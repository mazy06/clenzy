package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Brief utilisateur pour la génération complète d'un site par IA (P2.a booking engine) : un cahier des
 * charges minimal à partir duquel {@code SiteGenerationService} dérive un thème + un set de pages
 * (HOME / liste / contact / à propos) rédigées et structurées par le LLM, en BROUILLON.
 *
 * @param propertyType    nature des biens (« riad de luxe », « appartement urbain », « chalet »…) — guide
 *                        le ton, le vocabulaire et les sections proposées.
 * @param tone            style / ambiance souhaités (« chaleureux et authentique », « épuré et moderne »…).
 * @param brandName       nom de marque à afficher (optionnel ; repli = nom du site).
 * @param primaryColorHint indice de couleur primaire (hex ou nom de couleur libre) ; sinon le LLM choisit.
 * @param languages       locales à générer (la 1re = langue source rédigée par le LLM ; les autres sont
 *                        produites en suite par l'auto-traduction {@code ContentTranslationService}).
 */
public record SiteGenerationBrief(
    @NotBlank String propertyType,
    String tone,
    String brandName,
    String primaryColorHint,
    List<String> languages
) {}
