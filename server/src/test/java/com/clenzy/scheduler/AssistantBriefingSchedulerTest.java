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
import java.util.Optional;

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
        // Defaults : pas de log preexistant, save retourne l'arg
        when(logRepository.findByKeycloakIdAndBriefingDate(anyString(), any(LocalDate.class)))
                .thenReturn(Optional.empty());
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
    void shouldTrigger_localHourMismatch_returnsFalse() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        // 12:00 UTC = 13:00 Paris → ne matche pas 08:00
        LocalDateTime utc = LocalDateTime.of(2026, 1, 15, 12, 0);
        assertFalse(scheduler.shouldTrigger(p, utc));
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
    void shouldTrigger_weeklySunday_onlyFiresOnSunday() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(9, 0),
                AssistantBriefingPref.Frequency.WEEKLY_SUNDAY, true);
        // 2026-01-15 est un jeudi → match l'heure mais pas dimanche
        LocalDateTime thursdayUtc = LocalDateTime.of(2026, 1, 15, 8, 0);
        assertFalse(scheduler.shouldTrigger(p, thursdayUtc));
        // 2026-01-18 est un dimanche → match
        LocalDateTime sundayUtc = LocalDateTime.of(2026, 1, 18, 8, 0);
        assertTrue(scheduler.shouldTrigger(p, sundayUtc));
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
        when(prefService.listAllEnabled()).thenReturn(List.of(p));
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
    void runFor_noMatchingHour_skipsAll() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listAllEnabled()).thenReturn(List.of(p));

        // 12:00 UTC = 13:00 Paris → pas a 08:00 → skip
        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 12, 0));

        verifyNoInteractions(composer);
        verifyNoInteractions(delivery);
    }

    @Test
    void runFor_idempotent_skipsIfLogAlreadyExists() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listAllEnabled()).thenReturn(List.of(p));
        when(logRepository.findByKeycloakIdAndBriefingDate(eq("user-x"), any(LocalDate.class)))
                .thenReturn(Optional.of(new AssistantBriefingLog()));

        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0));

        verifyNoInteractions(composer);
        verifyNoInteractions(delivery);
        verify(logRepository, never()).save(any());
    }

    @Test
    void runFor_composerReturnsNull_logsFailedButNoCrash() {
        AssistantBriefingPref p = pref("Europe/Paris", LocalTime.of(8, 0),
                AssistantBriefingPref.Frequency.DAILY_MORNING, true);
        when(prefService.listAllEnabled()).thenReturn(List.of(p));
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
        when(prefService.listAllEnabled()).thenReturn(List.of(bad, ok));

        when(composer.compose(bad)).thenThrow(new RuntimeException("boom"));
        when(composer.compose(ok)).thenReturn(new BriefingComposer.BriefingResult(
                7L, "OK", AssistantBriefingPref.Frequency.DAILY_MORNING));
        when(delivery.dispatch(any(), eq("user-ok"), any(), any()))
                .thenReturn(List.of("in_app"));

        scheduler.runFor(LocalDateTime.of(2026, 1, 15, 7, 0));

        // user-ok est bien delivere malgre l'echec de user-bad
        verify(delivery).dispatch(any(), eq("user-ok"), any(), any());
    }
}
