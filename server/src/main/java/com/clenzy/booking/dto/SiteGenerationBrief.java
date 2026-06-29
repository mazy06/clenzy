package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Brief utilisateur pour la génération complète d'un site par IA (P2.a booking engine) : un cahier des
 * charges à partir duquel {@code SiteGenerationService} dérive un thème + un set de pages rédigées et
 * structurées par le LLM, en BROUILLON. Le « constructeur de prompt » du Studio compose ce brief de
 * façon standardisée (champs structurés) pour optimiser la requête.
 *
 * @param propertyType    nature des biens (« riad de luxe », « appartement urbain », « chalet »…) — guide
 *                        le ton, le vocabulaire et les sections proposées.
 * @param tone            style / ambiance souhaités (« chaleureux et authentique », « épuré et moderne »…).
 * @param brandName       nom de marque à afficher (optionnel ; repli = nom du site).
 * @param primaryColorHint indice de couleur primaire (hex ou nom de couleur libre) ; sinon le LLM choisit.
 * @param languages       locales à générer (la 1re = langue source rédigée par le LLM ; les autres sont
 *                        produites en suite par l'auto-traduction {@code ContentTranslationService}).
 * @param audience        clientèle cible (« familles », « couples », « voyageurs d'affaires »…).
 * @param goal            objectif principal / appel à l'action (« réservation directe », « demande de devis »…).
 * @param tier            niveau de gamme (« économique », « premium », « luxe »…).
 * @param location        localisation / destination (ville, région) — utile au contenu et au SEO local.
 * @param currency        devise d'affichage souhaitée (code ISO, ex. « EUR », « MAD »).
 * @param usps            points forts à mettre en avant (« sans commission », « conciergerie 24/7 »…).
 * @param pages           clés des pages à générer, dans l'ordre (cf. {@code SiteGenerationPrompts.PAGE_CATALOG}) ;
 *                        {@code null}/vide → set par défaut (accueil / logements / à-propos / contact).
 */
public record SiteGenerationBrief(
    @NotBlank String propertyType,
    String tone,
    String brandName,
    String primaryColorHint,
    List<String> languages,
    String audience,
    String goal,
    String tier,
    String location,
    String currency,
    List<String> usps,
    List<String> pages
) {
    /** Constructeur de compat (brief minimal historique) : les champs structurés restent {@code null}. */
    public SiteGenerationBrief(String propertyType, String tone, String brandName,
                               String primaryColorHint, List<String> languages) {
        this(propertyType, tone, brandName, primaryColorHint, languages, null, null, null, null, null, null, null);
    }
}
