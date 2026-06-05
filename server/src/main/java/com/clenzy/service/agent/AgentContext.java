package com.clenzy.service.agent;

import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Contexte d'execution d'un tool dans le cadre d'une conversation assistant.
 *
 * <p>Porte les informations d'identite et de contexte UI necessaires aux tools
 * pour resoudre les ressources et respecter la securite multi-tenant :</p>
 * <ul>
 *   <li>{@link #organizationId} : org du user — utilise pour le {@code TenantContext}
 *       et la validation d'ownership en defense en profondeur</li>
 *   <li>{@link #keycloakId} / {@link #jwt} : identite du user, necessaire pour
 *       les services qui font du role-based filtering</li>
 *   <li>{@link #language} : "fr", "en" ou "ar" — utilise par les tools pour
 *       formatter les sorties (dates, devises) cote text</li>
 *   <li>{@link #currentPage} / {@link #selectedPropertyId} : context UI optionnel,
 *       fourni par le frontend pour des reponses plus contextualisees</li>
 * </ul>
 *
 * <p>Ce record est immutable — les tools ne peuvent pas modifier le contexte.</p>
 *
 * @param organizationId    id de l'organisation du user (jamais null)
 * @param keycloakId        sujet JWT du user (jamais null)
 * @param jwt               JWT complet (porte les roles). Peut etre null en test.
 * @param language          code langue ISO ("fr" par defaut)
 * @param currentPage       slug de la page courante cote frontend, null si inconnu
 * @param selectedPropertyId propriete actuellement selectionnee dans l'UI, null si aucune
 * @param modelOverride     modele LLM specifique pour CE tour (null = defaut provider).
 *                          Utilise par les briefings pour forcer Haiku (cout ~10x moindre).
 * @param aiProvider        provider LLM effectif pour CE tour ("anthropic"/"openai"/...),
 *                          null = anthropic. Propage au flow multi-agent (orchestrateur +
 *                          specialists) pour router vers la bonne implementation.
 * @param aiBaseUrl         base URL du provider (modeles plateforme OpenAI-compatibles), null = defaut.
 */
public record AgentContext(
        Long organizationId,
        String keycloakId,
        Jwt jwt,
        String language,
        String currentPage,
        Long selectedPropertyId,
        String modelOverride,
        String aiProvider,
        String aiBaseUrl
) {

    public AgentContext {
        if (organizationId == null) {
            throw new IllegalArgumentException("AgentContext.organizationId cannot be null");
        }
        if (keycloakId == null || keycloakId.isBlank()) {
            throw new IllegalArgumentException("AgentContext.keycloakId cannot be null/blank");
        }
        if (language == null || language.isBlank()) {
            language = "fr";
        }
    }

    /** Constructeur "legacy" — preserve la signature avant ajout du modelOverride. */
    public AgentContext(Long organizationId, String keycloakId, Jwt jwt, String language,
                          String currentPage, Long selectedPropertyId) {
        this(organizationId, keycloakId, jwt, language, currentPage, selectedPropertyId, null, null, null);
    }

    /** Constructeur avant l'ajout du routage provider (modelOverride seul). */
    public AgentContext(Long organizationId, String keycloakId, Jwt jwt, String language,
                          String currentPage, Long selectedPropertyId, String modelOverride) {
        this(organizationId, keycloakId, jwt, language, currentPage, selectedPropertyId, modelOverride, null, null);
    }

    /** Helper pour les tests — context minimal sans JWT ni UI hints. */
    public static AgentContext minimal(Long organizationId, String keycloakId) {
        return new AgentContext(organizationId, keycloakId, null, "fr", null, null, null, null, null);
    }

    /** Retourne une copie avec un model override. Immuable (record). */
    public AgentContext withModelOverride(String model) {
        return new AgentContext(organizationId, keycloakId, jwt, language,
                currentPage, selectedPropertyId, model, aiProvider, aiBaseUrl);
    }

    /**
     * Retourne une copie ciblant un modele + provider + base URL (routage assistant
     * multi-provider). Propage aux specialists multi-agents via le contexte.
     */
    public AgentContext withAiTarget(String model, String provider, String baseUrl) {
        return new AgentContext(organizationId, keycloakId, jwt, language,
                currentPage, selectedPropertyId, model, provider, baseUrl);
    }
}
