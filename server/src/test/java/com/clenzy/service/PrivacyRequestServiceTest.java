package com.clenzy.service;

import com.clenzy.model.Conversation;
import com.clenzy.model.Guest;
import com.clenzy.model.PrivacyRequest;
import com.clenzy.model.Reservation;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.PrivacyRequestRepository;
import com.clenzy.repository.ReservationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PrivacyRequestServiceTest {

    private static final Long ORG_ID = 7L;

    @Mock private PrivacyRequestRepository privacyRequestRepository;
    @Mock private GuestRepository guestRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private ConversationRepository conversationRepository;
    @Mock private ConversationMessageRepository conversationMessageRepository;

    private final Clock clock = Clock.fixed(Instant.parse("2026-07-02T10:00:00Z"), ZoneId.of("UTC"));

    private PrivacyRequestService service;

    @BeforeEach
    void setUp() {
        service = new PrivacyRequestService(privacyRequestRepository, guestRepository,
                reservationRepository, conversationRepository, conversationMessageRepository,
                new ObjectMapper(), clock);
    }

    private PrivacyRequest erasureRequest(Long guestId) {
        PrivacyRequest request = new PrivacyRequest();
        request.setOrganizationId(ORG_ID);
        request.setGuestId(guestId);
        request.setRequesterEmail("guest@example.com");
        request.setType(PrivacyRequest.Type.ERASURE);
        request.setRequestedAt(LocalDate.parse("2026-06-20"));
        request.setDueAt(LocalDate.parse("2026-07-20"));
        when(privacyRequestRepository.findByIdAndOrganizationId(31L, ORG_ID))
                .thenReturn(Optional.of(request));
        return request;
    }

    @Test
    @DisplayName("whenErasureExecutes_thenGuestAnonymizedMessagesPurgedAndReportPersisted")
    void whenErasureExecutes_thenGuestAnonymizedMessagesPurgedAndReportPersisted() {
        erasureRequest(5L);
        when(privacyRequestRepository.markInProgress(31L, ORG_ID, "user:kc-9")).thenReturn(1);
        Guest guest = new Guest();
        guest.setId(5L);
        guest.setFirstName("Amina");
        guest.setLastName("Benali");
        guest.setEmail("amina@example.com");
        when(guestRepository.findByIdAndOrganizationId(5L, ORG_ID)).thenReturn(Optional.of(guest));
        Reservation reservation = new Reservation();
        reservation.setOrganizationId(ORG_ID);
        reservation.setGuestName("Amina Benali");
        when(reservationRepository.findByGuestId(5L)).thenReturn(List.of(reservation));
        Conversation conversation = new Conversation();
        org.springframework.test.util.ReflectionTestUtils.setField(conversation, "id", 14L);
        when(conversationRepository.findByOrganizationIdAndGuestId(ORG_ID, 5L))
                .thenReturn(List.of(conversation));
        when(conversationMessageRepository.purgeContentForConversations(anyList(), anyString(), anyString()))
                .thenReturn(12);
        when(privacyRequestRepository.markCompleted(eq(31L), eq(ORG_ID), any(), anyString()))
                .thenReturn(1);

        PrivacyRequest result = service.executeErasure(31L, ORG_ID, "user:kc-9");

        assertThat(guest.getFirstName()).isEqualTo("Voyageur");
        assertThat(guest.getEmail()).isNull();
        assertThat(guest.getPhoneHash()).isNull();
        assertThat(reservation.getGuestName()).isEqualTo("Voyageur anonymisé");
        assertThat(conversation.getLastMessagePreview())
                .isEqualTo(PrivacyRequestService.MESSAGE_PLACEHOLDER);
        assertThat(result.getReport())
                .contains("\"messagesPurged\":12")
                .contains("obligation comptable");
        verify(privacyRequestRepository).markCompleted(eq(31L), eq(ORG_ID), any(),
                org.mockito.ArgumentMatchers.contains("fiches police"));
    }

    @Test
    @DisplayName("whenErasureAlreadyRunning_thenRefusedAndNothingTouched")
    void whenErasureAlreadyRunning_thenRefusedAndNothingTouched() {
        erasureRequest(5L);
        when(privacyRequestRepository.markInProgress(31L, ORG_ID, "user:kc-9")).thenReturn(0);

        assertThatThrownBy(() -> service.executeErasure(31L, ORG_ID, "user:kc-9"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("déjà traitée");
        verify(guestRepository, never()).save(any());
    }

    @Test
    @DisplayName("whenErasureHasNoLinkedGuest_thenRefusedBeforeLock")
    void whenErasureHasNoLinkedGuest_thenRefusedBeforeLock() {
        erasureRequest(null);

        assertThatThrownBy(() -> service.executeErasure(31L, ORG_ID, "user:kc-9"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("voyageur");
        verify(privacyRequestRepository, never()).markInProgress(any(), any(), anyString());
    }
}
