package com.clenzy.service.agent;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Resolution du modele LLM effectif pour un {@link AgentTier} donne
 * (ticket T-03, ADR-004).
 *
 * <p>Configuration ({@code application.yml} / env — mapping PAR PROVIDER,
 * un id de modele n'etant valide que chez son provider) :</p>
 * <pre>
 * clenzy:
 *   assistant:
 *     tiering:
 *       enabled: true
 *       small:
 *         anthropic: claude-haiku-4-5
 *         openai: gpt-5-mini
 *       strong:
 *         anthropic: claude-opus-4-1
 * </pre>
 *
 * <p><b>Fallback strict = comportement actuel</b> : tiering desactive, tier
 * {@link AgentTier#STANDARD}, provider inconnu ou mapping absent → le modele
 * du contexte (resolu pour ASSISTANT_CHAT via AiTargetResolver) est retourne
 * tel quel. Aucun changement de comportement tant que la config n'est pas
 * posee — deploiement sans risque, activation mesuree via les metriques T-01
 * ({@code assistant.tokens{model}} / {@code assistant.cost.usd}).</p>
 *
 * <p>Note BYOK : le modele tier est envoye avec la cle deja resolue (BYOK ou
 * plateforme) du provider courant — le mapping par provider garantit la
 * validite de l'id, la cle reste inchangee.</p>
 */
@Component
@ConfigurationProperties(prefix = "clenzy.assistant.tiering")
public class TierModelResolver {

    private boolean enabled = false;
    /** provider (minuscules) → model id du tier petit. */
    private Map<String, String> small = new HashMap<>();
    /** provider (minuscules) → model id du tier fort. */
    private Map<String, String> strong = new HashMap<>();

    /**
     * Resout le modele a utiliser pour un tier et un provider donnes.
     *
     * @param tier         tier demande par le role d'agent (null = STANDARD)
     * @param provider     provider effectif du contexte (ex. "anthropic") ; null = defaut anthropic
     * @param contextModel modele resolu du contexte (Settings/BYOK) — fallback systematique
     * @return le modele du tier si configure, sinon {@code contextModel}
     */
    public String resolveModel(AgentTier tier, String provider, String contextModel) {
        if (!enabled || tier == null || tier == AgentTier.STANDARD) {
            return contextModel;
        }
        Map<String, String> mapping = (tier == AgentTier.SMALL) ? small : strong;
        String key = provider != null && !provider.isBlank()
                ? provider.toLowerCase(Locale.ROOT) : "anthropic";
        String tierModel = mapping.get(key);
        return (tierModel != null && !tierModel.isBlank()) ? tierModel : contextModel;
    }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Map<String, String> getSmall() { return small; }
    public void setSmall(Map<String, String> small) { this.small = small; }
    public Map<String, String> getStrong() { return strong; }
    public void setStrong(Map<String, String> strong) { this.strong = strong; }
}
