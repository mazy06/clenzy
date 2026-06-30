package com.clenzy.service;

import com.clenzy.model.AiModelAvailability;
import com.clenzy.model.PlatformAiModel;
import com.clenzy.repository.PlatformAiModelRepository;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Suggère un modèle IA de remplacement quand un modèle devient indisponible.
 *
 * <p>Partagé par les deux chemins de détection : le probe quotidien
 * ({@code PlatformAiConfigService}) et le 410 Gone runtime
 * ({@code AiModelDeprecationListener}). Un remplaçant = même provider,
 * actuellement DISPONIBLE, modelId le plus similaire (tokens partagés :
 * famille/taille/variante, ex. {@code llama}/{@code 70b}/{@code instruct}).</p>
 *
 * <p>On suggère un modèle <b>déjà configuré</b> (donc directement réassignable à
 * une feature), pas un modèle du catalogue à ajouter.</p>
 */
@Service
public class AiModelReplacementSuggester {

    private final PlatformAiModelRepository modelRepository;

    public AiModelReplacementSuggester(PlatformAiModelRepository modelRepository) {
        this.modelRepository = modelRepository;
    }

    /** Phrase prête à concaténer à une notif (vide si aucun remplaçant). */
    public String sentence(String providerHint, String modelId, Long excludeId) {
        return suggest(providerHint, modelId, excludeId)
                .map(s -> " Suggestion de remplacement : « " + s.getName() + " » ("
                        + s.getProvider() + " / " + s.getModelId() + "), actuellement disponible.")
                .orElse("");
    }

    /** Meilleur remplaçant : même provider, disponible, modelId le plus similaire. */
    public Optional<PlatformAiModel> suggest(String providerHint, String modelId, Long excludeId) {
        List<PlatformAiModel> all = modelRepository.findAll();
        // Provider effectif : celui du modèle tombé retrouvé en base par modelId
        // (gère un libellé d'event ≠ clé provider, ex. « NVIDIA Build » vs « nvidia »),
        // sinon le hint fourni.
        String provider = all.stream()
                .filter(m -> modelId != null && modelId.equalsIgnoreCase(m.getModelId()))
                .map(PlatformAiModel::getProvider)
                .findFirst()
                .orElse(providerHint);
        if (provider == null || provider.isBlank()) {
            return Optional.empty();
        }
        Set<String> target = tokens(modelId);
        return all.stream()
                .filter(c -> excludeId == null || !excludeId.equals(c.getId()))
                .filter(c -> provider.equalsIgnoreCase(c.getProvider()))
                .filter(c -> c.getAvailabilityStatus() == AiModelAvailability.AVAILABLE)
                .filter(c -> c.getModelId() != null && !c.getModelId().isBlank())
                .filter(c -> modelId == null || !modelId.equalsIgnoreCase(c.getModelId()))
                .max(Comparator.comparingInt(c -> overlap(target, tokens(c.getModelId()))));
    }

    /** Tokens normalisés d'un modelId (séparateurs /, -, ., _). */
    private static Set<String> tokens(String modelId) {
        if (modelId == null || modelId.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(modelId.toLowerCase().split("[^a-z0-9]+"))
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }

    private static int overlap(Set<String> a, Set<String> b) {
        int n = 0;
        for (String t : a) {
            if (b.contains(t)) {
                n++;
            }
        }
        return n;
    }
}
