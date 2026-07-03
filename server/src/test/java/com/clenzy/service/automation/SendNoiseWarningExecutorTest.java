package com.clenzy.service.automation;

import com.clenzy.model.AutomationRule;
import com.clenzy.model.NoiseAlert;
import com.clenzy.repository.NoiseAlertRepository;
import com.clenzy.service.NoiseAlertNotificationService;
import com.clenzy.service.NoiseAlertNotificationService.GuestWarningOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/**
 * Executeur SEND_NOISE_WARNING (fiche 08, F6a) : rechargement de l'alerte,
 * validation d'organisation, mapping du resultat d'envoi voyageur.
 */
@ExtendWith(MockitoExtension.class)
class SendNoiseWarningExecutorTest {

    @Mock private NoiseAlertRepository noiseAlertRepository;
    @Mock private NoiseAlertNotificationService noiseAlertNotificationService;

    @InjectMocks
    private SendNoiseWarningExecutor executor;

    private static final Long ORG_ID = 1L;

    private AutomationRule rule;
    private NoiseAlert alert;

    @BeforeEach
    void setUp() {
        rule = new AutomationRule();
        rule.setId(9L);

        alert = new NoiseAlert();
        alert.setId(77L);
        alert.setOrganizationId(ORG_ID);
        alert.setPropertyId(100L);
    }

    private AutomationActionContext noiseCtx(Long alertId) {
        return new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_NOISE_ALERT, alertId,
            Map.of(AutomationSubject.DATA_PROPERTY_ID, 100L), null);
    }

    @Test
    void whenGuestWarned_thenExecuted() {
        when(noiseAlertRepository.findById(77L)).thenReturn(Optional.of(alert));
        when(noiseAlertNotificationService.sendGuestWarning(alert))
            .thenReturn(new GuestWarningOutcome(true, "whatsapp", null));

        var result = executor.execute(rule, noiseCtx(77L));

        assertThat(result.skipped()).isFalse();
    }

    @Test
    void whenAlreadyWarnedWithin24h_thenSkipsWithReason() {
        when(noiseAlertRepository.findById(77L)).thenReturn(Optional.of(alert));
        when(noiseAlertNotificationService.sendGuestWarning(alert))
            .thenReturn(new GuestWarningOutcome(false, null, "voyageur deja averti il y a moins de 24 h"));

        var result = executor.execute(rule, noiseCtx(77L));

        assertThat(result.skipped()).isTrue();
        assertThat(result.detail()).contains("24 h");
    }

    @Test
    void whenAlertBelongsToAnotherOrg_thenFailsExplicitly() {
        alert.setOrganizationId(999L);
        when(noiseAlertRepository.findById(77L)).thenReturn(Optional.of(alert));

        assertThatThrownBy(() -> executor.execute(rule, noiseCtx(77L)))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("hors de l'organisation");
    }

    @Test
    void whenWrongSubjectType_thenFailsExplicitly() {
        var ctx = new AutomationActionContext(ORG_ID, AutomationSubject.TYPE_INVOICE, 77L, Map.of(), null);

        assertThatThrownBy(() -> executor.execute(rule, ctx))
            .isInstanceOf(IllegalStateException.class);
    }
}
