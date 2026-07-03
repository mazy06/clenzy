package com.clenzy.service.automation;

import com.clenzy.model.AutomationAction;
import com.clenzy.model.AutomationRule;
import com.clenzy.model.NoiseAlert;
import com.clenzy.model.Property;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.agent.supervision.SupervisionActionType;
import com.clenzy.service.agent.supervision.SupervisionSuggestionService;
import com.clenzy.service.automation.AutomationActionExecutor.ExecutionResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuggestCalendarBlockExecutor (F6c escalade bruit -> suggestion blocage calendrier)")
class SuggestCalendarBlockExecutorTest {

    private static final Long ORG_ID = 1L;
    private static final Long ALERT_ID = 66L;
    private static final Long PROPERTY_ID = 7L;

    @Mock private NoiseAlertRepository noiseAlertRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private SupervisionSuggestionService suggestionService;

    private SuggestCalendarBlockExecutor executor;

    @BeforeEach
    void setUp() {
        executor = new SuggestCalendarBlockExecutor(
                noiseAlertRepository, propertyRepository, suggestionService, new ObjectMapper());
    }

    private static AutomationRule rule() {
        AutomationRule rule = new AutomationRule();
        rule.setId(12L);
        rule.setOrganizationId(ORG_ID);
        rule.setName("blocage bruit grave");
        rule.setConditions("{\"alertsLast24h\":{\"gte\":3}}");
        return rule;
    }

    private static NoiseAlert alert() {
        NoiseAlert alert = new NoiseAlert();
        alert.setId(ALERT_ID);
        alert.setOrganizationId(ORG_ID);
        alert.setPropertyId(PROPERTY_ID);
        return alert;
    }

    private static Property property() {
        Property property = new Property();
        property.setId(PROPERTY_ID);
        property.setOrganizationId(ORG_ID);
        property.setName("Loft Marais");
        return property;
    }

    private static AutomationActionContext ctx() {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_NOISE_ALERT, ALERT_ID,
                Map.of(AutomationSubject.DATA_ALERTS_LAST_24H, 4));
    }

    @Test
    @DisplayName("action() -> SUGGEST_CALENDAR_BLOCK")
    void actionType() {
        assertThat(executor.action()).isEqualTo(AutomationAction.SUGGEST_CALENDAR_BLOCK);
    }

    @Test
    @DisplayName("sujet inattendu -> echec explicite")
    void wrongSubject_throws() {
        AutomationActionContext ctx = new AutomationActionContext(
                ORG_ID, AutomationSubject.TYPE_RESERVATION, 5L, Map.of());

        assertThatThrownBy(() -> executor.execute(rule(), ctx))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("NOISE_ALERT");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("alerte d'une autre org -> echec explicite (ownership)")
    void crossOrgAlert_throws() {
        NoiseAlert alert = alert();
        alert.setOrganizationId(999L);
        when(noiseAlertRepository.findById(ALERT_ID)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> executor.execute(rule(), ctx()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("organisation");
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("alerte sans logement -> SKIPPED")
    void alertWithoutProperty_skips() {
        NoiseAlert alert = alert();
        alert.setPropertyId(null);
        when(noiseAlertRepository.findById(ALERT_ID)).thenReturn(Optional.of(alert));

        ExecutionResult result = executor.execute(rule(), ctx());

        assertThat(result.skipped()).isTrue();
        verifyNoInteractions(suggestionService);
    }

    @Test
    @DisplayName("cas nominal : suggestion CALENDAR_BLOCK (7 jours, severite critical) — jamais d'execution auto")
    void escalation_createsBlockSuggestion() {
        when(noiseAlertRepository.findById(ALERT_ID)).thenReturn(Optional.of(alert()));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), isNull(),
                anyString(), anyString(), anyString(), anyString(), isNull(), anyString()))
                .thenReturn(true);

        ExecutionResult result = executor.execute(rule(), ctx());

        assertThat(result.skipped()).isFalse();
        verify(suggestionService).recordActionableStrict(
                eq(ORG_ID), eq(PROPERTY_ID), eq("ops"), isNull(),
                contains("Bloquer le calendrier de Loft Marais"),
                contains("4 alertes sur 24 h"),
                eq(SupervisionActionType.CALENDAR_BLOCK),
                contains("\"days\":7"),
                isNull(),
                eq("critical"));
    }

    @Test
    @DisplayName("suggestion deja en attente -> SKIPPED (deduplication)")
    void duplicatePending_skips() {
        when(noiseAlertRepository.findById(ALERT_ID)).thenReturn(Optional.of(alert()));
        when(propertyRepository.findById(PROPERTY_ID)).thenReturn(Optional.of(property()));
        when(suggestionService.recordActionableStrict(anyLong(), anyLong(), anyString(), isNull(),
                anyString(), anyString(), anyString(), anyString(), isNull(), anyString()))
                .thenReturn(false);

        ExecutionResult result = executor.execute(rule(), ctx());

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("deja en attente");
    }
}
