package com.clenzy.service;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.AutomationTrigger;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Property;
import com.clenzy.repository.AutomationRuleRepository;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.automation.AutomationEngine;
import com.clenzy.service.automation.AutomationSubject;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Service de TEST (profils non-prod) : fabrique une carte HITL de démo sur la
 * constellation d'un logement en exerçant un VRAI flux déterministe (escalade
 * bruit → {@code SUGGEST_CALENDAR_BLOCK}), sans caution ni annulation. N'existe
 * pas en production ({@code @Profile}).
 */
@Service
@Profile({"dev", "local"})
public class DevConstellationDemoService {

    private final PropertyRepository propertyRepository;
    private final AutomationRuleRepository ruleRepository;
    private final NoiseAlertRepository noiseAlertRepository;
    private final AutomationEngine automationEngine;

    public DevConstellationDemoService(PropertyRepository propertyRepository,
                                       AutomationRuleRepository ruleRepository,
                                       NoiseAlertRepository noiseAlertRepository,
                                       AutomationEngine automationEngine) {
        this.propertyRepository = propertyRepository;
        this.ruleRepository = ruleRepository;
        this.noiseAlertRepository = noiseAlertRepository;
        this.automationEngine = automationEngine;
    }

    /**
     * Simule une escalade de bruit sur le logement et déclenche le moteur
     * déterministe réel → carte HITL « Bloquer le calendrier » sur la constellation.
     */
    public void spawnDemoCard(Long propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new IllegalArgumentException("Logement introuvable : " + propertyId));
        Long orgId = property.getOrganizationId();

        // 1) S'assurer qu'une règle NOISE_ALERT → SUGGEST_CALENDAR_BLOCK existe (démo).
        boolean hasRule = ruleRepository
                .findByOrganizationIdAndTriggerTypeAndEnabledTrue(orgId, AutomationTrigger.NOISE_ALERT)
                .stream().anyMatch(r -> r.getActionType() == AutomationAction.SUGGEST_CALENDAR_BLOCK);
        if (!hasRule) {
            AutomationRule rule = new AutomationRule();
            rule.setOrganizationId(orgId);
            rule.setName("[DEMO] Escalade bruit → suggérer un blocage du calendrier");
            rule.setEnabled(true);
            rule.setTriggerType(AutomationTrigger.NOISE_ALERT);
            rule.setActionType(AutomationAction.SUGGEST_CALENDAR_BLOCK);
            rule.setTriggerTime("09:00");
            rule.setConditions("{\"alertsLast24h\":{\"gte\":3}}");
            ruleRepository.save(rule);
        }

        // 2) Créer une alerte bruit de démo pour ce logement.
        NoiseAlert alert = new NoiseAlert();
        alert.setOrganizationId(orgId);
        alert.setPropertyId(propertyId);
        alert.setSeverity(NoiseAlert.AlertSeverity.CRITICAL);
        alert.setMeasuredDb(88.0);
        alert.setThresholdDb(70);
        alert.setTimeWindowLabel("Nuit");
        alert.setSource(NoiseAlert.AlertSource.MANUAL);
        alert = noiseAlertRepository.save(alert);

        // 3) Déclencher le VRAI flux déterministe (escalade : alertsLast24h ≥ 3).
        automationEngine.fireTrigger(AutomationTrigger.NOISE_ALERT, orgId,
                new AutomationSubject(AutomationSubject.TYPE_NOISE_ALERT, alert.getId(),
                        Map.of("alertsLast24h", 3)));
    }
}
