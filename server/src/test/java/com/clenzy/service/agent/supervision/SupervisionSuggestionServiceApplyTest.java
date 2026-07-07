package com.clenzy.service.agent.supervision;

import com.clenzy.exception.NotFoundException;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionSuggestionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;

/**
 * Orchestration transactionnelle de {@code apply} (vague 3) : CAS PENDING→APPLIED,
 * execution DB-only en transaction vs effet externe hors transaction + compensation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SupervisionSuggestionService.apply (HITL vague 3)")
class SupervisionSuggestionServiceApplyTest {

    private static final Long ORG_ID = 1L;
    private static final Long SUGGESTION_ID = 50L;

    @Mock private SupervisionSuggestionRepository repository;
    @Mock private SuggestionActionExecutor actionExecutor;
    @Mock private com.clenzy.service.NotificationService notificationService;
    @Mock private PlatformTransactionManager transactionManager;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private SupervisionSuggestionService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionSuggestionService(
                repository, actionExecutor, notificationService, clock, transactionManager);
    }

    private static SupervisionSuggestion suggestion(String actionType) {
        SupervisionSuggestion s = new SupervisionSuggestion(
                ORG_ID, 7L, "fin", null, "titre", "motif", Instant.now());
        s.setId(SUGGESTION_ID);
        s.setActionType(actionType);
        return s;
    }

    @Test
    @DisplayName("suggestion d'une autre org -> introuvable (404), aucune execution")
    void crossOrg_notFound() {
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(ORG_ID, SUGGESTION_ID))
                .isInstanceOf(NotFoundException.class);
        verify(actionExecutor, never()).execute(any());
        verify(repository, never()).markApplied(any(), any(), any());
    }

    @Test
    @DisplayName("suggestion non actionnable -> 400, pas de transition")
    void notActionable_rejected() {
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID))
                .thenReturn(Optional.of(suggestion(null)));

        assertThatThrownBy(() -> service.apply(ORG_ID, SUGGESTION_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("pas actionnable");
        verify(repository, never()).markApplied(any(), any(), any());
    }

    @Test
    @DisplayName("double apply : le 2e CAS ne matche rien -> 400, aucune double execution")
    void alreadyApplied_rejected() {
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID))
                .thenReturn(Optional.of(suggestion(SupervisionActionType.DEPOSIT_REFUND)));
        when(repository.markApplied(eq(SUGGESTION_ID), eq(ORG_ID), any(Instant.class))).thenReturn(0);

        assertThatThrownBy(() -> service.apply(ORG_ID, SUGGESTION_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("déjà traitée");
        verify(actionExecutor, never()).execute(any());
    }

    @Test
    @DisplayName("action DB-only (PRICE_DROP/CALENDAR_BLOCK) : executee dans la transaction du CAS")
    void dbOnlyAction_executedInTransaction() {
        SupervisionSuggestion s = suggestion(SupervisionActionType.CALENDAR_BLOCK);
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID)).thenReturn(Optional.of(s));
        when(repository.markApplied(eq(SUGGESTION_ID), eq(ORG_ID), any(Instant.class))).thenReturn(1);
        when(actionExecutor.hasExternalEffect(SupervisionActionType.CALENDAR_BLOCK)).thenReturn(false);

        service.apply(ORG_ID, SUGGESTION_ID);

        verify(actionExecutor).execute(s);
        verify(repository, never()).revertApplied(any(), any());
    }

    @Test
    @DisplayName("action a effet externe (caution) : executee APRES le commit du CAS")
    void externalAction_executedAfterCasCommit() {
        SupervisionSuggestion s = suggestion(SupervisionActionType.DEPOSIT_REFUND);
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID)).thenReturn(Optional.of(s));
        when(repository.markApplied(eq(SUGGESTION_ID), eq(ORG_ID), any(Instant.class))).thenReturn(1);
        when(actionExecutor.hasExternalEffect(SupervisionActionType.DEPOSIT_REFUND)).thenReturn(true);

        service.apply(ORG_ID, SUGGESTION_ID);

        verify(actionExecutor).execute(s);
        // Le CAS a ete committe (transaction 1) avant l'appel Stripe : succes -> pas de compensation.
        verify(transactionManager).commit(any());
        verify(repository, never()).revertApplied(any(), any());
    }

    @Test
    @DisplayName("echec de l'effet externe -> compensation APPLIED→PENDING + exception propagee")
    void externalActionFailure_revertsToPending() {
        SupervisionSuggestion s = suggestion(SupervisionActionType.DEPOSIT_RELEASE);
        when(repository.findByIdAndOrganizationId(SUGGESTION_ID, ORG_ID)).thenReturn(Optional.of(s));
        when(repository.markApplied(eq(SUGGESTION_ID), eq(ORG_ID), any(Instant.class))).thenReturn(1);
        when(actionExecutor.hasExternalEffect(SupervisionActionType.DEPOSIT_RELEASE)).thenReturn(true);
        doThrow(new IllegalStateException("Stripe indisponible")).when(actionExecutor).execute(s);

        assertThatThrownBy(() -> service.apply(ORG_ID, SUGGESTION_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Stripe");

        // La suggestion redevient actionnable : l'operateur peut re-tenter.
        verify(repository).revertApplied(SUGGESTION_ID, ORG_ID);
    }

    @Test
    @DisplayName("recordActionableStrict : dedup par intitule en attente -> false, sinon persiste true")
    void recordActionableStrict_dedupes() {
        when(repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                ORG_ID, 7L, "fin", "titre", SupervisionSuggestion.STATUS_PENDING))
                .thenReturn(true).thenReturn(false);

        boolean first = service.recordActionableStrict(ORG_ID, 7L, "fin", 100L,
                "titre", "motif", SupervisionActionType.DEPOSIT_REFUND, "{}", 1000L, "warning");
        boolean second = service.recordActionableStrict(ORG_ID, 7L, "fin", 100L,
                "titre", "motif", SupervisionActionType.DEPOSIT_REFUND, "{}", 1000L, "warning");

        assertThat(first).isFalse();
        assertThat(second).isTrue();
        verify(repository).save(any(SupervisionSuggestion.class));
    }

    @Test
    @DisplayName("carte actionnable warning -> notification hors-ecran (B2)")
    void recordActionableWarning_notifiesOffScreen() {
        when(repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                any(), any(), any(), any(), any())).thenReturn(false);

        service.recordActionableStrict(ORG_ID, 10L, "fin", null, "Solde echoue", "motif",
                SupervisionActionType.PAYMENT_REMINDER, "{}", null, "warning");

        verify(notificationService).notifyAdminsAndManagersByOrgId(
                eq(ORG_ID), eq(NotificationKey.SUPERVISION_SUGGESTION), any(), any(), any());
    }

    @Test
    @DisplayName("carte informationnelle -> pas de notification (anti-spam)")
    void recordInformational_doesNotNotify() {
        when(repository.existsByOrganizationIdAndPropertyIdAndModuleKeyAndTitleAndStatus(
                any(), any(), any(), any(), any())).thenReturn(false);

        service.record(ORG_ID, 10L, "ops", "cleaning_missing", "Menage manquant", "motif");

        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }
}
