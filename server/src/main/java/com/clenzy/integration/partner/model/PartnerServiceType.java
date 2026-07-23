package com.clenzy.integration.partner.model;

/**
 * Services du catalogue Integrations couverts par le scaffolding generique
 * (stockage de credentials chiffrees, flux metier a brancher provider par
 * provider). La colonne provider_type (changeset 0360) n'a volontairement pas
 * de contrainte CHECK : cet enum est la seule source de validation, un
 * nouveau provider s'ajoute donc ici sans migration.
 */
public enum PartnerServiceType {
    // Marketing & CRM
    MAILCHIMP,
    KLAVIYO,
    PIPEDRIVE,
    // Menage & operations
    TURNO,
    PROPERLY,
    BREEZEWAY,
    // Fiscalite / taxe de sejour / facturation electronique
    MYTSE,
    AVALARA,
    EFACTURE_DGI_MA,
    // Assurance & screening
    SUPERHOG,
    SAFELY,
    AXA_PARTNERS,
    TAWUNIYA,
    // Avis & reputation
    REVINATE,
    TRUSTYOU,
    HIJIFFY,
    // Automatisation (webhooks sortants : serverUrl = URL du webhook,
    // apiKey = secret de signature HMAC)
    ZAPIER,
    MAKE,
    // Experience guest
    DUVE,
    ENSO_CONNECT
}
