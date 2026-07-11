package com.clenzy.service.agent.supervision;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Chemin d'auto-exécution (Vague 1) : réutilise le pipeline d'apply avec
 * l'acteur système, feed toujours, notification en NOTIFY seulement, et
 * repli HITL (carte PENDING) si l'apply échoue.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SupervisionAutoApplyService (auto-exécution Vague 1)")
class SupervisionAutoApplyServiceTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 7L;
    private static final Long SUGGESTION = 50L;

    @Mock private SupervisionSuggestionService suggestionService;
    @Mock private SupervisionActivityService activityService;
    @Mock private NotificationService notificationService;

    private SupervisionAutoApplyService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionAutoApplyService(suggestionService, activityService, notificationService);
    }

    @Test
    @DisplayName("AUTO_NOTIFY : apply par l'acteur systeme + feed + notification SUPERVISION_AUTO_APPLIED")
    void autoNotify_appliesFeedsAndNotifies() {
        boolean applied = service.autoApply(AutoApplyGate.AutoDecision.AUTO_NOTIFY,
                ORG, PROP, "ops", SUGGESTION, "Menage manquant", "motif", 4500L);

        assertThat(applied).isTrue();
        // Même pipeline que le bouton humain, acteur système tracé.
        verify(suggestionService).apply(ORG, SUGGESTION, SupervisionSuggestion.APPLIED_BY_AUTO);
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("ops"),
                eq("auto_applied"), contains("Menage manquant"));
        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
                eq(NotificationKey.SUPERVISION_AUTO_APPLIED), contains("Menage manquant"),
                contains("45 €"), eq("/planning"));
    }

    @Test
    @DisplayName("AUTO_SILENT : apply + feed, PAS de notification")
    void autoSilent_appliesAndFeedsWithoutNotification() {
        boolean applied = service.autoApply(AutoApplyGate.AutoDecision.AUTO_SILENT,
                ORG, PROP, "rep", SUGGESTION, "Brouillon avis", "motif", null);

        assertThat(applied).isTrue();
        verify(suggestionService).apply(ORG, SUGGESTION, SupervisionSuggestion.APPLIED_BY_AUTO);
        verify(activityService).recordModuleAct(eq(ORG), eq(PROP), eq("rep"), any(), any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("echec de l'apply -> false, ni feed ni notification (repli HITL : carte PENDING)")
    void applyFailure_fallsBackToHitl() {
        doThrow(new IllegalStateException("bornes yield absentes"))
                .when(suggestionService).apply(ORG, SUGGESTION, SupervisionSuggestion.APPLIED_BY_AUTO);

        boolean applied = service.autoApply(AutoApplyGate.AutoDecision.AUTO_NOTIFY,
                ORG, PROP, "rev", SUGGESTION, "Baisse tarifaire", "motif", null);

        assertThat(applied).isFalse();
        verify(activityService, never()).recordModuleAct(any(), any(), any(), any(), any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("decision CARD ou suggestion absente -> no-op")
    void cardOrMissingSuggestion_noop() {
        assertThat(service.autoApply(AutoApplyGate.AutoDecision.CARD,
                ORG, PROP, "ops", SUGGESTION, "t", "m", null)).isFalse();
        assertThat(service.autoApply(AutoApplyGate.AutoDecision.AUTO_NOTIFY,
                ORG, PROP, "ops", null, "t", "m", null)).isFalse();
        verify(suggestionService, never()).apply(any(), any(), any());
    }
}
