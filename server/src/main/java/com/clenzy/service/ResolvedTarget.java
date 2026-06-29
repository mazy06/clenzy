package com.clenzy.service;

/**
 * Cible IA résolue depuis la config DB plateforme : provider effectif, modèle, clé API,
 * base URL et source de la clé.
 *
 * <p>Value object UNIQUE partagé par les deux mondes de consommation :
 * <ul>
 *   <li>one-shot (features design/pricing/sentiment…) via {@code AiProviderRouter} ;</li>
 *   <li>streaming (assistant + superviseur) via {@code FailoverChatLLMProvider}.</li>
 * </ul>
 * Remplace les anciens {@code AiKeyResolver.ResolvedKey} et
 * {@code AssistantTargetResolver.ChatTarget} (mêmes sémantiques : {@code provider} = ex-providerName,
 * {@code model} = ex-modelOverride). Résolu par {@link AiTargetResolver}.</p>
 *
 * @param provider nom du provider effectif (peut différer du provider demandé en cas de fallback)
 * @param model    modèle à utiliser (null = défaut du provider)
 * @param apiKey   clé API résolue (null = aucune config → erreur gracieuse côté streaming)
 * @param baseUrl  URL de base du provider (null = défaut du provider)
 * @param source   d'où vient la clé (exempte le BYOK de l'enforcement de budget)
 */
public record ResolvedTarget(String provider, String model, String apiKey, String baseUrl, KeySource source) {
}
