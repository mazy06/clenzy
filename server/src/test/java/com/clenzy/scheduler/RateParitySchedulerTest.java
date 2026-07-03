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
import com.clenzy.tenant.TenantScopedExecutor;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("RateParityScheduler (capteur quotidien RATE_PARITY_DISPARITY)")
class RateParitySchedulerTest {

    private static final Long ORG_ID = 1L;

    @Mock private AutomationRuleRepository automationRuleRepository;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private RateParityService rateParityService;
    @Mock private AutomationEngine automationEngine;
    @Mock private TenantScopedExecutor tenantScopedExecutor;
    @Mock private ChannexProperties channexProperties;

    private RateParityScheduler scheduler;

    @BeforeEach
    void setUp() {
        scheduler = new RateParityScheduler(automationRuleRepository, mappingRepository,
                propertyRepository, rateParityService, automationEngine,
                tenantScopedExecutor, channexProperties);
        when(channexProperties.isConfigured()).thenReturn(true);
        // Le TenantScopedExecutor delegue au supplier (contexte tenant simule)
        when(tenantScopedExecutor.callAsOrganization(anyLong(), any()))
                .thenAnswer(inv -> ((Supplier<?>) inv.getArgument(1)).get());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private static AutomationRule parityRule(Long orgId) {
        AutomationRule rule = new AutomationRule();
        rule.setId(80L);
        rule.setOrganizationId(orgId);
        rule.setTriggerType(AutomationTrigger.RATE_PARITY_DISPARITY);
        rule.setEnabled(true);
        return rule;
    }

    private static ChannexPropertyMapping activeMapping(Long propertyId) {
        ChannexPropertyMapping mapping = new ChannexPropertyMapping();
        mapping.setId(UUID.randomUUID());
        mapping.setOrganizationId(ORG_ID);
        mapping.setClenzyPropertyId(propertyId);
        mapping.setChannexPropertyId("chx-" + propertyId);
        mapping.setChannexRoomTypeId("rt-" + propertyId);
        mapping.setChannexDefaultRatePlanId("rp-" + propertyId);
        mapping.setSyncStatus(ChannexSyncStatus.ACTIVE);
        return mapping;
    }

    /**
     * Stub complet propertyRepository.findById → mock Property en mode CLENZY.
     * Le mock est cree et stubbe AVANT le when() externe (jamais d'imbrication
     * de stubbing dans un thenReturn — UnfinishedStubbing sinon).
     */
    private void givenLocalProperty(Long propertyId) {
        Property property = mock(Property.class);
        lenient().when(property.getPriceSourceOfTruth()).thenReturn(PriceSourceOfTruth.CLENZY);
        when(propertyRepository.findById(propertyId)).thenReturn(Optional.of(property));
    }

    private static RateParityReport reportWithDisparity(Long propertyId, int days) {
        return new RateParityReport(propertyId, "Villa " + propertyId,
                LocalDate.now(), LocalDate.now().plusDays(29), new BigDecimal("2"), null,
                List.of(new RateParityReport.ChannelParity("airbnb", "rp-" + propertyId,
                        30, days, new BigDecimal("12.50"), List.of())));
    }

    private static RateParityReport reportWithoutDisparity(Long propertyId) {
        return reportWithDisparity(propertyId, 0);
    }

    // ─── Scenarios ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("bien en disparite -> fireTrigger RATE_PARITY_DISPARITY avec sujet PROPERTY + donnees du rapport")
    void whenDisparityDetected_thenFiresTriggerWithReportData() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(parityRule(ORG_ID)));
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping(101L)));
        givenLocalProperty(101L);
        when(rateParityService.checkParity(101L, ORG_ID, RateParityService.DEFAULT_DAYS))
                .thenReturn(reportWithDisparity(101L, 4));

        scheduler.scan();

        verify(automationEngine).fireTrigger(eq(AutomationTrigger.RATE_PARITY_DISPARITY),
                eq(ORG_ID),
                argThat((AutomationSubject subject) ->
                        AutomationSubject.TYPE_PROPERTY.equals(subject.subjectType())
                        && Long.valueOf(101L).equals(subject.subjectId())
                        && "Villa 101".equals(subject.data()
                                .get(NotifyRateParityExecutor.DATA_PROPERTY_NAME))
                        && Integer.valueOf(4).equals(subject.data()
                                .get(NotifyRateParityExecutor.DATA_DISPARITY_DAYS))
                        && "12.50".equals(subject.data()
                                .get(NotifyRateParityExecutor.DATA_MAX_DEVIATION_PERCENT))
                        && "airbnb".equals(subject.data()
                                .get(NotifyRateParityExecutor.DATA_CHANNELS))));
    }

    @Test
    @DisplayName("echec Channex sur un bien -> skip journalise, le bien suivant est traite et tire")
    void whenOneMappingFails_thenOthersStillProcessed() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(parityRule(ORG_ID)));
        when(mappingRepository.findAllAcrossOrgs())
                .thenReturn(List.of(activeMapping(101L), activeMapping(102L)));
        givenLocalProperty(101L);
        givenLocalProperty(102L);
        when(rateParityService.checkParity(101L, ORG_ID, RateParityService.DEFAULT_DAYS))
                .thenThrow(new RuntimeException("Channex KO"));
        when(rateParityService.checkParity(102L, ORG_ID, RateParityService.DEFAULT_DAYS))
                .thenReturn(reportWithDisparity(102L, 2));

        scheduler.scan();

        verify(automationEngine).fireTrigger(eq(AutomationTrigger.RATE_PARITY_DISPARITY),
                eq(ORG_ID),
                argThat((AutomationSubject s) -> Long.valueOf(102L).equals(s.subjectId())));
        verify(automationEngine, never()).fireTrigger(any(), any(),
                argThat((AutomationSubject s) -> Long.valueOf(101L).equals(s.subjectId())));
    }

    @Test
    @DisplayName("bien sans disparite -> pas de trigger")
    void whenNoDisparity_thenNoTrigger() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(parityRule(ORG_ID)));
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping(101L)));
        givenLocalProperty(101L);
        when(rateParityService.checkParity(101L, ORG_ID, RateParityService.DEFAULT_DAYS))
                .thenReturn(reportWithoutDisparity(101L));

        scheduler.scan();

        verifyNoInteractions(automationEngine);
    }

    @Test
    @DisplayName("aucune regle active sur le trigger -> aucun scan des mappings")
    void whenNoActiveRule_thenNoScan() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of());

        scheduler.scan();

        verifyNoInteractions(mappingRepository, rateParityService, automationEngine);
    }

    @Test
    @DisplayName("org du mapping sans regle sur le trigger -> mapping ignore")
    void whenMappingOrgHasNoRule_thenSkipped() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(parityRule(999L)));
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping(101L)));

        scheduler.scan();

        verifyNoInteractions(rateParityService, automationEngine);
    }

    @Test
    @DisplayName("propriete en mode OTA (l'OTA est la verite) -> pas de comparaison ni de trigger")
    void whenPropertyOtaSourceOfTruth_thenSkipped() {
        when(automationRuleRepository.findByEnabledTrue()).thenReturn(List.of(parityRule(ORG_ID)));
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(activeMapping(101L)));
        Property otaProperty = mock(Property.class);
        when(otaProperty.getPriceSourceOfTruth()).thenReturn(PriceSourceOfTruth.OTA);
        when(propertyRepository.findById(101L)).thenReturn(Optional.of(otaProperty));

        scheduler.scan();

        verifyNoInteractions(rateParityService, automationEngine);
    }

    @Test
    @DisplayName("cle API Channex absente -> scan skip complet")
    void whenChannexNotConfigured_thenSkip() {
        when(channexProperties.isConfigured()).thenReturn(false);

        scheduler.scan();

        verifyNoInteractions(automationRuleRepository, mappingRepository,
                rateParityService, automationEngine);
    }
}
