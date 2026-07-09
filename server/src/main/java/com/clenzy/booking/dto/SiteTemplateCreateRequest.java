package com.clenzy.booking.dto;

/**
 * Création d'un template de site. {@code scope} : "GLOBAL" (catalogue Clenzy — staff plateforme
 * uniquement) ou "ORG" (privé à l'organisation, défaut). {@code contentJson} = le template.json
 * (thème + pages + customCss/Js) sérialisé depuis le design courant.
 */
public record SiteTemplateCreateRequest(
    String name,
    String description,
    String register,
    String previewUrl,
    String contentJson,
    String scope,
    Long designSystemId
) {}
