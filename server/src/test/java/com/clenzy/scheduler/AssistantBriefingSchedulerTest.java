package com.clenzy.scheduler;

import com.clenzy.model.AssistantBriefingLog;
import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.repository.AssistantBriefingLogRepository;
import com.clenzy.service.agent.briefing.AssistantBriefingPrefService;
import com.clenzy.service.agent.briefing.BriefingComposer;
import com.clenzy.service.agent.briefing.BriefingDelivery;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class AssistantBriefingSchedulerTest {

    private AssistantBriefingPrefService prefService;
    private BriefingComposer composer;
    private BriefingDelivery delivery;
    private AssistantBriefingLogRepository logRepository;
    private AssistantBriefingScheduler scheduler;

    @BeforeEach
    void setUp() {
        prefService = mock(AssistantBriefingPrefService.class);
        composer = mock(BriefingComposer.class);
        delivery = mock(BriefingDelivery.class);
        logRepository = mock(AssistantBriefingLogRepository.class);
        scheduler = new AssistantBriefingScheduler(prefService, composer, delivery,
                logRepository, new ObjectMapper());
        // Defaults : pas de log preexistant sur la periode, save retourne l'arg
        when(logRepository.existsByKeycloakIdAndBriefingDateGreaterThanEqual(
                anyString(), any(LocalDate.class)))
                .thenReturn(false);
        when(logRepository.save(any(AssistantBriefingLog.class)))
                .thenAnswer(inv -> {
                    AssistantBriefingLog l = inv.getArgument(0);
                    if (l.getId() == null) l.setId(1L);
                    return l;
                });
        when(prefService.parseChannels(any(AssistantBriefingPref.class)))
                .thenReturn(List.of("in_app"));
    }

    private static AssistantBriefingPref pref(String tz, LocalTime time,
                                                AssistantBriefingPref.Frequency freq, boolean enabled) {
        AssistantBriefingPref p = new AssistantBriefingPref(1L, "user-x");
        p.setEnabled(enabled);
        p.setTimezone(tz);
        p.setTimeLocal(time);
        p.setFrequencyEnum(freq);
        return p;
    }

    // ─── shouldTrigger : matching TZ + heure + frequence ────────────────────

    @Test
    void shouldTrigger_localHourMatch_returnsTrue() {
        // Paris est UTC+1 en hiver, +2 en ete. On utilise un instant defini :
        // 2026-01-15 07:00 UTC = 08:00 Paris (heure d'hiver). Pref a 08:00 Paris → match.
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 7, 0);
        assertTrue(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_avantLheureCible_returnsFalse() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        // 05:00 UTC = 06:00 Paris → l'instant cible du jour n'est pas passe
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 5, 0);
        assertFalse(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_apresLheureCible_rattrapeLeJourMeme() {
        // Le serveur etait arrete a 08:00. A 13:00 Paris, le briefing du jour
        // doit encore partir : mieux vaut tard que jamais.
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 12, 0);
        assertTrue(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_marrakechTimezone_handled() {
        // Marrakech est UTC+1 en hiver. 07:00 UTC = 08:00 Marrakech → match.
        AssistantBriefingPref p = pref("Africa/Casablanca", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 7, 0);
        assertTrue(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_invalidTimezone_returnsFalse() {
        AssistantBriefingPref p = pref("Mars/Olympus", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 7, 0);
        assertFalse(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_disabled_returnsFalse() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, false);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 7, 0);
        assertFalse(scheduler.shouldTrigger(p, utc));
    }

    @Test
    void shouldTrigger_hebdo_avantLeDimancheCible_returnsFalse() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(9, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        // 2026-01-18 est un dimanche ; 07:00 UTC = 08:00 Paris, avant la cible 09:00
        LocalDateTime sundayEarlyUtc = LocalDateTime.of(2026, 1, 18, 7, 0);
        assertFalse(scheduler.shouldTrigger(p, sundayEarlyUtc));
    }

    @Test
    void shouldTrigger_hebdo_desLeDimancheCible_returnsTrue() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(9, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        // 2026-01-18 dimanche, 08:00 UTC = 09:00 Paris
        LocalDateTime sundayUtc = LocalDateTime.of(2026, 1, 18, 8, 0);
        assertTrue(scheduler.shouldTrigger(p, sundayUtc));
    }

    @Test
    void shouldTrigger_hebdo_dimancheManque_rattrapeEnSemaine() {
        // Le serveur etait arrete le dimanche 08:00 — c'etait UNE semaine perdue,
        // sans trace ni retry. Le mercredi suivant, la synthese doit partir.
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(9, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        // 2026-01-21 est un mercredi, dimanche precedent = 2026-01-18
        LocalDateTime wednesdayUtc = LocalDateTime.of(2026, 1, 21, 12, 0);
        assertTrue(scheduler.shouldTrigger(p, wednesdayUtc));
    }

    @Test
    void periodStart_hebdo_remonteAuDimanchePrecedent() {
        // Mercredi 2026-01-21 → dimanche 2026-01-18
        assertEquals(LocalDate.of(2026, 1, 18), AssistantBriefingScheduler.periodStart(
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, LocalDate.of(2026, 1, 21)));
        // Un dimanche est son propre debut de periode
        assertEquals(LocalDate.of(2026, 1, 18), AssistantBriefingScheduler.periodStart(
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, LocalDate.of(2026, 1, 18)));
        // Quotidien : la periode est la journee
        assertEquals(LocalDate.of(2026, 1, 21), AssistantBriefingScheduler.periodStart(
                AssistantBriefingPref.Frequency.DAILY_MORNING, LocalDate.of(2026, 1, 21)));
    }

    @Test
    void shouldTrigger_onlyAlerts_firesEveryDay() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.ONLY_ALERTS, true);
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 7, 0);
        assertTrue(scheduler.shouldTrigger(p, utc));
    }

    // ─── runFor : full pipeline ────────────────────────────────────────────

    @Test
    void runFor_matchingPref_triggersComposeAndDispatch() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
        BriefingComposer.BriefingResult result = new BriefingComposer.BriefingResult(
                42L, "Briefing du jour", AssistantBriefingPref.Frequency.DAILY_MORNING);
        when(composer.compose(p)).thenReturn(result);
        when(delivery.dispatch(any(), eq("user-x"), eq(1L), eq(List.of("in_app"))))
                .thenReturn(List.of("in_app"));

        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0));

        verify(composer).compose(p);
        verify(delivery).dispatch(any(), eq("user-x"), eq(1L), any());
        verify(logRepository, atLeastOnce()).save(any(AssistantBriefingLog.class));
    }

    @Test
    void runFor_heureCibleNonAtteinte_skipsAll() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));

        // 05:00 UTC = 06:00 Paris → avant 08:00 → skip
        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 5, 0));

        verifyNoInteractions(composer);
        verifyNoInteractions(delivery);
    }

    @Test
    void runFor_hebdo_dimancheManque_rattrapeEnSemaine() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
        when(composer.compose(p)).thenReturn(new BriefingComposer.BriefingResult(
                42L, "Revue", AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));
        when(delivery.dispatch(any(), eq("user-x"), eq(1L), any())).thenReturn(List.of("in_app"));

        // Mercredi 2026-01-21, 12:00 UTC : le dimanche 18 est passe sans envoi
        scheduler.runFor(LocalDateTime.of(2026, 1, 21, 12, 0));

        verify(composer).compose(p);
        // La borne d'idempotence interrogee est bien le dimanche, pas le mercredi
        verify(logRepository).existsByKeycloakIdAndBriefingDateGreaterThanEqual(
                eq("user-x"), eq(LocalDate.of(2026, 1, 18)));
    }

    @Test
    void runFor_hebdo_dejaEnvoyeDepuisDimanche_neRepartPas() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
        when(logRepository.existsByKeycloakIdAndBriefingDateGreaterThanEqual(
                eq("user-x"), any(LocalDate.class))).thenReturn(true);

        // Un rattrapage du mardi ne doit pas re-partir le mercredi, ni les jours suivants
        scheduler.runFor(LocalDateTime.of(2026, 1, 21, 12, 0));

        verifyNoInteractions(composer);
        verifyNoInteractions(delivery);
        verify(logRepository, never()).save(any());
    }

    @Test
    void runFor_idempotent_skipsIfLogAlreadyExists() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
        when(logRepository.existsByKeycloakIdAndBriefingDateGreaterThanEqual(
                eq("user-x"), any(LocalDate.class))).thenReturn(true);

        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0));

        verifyNoInteractions(composer);
        verifyNoInteractions(delivery);
        verify(logRepository, never()).save(any());
    }

    @Test
    void runFor_composerReturnsNull_logsFailedButNoCrash() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
        when(composer.compose(p)).thenReturn(null);

        assertDoesNotThrow(() -> scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0)));

        // Le log initial est cree puis save de nouveau avec status FAILED
        org.mockito.ArgumentCaptor<AssistantBriefingLog> cap =
                org.mockito.ArgumentCaptor.forClass(AssistantBriefingLog.class);
        verify(logRepository, atLeast(2)).save(cap.capture());
        AssistantBriefingLog last = cap.getAllValues().get(cap.getAllValues().size() - 1);
        assertEquals(AssistantBriefingLog.Status.FAILED, last.getStatusEnum());
        assertNotNull(last.getErrorMessage());
    }

    @Test
    void runFor_oneUserFailing_doesNotBreakOthers() {
        AssistantBriefingPref ok = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        ok.setKeycloakId("user-ok");
        AssistantBriefingPref bad = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        bad.setKeycloakId("user-bad");
        when(prefService.listEffectivePrefs()).thenReturn(List.of(bad, ok));

        when(composer.compose(bad)).thenThrow(new RuntimeException("boom"));
        when(composer.compose(ok)).thenReturn(new BriefingComposer.BriefingResult(
                7L, "OK", AssistantBriefingPref.Frequency.DAILY_MORNING));
        when(delivery.dispatch(any(), eq("user-ok"), any(), any()))
                .thenReturn(List.of("in_app"));

        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0));

        // user-ok est bien delivere malgre l'echec de user-bad
        verify(delivery).dispatch(any(), eq("user-ok"), any(), any());
    }

    // ─── Desabonnement (preference de notification) ─────────────────────────

    @org.junit.jupiter.api.Nested
    class Desabonnement {

        private com.clenzy.service.NotificationPreferenceService preferenceService;
        private AssistantBriefingScheduler withPreferences;

        @BeforeEach
        void setUp() {
            preferenceService = mock(com.clenzy.service.NotificationPreferenceService.class);
            withPreferences = new AssistantBriefingScheduler(prefService, composer, delivery,
                    logRepository, new ObjectMapper(), preferenceService);
        }

        @Test
        void inAppCoupe_aucunBriefingNestGenere() {
            // Le coeur du desabonnement : on ne doit meme pas APPELER le LLM.
            when(preferenceService.isEnabled(anyString(),
                    eq(com.clenzy.model.NotificationKey.BRIEFING_READY))).thenReturn(false);
            AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                    AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
            when(prefService.listEffectivePrefs()).thenReturn(List.of(p));

            // 2026-01-18 est un dimanche ; 07:00 UTC = 08:00 Paris.
            withPreferences.runFor(LocalDateTime.of(2026, 1, 18, 7, 0));

            verify(composer, never()).compose(any());
            verify(delivery, never()).dispatch(any(), anyString(), any(), any());
            verify(logRepository, never()).save(any(AssistantBriefingLog.class));
        }

        @Test
        void inAppActif_leBriefingPart() {
            when(preferenceService.isEnabled(anyString(),
                    eq(com.clenzy.model.NotificationKey.BRIEFING_READY))).thenReturn(true);
            AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                    AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
            when(prefService.listEffectivePrefs()).thenReturn(List.of(p));
            when(composer.compose(any())).thenReturn(new BriefingComposer.BriefingResult(
                    9L, "Revue", AssistantBriefingPref.Frequency.WEEKLY_SUNDAY));
            when(delivery.dispatch(any(), anyString(), any(), any())).thenReturn(List.of("in_app"));

            withPreferences.runFor(LocalDateTime.of(2026, 1, 18, 7, 0));

            verify(composer).compose(any());
        }

        @Test
        void emailDemande_lePreferenceInAppNeCoupePas() {
            // Email n'a pas d'interrupteur dedie : couper la notification in-app
            // ne doit pas priver l'utilisateur de son email.
            when(preferenceService.isEnabled(anyString(), any())).thenReturn(false);
            when(prefService.parseChannels(any(AssistantBriefingPref.class)))
                    .thenReturn(List.of("in_app", "email"));

            assertFalse(withPreferences.isFullyMuted("user-x", List.of("in_app", "email")));
        }

        @Test
        void preferencesIllisibles_leBriefingEstMaintenu() {
            // Mieux vaut un briefing de trop qu'un desabonnement silencieux
            // provoque par une panne de base.
            when(preferenceService.isEnabled(anyString(), any()))
                    .thenThrow(new RuntimeException("base indisponible"));

            assertFalse(withPreferences.isFullyMuted("user-x", List.of("in_app")));
        }
    }
}
