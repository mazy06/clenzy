package com.clenzy.service.agent.supervision;

import com.clenzy.dto.SupervisionAutoRuleDto;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionAutonomy;
import com.clenzy.model.SupervisionModuleSettings;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionModuleSettingsRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Config org-level des règles d'auto-application PAR TYPE (Vague 1 autonomie).
 *
 * <p>Le catalogue des types automatisables est fixé côté serveur
 * ({@link #AUTOMATABLE_TYPES} — V1 : 3 types sans risque). Une org sans ligne
 * pour un type = tout OFF (opt-in total). Le plafond du module reste porté par
 * {@link SupervisionModuleSettings} : il est exposé en lecture pour que l'UI
 * affiche « plafonné par le niveau de l'agent » quand il bride la règle.</p>
 */
@Service
public class SupervisionAutoRuleService {

    /**
     * Catalogue V1 des types automatisables → module (agent) porteur. Les types
     * V2/V3 de la matrice (CALENDAR_BLOCK, DEPOSIT_*, PAYMENT_REMINDER) ne sont
     * PAS exposés : ils arriveront avec leur vague (l'UI ne les affiche pas).
     */
    static final Map<String, String> AUTOMATABLE_TYPES;
    static {
        final Map<String, String> types = new LinkedHashMap<>();
        types.put(SupervisionActionType.CLEANING_REQUEST, "ops");
        types.put(SupervisionActionType.REVIEW_DRAFT_REPLY, "rep");
        types.put(SupervisionActionType.PRICE_DROP, "rev");
        AUTOMATABLE_TYPES = java.util.Collections.unmodifiableMap(types);
    }

    private final SupervisionAutoRuleRepository autoRuleRepository;
    private final SupervisionModuleSettingsRepository moduleSettingsRepository;
    private final SupervisionModuleRegistry moduleRegistry;
    private final ObjectMapper objectMapper;

    public SupervisionAutoRuleService(SupervisionAutoRuleRepository autoRuleRepository,
                                      SupervisionModuleSettingsRepository moduleSettingsRepository,
                                      SupervisionModuleRegistry moduleRegistry,
                                      ObjectMapper objectMapper) {
        this.autoRuleRepository = autoRuleRepository;
        this.moduleSettingsRepository = moduleSettingsRepository;
        this.moduleRegistry = moduleRegistry;
        this.objectMapper = objectMapper;
    }

    /** Règles effectives de l'org : une entrée par type du catalogue V1 (défaut OFF). */
    @Transactional(readOnly = true)
    public List<SupervisionAutoRuleDto> getRules(Long organizationId) {
        final Map<String, SupervisionAutoRule> byType = autoRuleRepository
                .findByOrganizationId(organizationId).stream()
                .collect(Collectors.toMap(SupervisionAutoRule::getActionType,
                        Function.identity(), (a, b) -> a));
        return AUTOMATABLE_TYPES.entrySet().stream()
                .map(entry -> toDto(organizationId, entry.getKey(), entry.getValue(),
                        byType.get(entry.getKey())))
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
                if (update == null || update.actionType() == null
                        || !AUTOMATABLE_TYPES.containsKey(update.actionType())) {
                    continue; // type inconnu / non automatisable → ignoré
                }
                final SupervisionAutoRule rule = autoRuleRepository
                        .findByOrganizationIdAndActionType(organizationId, update.actionType())
                        .orElseGet(() -> new SupervisionAutoRule(organizationId, update.actionType()));
                rule.setEnabled(update.enabled());
                rule.setLevel(parseLevel(update.level()));
                rule.setEnvelope(validateEnvelope(update.envelope()));
                autoRuleRepository.save(rule);
            }
        }
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

    private SupervisionAutoRuleDto toDto(Long organizationId, String actionType, String moduleKey,
                                         SupervisionAutoRule rule) {
        return new SupervisionAutoRuleDto(
                actionType,
                moduleKey,
                rule != null && rule.isEnabled(),
                (rule != null && rule.getLevel() != null
                        ? rule.getLevel() : SupervisionAutonomy.NOTIFY).toWire(),
                rule != null ? rule.getEnvelope() : null,
                moduleCeiling(organizationId, moduleKey).toWire());
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
