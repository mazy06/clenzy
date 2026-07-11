package com.clenzy.service.agent.supervision;

import com.clenzy.model.NotificationKey;
import com.clenzy.model.SupervisionAutoRule;
import com.clenzy.model.SupervisionSettings;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.SupervisionAutoRuleRepository;
import com.clenzy.repository.SupervisionSettingsRepository;
import com.clenzy.repository.SupervisionSuggestionRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.argThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Règles de Confiance des cartes (V3) : N approbations HUMAINES consécutives d'un
 * type automatisable → suggestion « automatiser ? » (INERTE) + notification. Un
 * DISMISSED remet la série à zéro ; {@code auto:gate} ne compte pas ; un type déjà
 * activé n'est jamais suggéré ; « Ignorer » pose un cooldown de 30 jours.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("SupervisionCardTrustService (Règles de Confiance des cartes, V3)")
class SupervisionCardTrustServiceTest {

    private static final Long ORG = 1L;
    private static final String TYPE = SupervisionActionType.CLEANING_REQUEST;

    @Mock private SupervisionSettingsRepository settingsRepository;
    @Mock private SupervisionAutoRuleRepository autoRuleRepository;
    @Mock private SupervisionSuggestionRepository suggestionRepository;
    @Mock private NotificationService notificationService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-11T05:15:00Z"), ZoneOffset.UTC);

    private SupervisionCardTrustService service;

    @BeforeEach
    void setUp() {
        service = new SupervisionCardTrustService(settingsRepository, autoRuleRepository,
                suggestionRepository, notificationService, clock, 5);
    }

    // ── Fixtures ────────────────────────────────────────────────────────────

    private void orgEnabled() {
        SupervisionSettings settings = new SupervisionSettings(ORG);
        settings.setEnabled(true);
        when(settingsRepository.findByEnabledTrueAndPausedFalse()).thenReturn(List.of(settings));
    }

    private static SupervisionSuggestion decided(String status, String appliedBy) {
        SupervisionSuggestion s = new SupervisionSuggestion(
                ORG, 7L, "ops", null, "titre", "motif", Instant.now());
        s.setActionType(TYPE);
        s.setStatus(status);
        if (SupervisionSuggestion.STATUS_APPLIED.equals(status)) {
            s.setAppliedAt(Instant.now());
            s.setAppliedBy(appliedBy);
        } else {
            s.setDismissedAt(Instant.now());
        }
        return s;
    }

    /**
     * Stub des décisions du TYPE testé ; les autres types du catalogue → vide.
     * Lenient : certains tests vérifient justement que la série n'est PAS lue
     * (type déjà activé, suggestion active, cooldown).
     */
    private void decisions(List<SupervisionSuggestion> forType) {
        lenient().when(suggestionRepository.findDecidedByTypeOrderByDecisionDesc(
                eq(ORG), anyString(), any())).thenReturn(List.of());
        lenient().when(suggestionRepository.findDecidedByTypeOrderByDecisionDesc(
                eq(ORG), eq(TYPE), any())).thenReturn(forType);
    }

    private static List<SupervisionSuggestion> userApprovals(int count) {
        List<SupervisionSuggestion> list = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            list.add(decided(SupervisionSuggestion.STATUS_APPLIED, "user:op-" + i));
        }
        return list;
    }

    // ── Cas nominal ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("5 approbations humaines consecutives -> suggested_at pose + notification INERTE")
    void fiveConsecutiveUserApprovals_suggestsAndNotifies() {
        orgEnabled();
        when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        decisions(userApprovals(5));

        int suggested = service.evaluateSuggestions();

        assertThat(suggested).isEqualTo(1);
        verify(autoRuleRepository).save(argThat(rule ->
                TYPE.equals(rule.getActionType())
                        && !rule.isEnabled() // suggestion INERTE : jamais d'activation auto
                        && clock.instant().equals(rule.getSuggestedAt())));
        verify(notificationService).notifyAdminsAndManagersByOrgId(eq(ORG),
                eq(NotificationKey.SUPERVISION_AUTO_RULE_SUGGESTED),
                anyString(), contains("5 fois de suite"), eq("/automation-rules"));
    }

    @Test
    @DisplayName("4 approbations puis un DISMISSED -> serie a zero, rien n'est suggere")
    void dismissedResetsStreak_noSuggestion() {
        orgEnabled();
        lenient().when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        // Ordre anti-chronologique : 4 approbations récentes, puis un rejet, puis
        // d'anciennes approbations (qui ne doivent PAS compter).
        List<SupervisionSuggestion> history = new ArrayList<>(userApprovals(4));
        history.add(decided(SupervisionSuggestion.STATUS_DISMISSED, null));
        history.addAll(userApprovals(3));
        decisions(history);

        int suggested = service.evaluateSuggestions();

        assertThat(suggested).isZero();
        verify(autoRuleRepository, never()).save(any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("les applications auto:gate NE comptent PAS (et ne cassent pas la serie)")
    void autoGateApplicationsDoNotCount() {
        orgEnabled();
        lenient().when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        // 3 humaines + 4 auto : streak humain = 3 < 5 → rien.
        List<SupervisionSuggestion> history = new ArrayList<>(userApprovals(3));
        for (int i = 0; i < 4; i++) {
            history.add(decided(SupervisionSuggestion.STATUS_APPLIED,
                    SupervisionSuggestion.APPLIED_BY_AUTO));
        }
        decisions(history);

        assertThat(service.evaluateSuggestions()).isZero();
        verify(autoRuleRepository, never()).save(any());
    }

    @Test
    @DisplayName("type deja active (regle enabled) -> jamais suggere, meme avec 5 approbations")
    void enabledType_neverSuggested() {
        orgEnabled();
        SupervisionAutoRule enabledRule = new SupervisionAutoRule(ORG, TYPE);
        enabledRule.setEnabled(true);
        lenient().when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        when(autoRuleRepository.findByOrganizationIdAndActionType(ORG, TYPE))
                .thenReturn(Optional.of(enabledRule));
        decisions(userApprovals(5));

        assertThat(service.evaluateSuggestions()).isZero();
        verify(autoRuleRepository, never()).save(any());
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("« Ignorer » recent (< 30 j) -> cooldown, pas de re-suggestion ; > 30 j -> re-suggere")
    void dismissCooldown30Days() {
        orgEnabled();
        SupervisionAutoRule dismissedRule = new SupervisionAutoRule(ORG, TYPE);
        dismissedRule.setSuggestionDismissedAt(clock.instant().minus(Duration.ofDays(10)));
        lenient().when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        when(autoRuleRepository.findByOrganizationIdAndActionType(ORG, TYPE))
                .thenReturn(Optional.of(dismissedRule));
        decisions(userApprovals(5));

        // < 30 j : cooldown actif.
        assertThat(service.evaluateSuggestions()).isZero();

        // > 30 j : la suggestion peut revenir (la situation persiste).
        dismissedRule.setSuggestionDismissedAt(clock.instant().minus(Duration.ofDays(31)));
        assertThat(service.evaluateSuggestions()).isEqualTo(1);
        verify(autoRuleRepository).save(argThat(rule ->
                clock.instant().equals(rule.getSuggestedAt())));
    }

    @Test
    @DisplayName("suggestion deja active (suggested_at pose) -> pas de doublon")
    void activeSuggestion_notDuplicated() {
        orgEnabled();
        SupervisionAutoRule suggestedRule = new SupervisionAutoRule(ORG, TYPE);
        suggestedRule.setSuggestedAt(clock.instant().minus(Duration.ofDays(2)));
        lenient().when(autoRuleRepository.findByOrganizationIdAndActionType(eq(ORG), anyString()))
                .thenReturn(Optional.empty());
        when(autoRuleRepository.findByOrganizationIdAndActionType(ORG, TYPE))
                .thenReturn(Optional.of(suggestedRule));
        decisions(userApprovals(5));

        assertThat(service.evaluateSuggestions()).isZero();
        verify(notificationService, never()).notifyAdminsAndManagersByOrgId(
                any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("aucune org avec la constellation active -> no-op")
    void noEnabledOrg_noop() {
        when(settingsRepository.findByEnabledTrueAndPausedFalse()).thenReturn(List.of());

        assertThat(service.evaluateSuggestions()).isZero();
        org.mockito.Mockito.verifyNoInteractions(suggestionRepository, notificationService);
    }
}
