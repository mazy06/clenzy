package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionAutoRuleDto;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.clenzy.service.agent.supervision.SupervisionAutomatableTypes.AutomatableType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Config org-level des règles d'auto-application PAR TYPE (Vagues 1-2 autonomie).
 *
 * <p>Le catalogue des types automatisables — et le <b>niveau maximum</b> de
 * chacun — est fixé côté serveur ({@link SupervisionAutomatableTypes}, partagé
 * avec le gate). Une org sans ligne pour un type = tout OFF (opt-in total). Le
 * plafond du module reste porté par {@link SupervisionModuleSettings} : il est
 * exposé en lecture pour que l'UI affiche « plafonné par le niveau de l'agent »
 * quand il bride la règle ; le max du type borne en plus le sélecteur (les
 * cautions et le blocage calendrier ne sont jamais silencieux).</p>
 */
@Service
public class SupervisionAutoRuleService {

    private final SupervisionAutoRuleRepository autoRuleRepository;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final SupervisionModuleRegistry moduleRegistry;
    private final SupervisionCardTrustService cardTrustService;
    private final ObjectMapper objectMapper;
    private final java.time.Clock clock;

    public SupervisionAutoRuleService(SupervisionAutoRuleRepository autoRuleRepository,
                                      SupervisionModuleSettingsRepository moduleSettingsRepository,
                                      SupervisionModuleRegistry moduleRegistry,
                                      SupervisionCardTrustService cardTrustService,
                                      ObjectMapper objectMapper,
                                      java.time.Clock clock) {
        this.autoRuleRepository = autoRuleRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.moduleRegistry = moduleRegistry;
        this.cardTrustService = cardTrustService;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /** Règles effectives de l'org : une entrée par type du catalogue (défaut OFF). */
    @Transactional(readOnly = true)
    public List<SupervisionAutoRuleDto> getRules(Long organizationId) {
        final Map<String, SupervisionAutoRule> byType = autoRuleRepository
                .findByOrganizationId(organizationId).stream()
                .collect(Collectors.toMap(SupervisionAutoRule::getActionType,
                        Function.identity(), (a, b) -> a));
        return SupervisionAutomatableTypes.CATALOG.stream()
                .map(type -> toDto(organizationId, type, byType.get(type.actionType())))
                .toList();
    }

    /**
     * Upsert des règles fournies (types inconnus du catalogue ignorés
     * défensivement, comme la config des modules). Renvoie l'état recalculé.
     */
    @Transactional
    public List<SupervisionAutoRuleDto> updateRules(Long organizationId,
                                                    List<SupervisionAutoRuleDto> updates) {
        if (updates != null) {
            for (SupervisionAutoRuleDto update : updates) {
                final Optional<AutomatableType> type = update == null || update.actionType() == null
                        ? Optional.empty()
                        : SupervisionAutomatableTypes.find(update.actionType());
                if (type.isEmpty()) {
                    continue; // type inconnu / non automatisable → ignoré
                }
                final SupervisionAutoRule rule = autoRuleRepository
                        .findByOrganizationIdAndActionType(organizationId, update.actionType())
                        .orElseGet(() -> new SupervisionAutoRule(organizationId, update.actionType()));
                rule.setEnabled(update.enabled());
                rule.setLevel(clampToTypeMax(parseLevel(update.level()), type.get()));
                rule.setEnvelope(validateEnvelope(update.envelope()));
                if (update.enabled()) {
                    // Règles de Confiance (V3) : « Activer » consomme la suggestion.
                    rule.setSuggestedAt(null);
                }
                autoRuleRepository.save(rule);
            }
        }
        return getRules(organizationId);
    }

    /**
     * « Ignorer » la suggestion d'automatisation d'un type (Règles de Confiance
     * des cartes, V3) : la suggestion active est effacée et un cooldown de
     * re-suggestion de 30 j est posé. No-op si aucune règle / suggestion.
     */
    @Transactional
    public List<SupervisionAutoRuleDto> dismissSuggestion(Long organizationId, String actionType) {
        autoRuleRepository.findByOrganizationIdAndActionType(organizationId, actionType)
                .ifPresent(rule -> {
                    rule.setSuggestedAt(null);
                    rule.setSuggestionDismissedAt(clock.instant());
                    autoRuleRepository.save(rule);
                });
        return getRules(organizationId);
    }

    /** Niveau d'une règle : NOTIFY ou FULL uniquement (SUGGEST = pas de règle). */
    private static SupervisionAutonomy parseLevel(String wire) {
        final SupervisionAutonomy level = SupervisionAutonomy.fromWire(wire);
        if (level != SupervisionAutonomy.NOTIFY && level != SupervisionAutonomy.FULL) {
            throw new IllegalArgumentException(
                    "Niveau de règle invalide (attendu notify|full) : " + wire);
        }
        return level;
    }

    /**
     * Borne le niveau demandé au MAX du type (catalogue) : FULL demandé sur un
     * type N1 (cautions, blocage calendrier) est ramené à NOTIFY — l'UI ne le
     * propose pas, et le gate re-borne de toute façon (défense en profondeur).
     */
    private static SupervisionAutonomy clampToTypeMax(SupervisionAutonomy requested,
                                                      AutomatableType type) {
        return requested.ordinal() <= type.maxLevel().ordinal() ? requested : type.maxLevel();
    }

    /** L'enveloppe doit être un objet JSON valide (null/blank accepté = défauts serveur). */
    private String validateEnvelope(String envelope) {
        if (envelope == null || envelope.isBlank()) {
            return null;
        }
        try {
            objectMapper.readValue(envelope, Map.class);
            return envelope;
        } catch (Exception e) {
            throw new IllegalArgumentException("L'enveloppe doit être un objet JSON valide");
        }
    }

    private SupervisionAutoRuleDto toDto(Long organizationId, AutomatableType type,
                                         SupervisionAutoRule rule) {
        final SupervisionAutonomy storedLevel = rule != null && rule.getLevel() != null
                ? rule.getLevel() : SupervisionAutonomy.NOTIFY;
        // Suggestion d'automatisation active (Règles de Confiance V3) : exposée
        // seulement si le type est encore OFF ; le nb d'approbations consécutives
        // est recalculé pour le libellé du chip (« Recommandé — N approbations »).
        final boolean suggested = rule != null && !rule.isEnabled() && rule.getSuggestedAt() != null;
        return new SupervisionAutoRuleDto(
                type.actionType(),
                type.moduleKey(),
                rule != null && rule.isEnabled(),
                clampToTypeMax(storedLevel, type).toWire(),
                rule != null ? rule.getEnvelope() : null,
                moduleCeiling(organizationId, type.moduleKey()).toWire(),
                type.maxLevel().toWire(),
                suggested ? rule.getSuggestedAt().toString() : null,
                suggested ? cardTrustService.consecutiveHumanApprovals(organizationId, type.actionType()) : 0L);
    }

    /** Plafond effectif du module : override org, sinon défaut catalogue (SUGGEST). */
    private SupervisionAutonomy moduleCeiling(Long organizationId, String moduleKey) {
        return moduleSettingsRepository.findByOrganizationIdAndModuleKey(organizationId, moduleKey)
                .map(settings -> settings.isEnabled()
                        ? settings.getAutonomyLevel() : SupervisionAutonomy.SUGGEST)
                .orElseGet(() -> moduleRegistry.find(moduleKey)
                        .map(SupervisionModuleRegistry.SupervisionModule::defaultAutonomy)
                        .orElse(SupervisionAutonomy.SUGGEST));
    }
}
