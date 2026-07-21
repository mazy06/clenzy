package com.clenzy.service.agent.supervision;

import com.clenzy.model.GuestMessageLog;
import com.clenzy.model.MessageChannelType;
import com.clenzy.model.MessageStatus;
import com.clenzy.model.MessageTemplate;
import com.clenzy.model.MessageTemplateType;
import com.clenzy.model.Reservation;
import com.clenzy.model.SupervisionSuggestion;
import com.clenzy.repository.GuestMessageLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Scanner « echec d'envoi voyageur » : emet une carte informationnelle Communication
 * pour chaque reservation avec un envoi FAILED recent non resolu, n'emet pas si un
 * renvoi du meme type a abouti depuis, et auto-resout les cartes PENDING obsoletes.
 */
@ExtendWith(MockitoExtension.class)
class GuestMessageFailedScannerTest {

    private static final Long ORG = 1L;
    private static final Long PROP = 3L;
    private static final Long RES_ID = 18L;
    private static final String TOOL = "guest_message_failed";

    @Mock private GuestMessageLogRepository messageLogRepository;
    @Mock private SupervisionSuggestionService suggestionService;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-21T10:00:00Z"), ZoneOffset.UTC);

    private GuestMessageFailedScanner scanner() {
        return new GuestMessageFailedScanner(messageLogRepository, suggestionService, clock);
    }

    private GuestMessageLog failedLog(String reservationStatus) {
        Reservation reservation = new Reservation();
        reservation.setId(RES_ID);
        reservation.setStatus(reservationStatus);

        MessageTemplate template = new MessageTemplate();
        template.setName("Information Check-in");
        template.setType(MessageTemplateType.CHECK_IN);

        GuestMessageLog log = new GuestMessageLog();
        log.setOrganizationId(ORG);
        log.setReservation(reservation);
        log.setTemplate(template);
        log.setChannel(MessageChannelType.EMAIL);
        log.setRecipient("N/A");
        log.setStatus(MessageStatus.FAILED);
        log.setErrorMessage("Pas de destinataire pour le canal EMAIL");
        return log;
    }

    @Test
    void unresolvedFailure_emitsWarningCardWithReservation() {
        when(messageLogRepository.findRecentFailedByProperty(eq(ORG), eq(PROP), any()))
                .thenReturn(List.of(failedLog("confirmed")));
        when(messageLogRepository.existsDeliveredAfter(eq(RES_ID), eq(MessageTemplateType.CHECK_IN), any()))
                .thenReturn(false);
        when(suggestionService.findPendingByTool(ORG, PROP, TOOL)).thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).record(eq(ORG), eq(PROP), eq("com"), eq(TOOL),
                anyString(), anyString(), eq(RES_ID), eq("warning"));
    }

    @Test
    void failureFollowedBySuccessfulResend_doesNotEmit() {
        when(messageLogRepository.findRecentFailedByProperty(eq(ORG), eq(PROP), any()))
                .thenReturn(List.of(failedLog("confirmed")));
        when(messageLogRepository.existsDeliveredAfter(eq(RES_ID), eq(MessageTemplateType.CHECK_IN), any()))
                .thenReturn(true);
        when(suggestionService.findPendingByTool(ORG, PROP, TOOL)).thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void cancelledReservation_doesNotEmit() {
        when(messageLogRepository.findRecentFailedByProperty(eq(ORG), eq(PROP), any()))
                .thenReturn(List.of(failedLog("cancelled")));
        when(suggestionService.findPendingByTool(ORG, PROP, TOOL)).thenReturn(List.of());

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void pendingCardWhoseFailureIsResolved_isDismissed() {
        when(messageLogRepository.findRecentFailedByProperty(eq(ORG), eq(PROP), any()))
                .thenReturn(List.of());
        SupervisionSuggestion stale = new SupervisionSuggestion();
        stale.setId(42L);
        stale.setReservationId(RES_ID);
        when(suggestionService.findPendingByTool(ORG, PROP, TOOL)).thenReturn(List.of(stale));

        scanner().scanProperty(ORG, PROP);

        verify(suggestionService).dismiss(ORG, 42L);
        verify(suggestionService, never()).record(anyLong(), anyLong(), anyString(), anyString(),
                anyString(), anyString(), anyLong(), anyString());
    }

    @Test
    void repositoryError_isAbsorbed() {
        when(messageLogRepository.findRecentFailedByProperty(eq(ORG), eq(PROP), any()))
                .thenThrow(new RuntimeException("db down"));

        scanner().scanProperty(ORG, PROP); // ne doit pas propager
    }
}
