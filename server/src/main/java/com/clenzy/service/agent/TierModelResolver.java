package com.clenzy.service.agent;

import com.clenzy.model.AiFeature;
import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.PlatformAiFeatureModelRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/**
 * Resolution du modele LLM effectif pour un {@link AgentTier} donne
 * (ticket T-03, ADR-004) — pilote par la CONFIG DYNAMIQUE EN BASE depuis le
 * 2026-07-02 (decision utilisateur : plus de map en properties Spring).
 *
 * <p>Les tiers sont deux features du systeme de config plateforme existant
 * ({@code platform_ai_feature_model}, UI Parametres > IA > Modeles) :
 * {@link AiFeature#ASSISTANT_SMALL} et {@link AiFeature#ASSISTANT_STRONG}.
 * Assigner un modele a la feature ACTIVE le tier ; pas d'assignation = pas de
 * tiering (fallback strict = comportement actuel). Le probe de disponibilite
 * quotidien s'applique : un modele tier UNAVAILABLE est ignore.</p>
 *
 * <p><b>Garde meme-provider (note BYOK, ADR-004)</b> : le modele tier n'est
 * retenu que si son provider correspond au provider deja resolu du contexte
 * (Settings/BYOK via AiTargetResolver) — l'appel repart avec la cle du
 * contexte, jamais celle du modele tier. Provider different (ex. contexte
 * NVIDIA, tier configure anthropic) → modele du contexte inchange.</p>
 */
@Component
public class TierModelResolver {

    private final PlatformAiFeatureModelRepository featureModelRepository;

    public TierModelResolver(PlatformAiFeatureModelRepository featureModelRepository) {
        this.featureModelRepository = featureModelRepository;
    }

    /**
     * Resout le modele a utiliser pour un tier et un provider donnes.
     *
     * @param tier         tier demande par le role d'agent (null = STANDARD)
     * @param provider     provider effectif du contexte (ex. "anthropic") ; null = defaut anthropic
     * @param contextModel modele resolu du contexte (Settings/BYOK) — fallback systematique
     * @return le modele du tier si configure en base (meme provider, non UNAVAILABLE),
     *         sinon {@code contextModel}
     */
    @Transactional(readOnly = true)
    public String resolveModel(AgentTier tier, String provider, String contextModel) {
        if (tier == null || tier == AgentTier.STANDARD) {
            return contextModel;
        }
        AiFeature feature = (tier == AgentTier.SMALL)
                ? AiFeature.ASSISTANT_SMALL
                : AiFeature.ASSISTANT_STRONG;
        PlatformAiModel tierModel = featureModelRepository.findByFeature(feature.name())
                .map(assignment -> assignment.getModel())
                .orElse(null);
        if (tierModel == null
                || tierModel.getModelId() == null || tierModel.getModelId().isBlank()
                || tierModel.getAvailabilityStatus() == AiModelAvailability.UNAVAILABLE) {
            return contextModel;
        }
        String contextProvider = provider != null && !provider.isBlank()
                ? provider.toLowerCase(Locale.ROOT) : "anthropic";
        String tierProvider = tierModel.getProvider() != null
                ? tierModel.getProvider().toLowerCase(Locale.ROOT) : "";
        return contextProvider.equals(tierProvider) ? tierModel.getModelId() : contextModel;
    }
}
