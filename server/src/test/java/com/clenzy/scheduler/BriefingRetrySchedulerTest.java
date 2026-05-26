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
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class BriefingRetrySchedulerTest {

    private static final Instant T0 = Instant.parse("2026-05-26T10:00:00Z");

    private AssistantBriefingLogRepository logRepository;
    private AssistantBriefingPrefService prefService;
    private BriefingComposer composer;
    private BriefingDelivery delivery;
    private ObjectMapper objectMapper;
    private Clock clock;

    @BeforeEach
    void setUp() {
        logRepository = mock(AssistantBriefingLogRepository.class);
        prefService = mock(AssistantBriefingPrefService.class);
        composer = mock(BriefingComposer.class);
        delivery = mock(BriefingDelivery.class);
        objectMapper = new ObjectMapper();
        clock = Clock.fixed(T0, ZoneId.of("UTC"));
    }

    private BriefingRetryScheduler scheduler(boolean enabled) {
        return new BriefingRetryScheduler(logRepository, prefService, composer, delivery,
                objectMapper, clock, enabled);
    }

    @Test
    void runOnce_disabled_returnsZero_noLookup() {
        scheduler(false).runOnce();
        verifyNoInteractions(logRepository);
    }

    @Test
    void runOnce_lookupFails_returnsZero_doesNotThrow() {
        when(logRepository.findFailedSince(any())).thenThrow(new RuntimeException("DB"));
        assertEquals(0, scheduler(true).runOnce());
    }

    @Test
    void runOnce_noFailed_returnsZero() {
        when(logRepository.findFailedSince(any())).thenReturn(List.of());
        assertEquals(0, scheduler(true).runOnce());
        verifyNoInteractions(delivery);
    }

    @Test
    void runOnce_retrySuccess_marksLogAsSent() {
        AssistantBriefingLog failed = newFailedLog(7L, 99L);
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        // CAS acquired par CETTE instance (autres = 0)
        when(logRepository.tryAcquireRetry(7L)).thenReturn(1);
        when(logRepository.findById(7L)).thenReturn(Optional.of(failed));

        AssistantBriefingPref pref = newPref();
        when(prefService.get("user-1")).thenReturn(Optional.of(pref));
        when(prefService.parseChannels(pref)).thenReturn(List.of("in_app", "email"));
        when(delivery.dispatch(any(), eq("user-1"), eq(1L), any()))
                .thenReturn(List.of("in_app", "email"));
        when(logRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int recovered = scheduler(true).runOnce();

        assertEquals(1, recovered);
        ArgumentCaptor<AssistantBriefingLog> savedCap =
                ArgumentCaptor.forClass(AssistantBriefingLog.class);
        verify(logRepository).save(savedCap.capture());
        assertEquals(AssistantBriefingLog.Status.SENT, savedCap.getValue().getStatusEnum());
        verifyNoInteractions(composer);
    }

    @Test
    void runOnce_casLost_skipsWithoutDispatch() {
        // Scenario HA : autre instance a deja acquis le retry → tryAcquireRetry=0
        AssistantBriefingLog failed = newFailedLog(7L, 99L);
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        when(logRepository.tryAcquireRetry(7L)).thenReturn(0);

        int recovered = scheduler(true).runOnce();

        assertEquals(0, recovered);
        // Aucun dispatch ne doit etre fait
        verifyNoInteractions(delivery);
        verifyNoInteractions(composer);
        // Pas de save non plus — l'autre instance s'en occupe
        verify(logRepository, never()).save(any());
    }

    @Test
    void runOnce_retryStillFails_revertsToFailed() {
        AssistantBriefingLog failed = newFailedLog(7L, 99L);
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        when(logRepository.tryAcquireRetry(7L)).thenReturn(1);
        when(logRepository.findById(7L)).thenReturn(Optional.of(failed));

        AssistantBriefingPref pref = newPref();
        when(prefService.get("user-1")).thenReturn(Optional.of(pref));
        when(prefService.parseChannels(pref)).thenReturn(List.of("email"));
        when(delivery.dispatch(any(), any(), any(), any())).thenReturn(List.of());
        when(logRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int recovered = scheduler(true).runOnce();

        assertEquals(0, recovered);
        ArgumentCaptor<AssistantBriefingLog> cap = ArgumentCaptor.forClass(AssistantBriefingLog.class);
        verify(logRepository).save(cap.capture());
        // Le revert remet bien FAILED (pas RETRYING) pour qu'un tick ulterieur retente
        assertEquals(AssistantBriefingLog.Status.FAILED, cap.getValue().getStatusEnum());
        assertTrue(cap.getValue().getErrorMessage().contains("still no channel"));
    }

    @Test
    void runOnce_userNoLongerHasPref_revertsToFailedAndSkips() {
        AssistantBriefingLog failed = newFailedLog(7L, 99L);
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        when(logRepository.tryAcquireRetry(7L)).thenReturn(1);
        when(logRepository.findById(7L)).thenReturn(Optional.of(failed));
        when(prefService.get("user-1")).thenReturn(Optional.empty());
        when(logRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertEquals(0, scheduler(true).runOnce());
        // Save attendu pour revert le status (sinon le log reste bloque en RETRYING)
        verify(logRepository).save(any(AssistantBriefingLog.class));
        verifyNoInteractions(delivery);
    }

    @Test
    void runOnce_noConversationId_recomposesFromScratch() {
        AssistantBriefingLog failed = newFailedLog(7L, null); // pas de conv
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        when(logRepository.tryAcquireRetry(7L)).thenReturn(1);
        when(logRepository.findById(7L)).thenReturn(Optional.of(failed));

        AssistantBriefingPref pref = newPref();
        when(prefService.get("user-1")).thenReturn(Optional.of(pref));
        when(prefService.parseChannels(pref)).thenReturn(List.of("in_app"));
        when(composer.compose(pref)).thenReturn(new BriefingComposer.BriefingResult(
                42L, "compose", AssistantBriefingPref.Frequency.DAILY_MORNING));
        when(delivery.dispatch(any(), any(), any(), any())).thenReturn(List.of("in_app"));
        when(logRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        int recovered = scheduler(true).runOnce();
        assertEquals(1, recovered);
        verify(composer).compose(pref);
    }

    @Test
    void runOnce_composeReturnsNull_revertsToFailedWithMessage() {
        AssistantBriefingLog failed = newFailedLog(7L, null);
        when(logRepository.findFailedSince(any())).thenReturn(List.of(failed));
        when(logRepository.tryAcquireRetry(7L)).thenReturn(1);
        when(logRepository.findById(7L)).thenReturn(Optional.of(failed));

        AssistantBriefingPref pref = newPref();
        when(prefService.get("user-1")).thenReturn(Optional.of(pref));
        when(composer.compose(pref)).thenReturn(null);
        when(logRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertEquals(0, scheduler(true).runOnce());
        verify(logRepository).save(failed);
        assertEquals(AssistantBriefingLog.Status.FAILED, failed.getStatusEnum());
        assertTrue(failed.getErrorMessage().contains("compose returned null"));
    }

    @Test
    void runWeekly_delegatesToRunOnce() {
        // Disabled → pas de lookup
        scheduler(false).runHourly();
        verifyNoInteractions(logRepository);
    }

    private static AssistantBriefingLog newFailedLog(Long id, Long conversationId) {
        AssistantBriefingLog log = new AssistantBriefingLog(
                1L, "user-1", LocalDate.now(), "daily_morning");
        log.setId(id);
        log.setStatusEnum(AssistantBriefingLog.Status.FAILED);
        log.setConversationId(conversationId);
        log.setSentAt(LocalDateTime.now());
        return log;
    }

    private static AssistantBriefingPref newPref() {
        AssistantBriefingPref pref = new AssistantBriefingPref();
        pref.setOrganizationId(1L);
        pref.setKeycloakId("user-1");
        pref.setEnabled(true);
        pref.setFrequency("daily_morning");
        return pref;
    }
}
