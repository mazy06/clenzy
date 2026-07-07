package com.clenzy.scheduler;

import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.dto.RateParityReport;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.model.ChannexSyncStatus;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.integration.channex.service.RateParityService;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.PriceSourceOfTruth;
import com.clenzy.model.Property;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import com.clenzy.service.automation.NotifyRateParityExecutor;
import com.clenzy.service.agent.supervision.SupervisionActivityService;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.tenant.TenantScopedExecutor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Capteur quotidien de parite tarifaire (S2) pour le moteur AutomationRule.
 *
 * <p>Pour chaque organisation ayant une regle active sur
 * {@link AutomationTrigger#RATE_PARITY_DISPARITY}, scanne les proprietes
 * synchronisees Channex (mapping ACTIVE) et tire le trigger pour chaque
 * propriete en disparite, avec les donnees du rapport dans le sujet.</p>
 *
 * <p><b>Idempotence</b> : declencheur recurrent (pas de dedup moteur) — la cle
 * metier bien+jour est portee par {@link NotifyRateParityExecutor} (dedup par
 * jour calendaire), le capteur peut donc re-presenter le sujet sans risque.</p>
 *
 * <p><b>Contexte tenant</b> : la resolution des prix (PriceEngine) passe par
 * {@link TenantScopedExecutor} — thread cron sans contexte HTTP. L'appel HTTP
 * Channex (dans {@link RateParityService}) se fait hors transaction DB.</p>
 *
 * <p>Un echec (Channex ou autre) sur un bien est journalise et n'empeche pas
 * les biens suivants ; le log final porte le compte des echecs.</p>
 */
@Component
public class RateParityScheduler {

    private static final Logger log = LoggerFactory.getLogger(RateParityScheduler.class);

    private final AutomationRuleRepository automationRuleRepository;
    private final ChannexPropertyMappingRepository mappingRepository;
    private final PropertyRepository propertyRepository;
    private final RateParityService rateParityService;
    private final AutomationEngine automationEngine;
    private final TenantScopedExecutor tenantScopedExecutor;
    private final ChannexProperties channexProperties;
    private final SupervisionActivityService supervisionActivityService;
    private final SupervisionSuggestionService supervisionSuggestionService;

    public RateParityScheduler(AutomationRuleRepository automationRuleRepository,
                               ChannexPropertyMappingRepository mappingRepository,
                               PropertyRepository propertyRepository,
                               RateParityService rateParityService,
                               AutomationEngine automationEngine,
                               TenantScopedExecutor tenantScopedExecutor,
                               ChannexProperties channexProperties,
                               SupervisionActivityService supervisionActivityService,
                               SupervisionSuggestionService supervisionSuggestionService) {
        this.automationRuleRepository = automationRuleRepository;
        this.mappingRepository = mappingRepository;
        this.propertyRepository = propertyRepository;
        this.rateParityService = rateParityService;
        this.automationEngine = automationEngine;
        this.tenantScopedExecutor = tenantScopedExecutor;
        this.channexProperties = channexProperties;
        this.supervisionActivityService = supervisionActivityService;
        this.supervisionSuggestionService = supervisionSuggestionService;
    }

    @Scheduled(cron = "${clenzy.channex.rate-parity.cron:0 45 7 * * *}")
    public void scan() {
        if (!channexProperties.isConfigured()) {
            log.debug("RateParity: scan skip (CHANNEX_API_KEY non configuree)");
            return;
        }

        Set<Long> orgsWithRule = automationRuleRepository.findByEnabledTrue().stream()
                .filter(rule -> rule.getTriggerType() == AutomationTrigger.RATE_PARITY_DISPARITY)
                .map(AutomationRule::getOrganizationId)
                .collect(Collectors.toSet());
        if (orgsWithRule.isEmpty()) {
            log.debug("RateParity: aucune regle active sur RATE_PARITY_DISPARITY, scan skip");
            return;
        }

        long start = System.currentTimeMillis();
        int scanned = 0;
        int fired = 0;
        int failures = 0;

        List<ChannexPropertyMapping> mappings = mappingRepository.findAllAcrossOrgs();
        for (ChannexPropertyMapping mapping : mappings) {
            if (mapping.getSyncStatus() != ChannexSyncStatus.ACTIVE) continue;
            Long orgId = mapping.getOrganizationId();
            if (!orgsWithRule.contains(orgId)) continue;

            try {
                RateParityReport report = tenantScopedExecutor.callAsOrganization(orgId,
                        () -> checkMapping(mapping, orgId));
                scanned++;
                if (report == null || !report.hasDisparity()) continue;

                automationEngine.fireTrigger(AutomationTrigger.RATE_PARITY_DISPARITY, orgId,
                        new AutomationSubject(AutomationSubject.TYPE_PROPERTY,
                                report.propertyId(), subjectData(report)));
                fired++;
                recordConstellationActivity(orgId, report);
            } catch (Exception e) {
                // Echec Channex (ou autre) sur CE bien : skip journalise, on
                // poursuit les autres — le compte d'echecs sort dans le log final.
                failures++;
                log.warn("RateParity: echec sur property={} org={} : {}",
                        mapping.getClenzyPropertyId(), orgId, e.getMessage());
            }
        }

        log.info("RateParity: scan termine en {}ms — biens compares={} triggers tires={} echecs={}",
                System.currentTimeMillis() - start, scanned, fired, failures);
    }

    /**
     * Compare un bien dans le contexte tenant de son org. Retourne null pour les
     * biens a ignorer (introuvable, ou mode {@link PriceSourceOfTruth#OTA} : l'OTA
     * est la verite, un ecart avec le prix local n'est pas une anomalie).
     */
    private RateParityReport checkMapping(ChannexPropertyMapping mapping, Long orgId) {
        Property property = propertyRepository.findById(mapping.getClenzyPropertyId()).orElse(null);
        if (property == null) return null;
        if (property.getPriceSourceOfTruth() == PriceSourceOfTruth.OTA) {
            log.debug("RateParity: skip property={} (mode OTA, l'OTA est la verite)",
                    property.getId());
            return null;
        }
        return rateParityService.checkParity(mapping.getClenzyPropertyId(), orgId,
                RateParityService.DEFAULT_DAYS);
    }

    /**
     * Fait remonter l'écart de parité dans la CONSTELLATION du logement (agent Revenue « rev »), en plus
     * du trigger d'automatisation : le propertyId provient du rapport (une occurrence = un logement), l'org
     * est celle du mapping en cours. Deux effets complémentaires — le feed « En direct » = historique, la
     * carte HITL = todo actionnable (dédup intégrée sur le titre côté service). Best-effort : chaque appel
     * est lui-même best-effort côté service, et un échec ne doit JAMAIS interrompre le scan.
     */
    private void recordConstellationActivity(Long orgId, RateParityReport report) {
        try {
            Long propertyId = report.propertyId();
            if (propertyId == null) {
                return;
            }
            String summary = "Écart de parité tarifaire détecté sur ce logement"
                    + (report.maxDeviationPercent() != null
                        ? " (jusqu'à " + report.maxDeviationPercent().toPlainString() + " %)" : "")
                    + (report.channelsInDisparity() != null && !report.channelsInDisparity().isEmpty()
                        ? " · canaux : " + String.join(", ", report.channelsInDisparity()) : "");
            supervisionActivityService.recordModuleAct(
                    orgId, propertyId, "rev", "rate_parity_issue", summary);
            supervisionSuggestionService.record(
                    orgId, propertyId, "rev", "rate_parity_issue",
                    "Écart de parité tarifaire",
                    "Prix incohérents entre canaux — corriger la parité sur le canal concerné.");
        } catch (Exception e) {
            log.debug("RateParity: activite constellation non enregistree (property={} org={}): {}",
                    report.propertyId(), orgId, e.getMessage());
        }
    }

    private static Map<String, Object> subjectData(RateParityReport report) {
        Map<String, Object> data = new HashMap<>();
        data.put(AutomationSubject.DATA_PROPERTY_ID, report.propertyId());
        data.put(NotifyRateParityExecutor.DATA_PROPERTY_NAME, report.propertyName());
        data.put(NotifyRateParityExecutor.DATA_DISPARITY_DAYS, report.maxDisparityDays());
        if (report.maxDeviationPercent() != null) {
            data.put(NotifyRateParityExecutor.DATA_MAX_DEVIATION_PERCENT,
                    report.maxDeviationPercent().toPlainString());
        }
        data.put(NotifyRateParityExecutor.DATA_CHANNELS,
                String.join(",", report.channelsInDisparity()));
        return data;
    }
}
