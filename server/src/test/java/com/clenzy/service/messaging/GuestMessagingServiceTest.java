package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GuestMessagingServiceTest {

    @Mock private EmailChannel emailChannel;
    @Mock private TemplateInterpolationService interpolationService;
    @Mock private GuestMessageLogRepository messageLogRepository;
    @Mock private CheckInInstructionsRepository instructionsRepository;
    @Mock private MessageTemplateRepository templateRepository;
    @Mock private ReservationRepository reservationRepository;
    @Mock private NotificationService notificationService;

    @InjectMocks
    private GuestMessagingService service;

    private Reservation reservation;
    private MessageTemplate template;
    private Guest guest;
    private Property property;
    private User owner;

    @BeforeEach
    void setUp() {
        owner = new User();
        owner.setKeycloakId("owner-kc-id");

        property = new Property();
        property.setId(10L);
        property.setName("Studio Test");
        property.setOwner(owner);

        guest = new Guest();
        guest.setFirstName("Marie");
        guest.setLastName("Martin");
        guest.setEmail("marie@example.com");
        guest.setPhone("+33612345678");

        reservation = new Reservation();
        reservation.setId(100L);
        reservation.setProperty(property);
        reservation.setGuest(guest);
        reservation.setCheckIn(LocalDate.of(2026, 4, 1));
        reservation.setCheckOut(LocalDate.of(2026, 4, 5));
        reservation.setGuestName("Marie Martin");

        template = new MessageTemplate();
        template.setId(1L);
        template.setName("Check-in Template");
        template.setSubject("Welcome");
        template.setBody("Hello {guestName}");
    }

    @Test
    void whenSendMessage_thenLoadsReservationAndTemplate() {
        Long orgId = 1L;

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(templateRepository.findByIdAndOrganizationId(1L, orgId)).thenReturn(Optional.of(template));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, orgId)).thenReturn(Optional.empty());
        when(interpolationService.interpolate(any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Welcome", "<p>Hello</p>", "Hello"));
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("msg-id-1"));
        when(messageLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GuestMessageLog result = service.sendMessage(100L, 1L, orgId);

        assertNotNull(result);
        assertEquals(MessageStatus.SENT, result.getStatus());
        assertEquals("marie@example.com", result.getRecipient());
        verify(emailChannel).send(any(MessageDeliveryRequest.class));
    }

    @Test
    void whenGuestHasNoEmail_thenStatusIsFailed() {
        Long orgId = 1L;
        guest.setEmail(null);

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(templateRepository.findByIdAndOrganizationId(1L, orgId)).thenReturn(Optional.of(template));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, orgId)).thenReturn(Optional.empty());
        when(interpolationService.interpolate(any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Welcome", "<p>Hello</p>", "Hello"));
        when(messageLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GuestMessageLog result = service.sendMessage(100L, 1L, orgId);

        assertEquals(MessageStatus.FAILED, result.getStatus());
        assertTrue(result.getErrorMessage().contains("email"));
        verify(emailChannel, never()).send(any());
    }

    @Test
    void whenEmailSendFails_thenStatusIsFailed() {
        Long orgId = 1L;

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(templateRepository.findByIdAndOrganizationId(1L, orgId)).thenReturn(Optional.of(template));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, orgId)).thenReturn(Optional.empty());
        when(interpolationService.interpolate(any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Welcome", "<p>Hello</p>", "Hello"));
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.failure("SMTP timeout"));
        when(messageLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        GuestMessageLog result = service.sendMessage(100L, 1L, orgId);

        assertEquals(MessageStatus.FAILED, result.getStatus());
        assertEquals("SMTP timeout", result.getErrorMessage());
    }

    @Test
    void whenSendSucceeds_thenNotificationIsSent() {
        Long orgId = 1L;

        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(templateRepository.findByIdAndOrganizationId(1L, orgId)).thenReturn(Optional.of(template));
        when(instructionsRepository.findByPropertyIdAndOrganizationId(10L, orgId)).thenReturn(Optional.empty());
        when(interpolationService.interpolate(any(), any(), any(), any(), any()))
            .thenReturn(new TemplateInterpolationService.InterpolatedMessage("Welcome", "<p>Hello</p>", "Hello"));
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("msg-id-2"));
        when(messageLogRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.sendMessage(100L, 1L, orgId);

        verify(notificationService).send(eq("owner-kc-id"), eq(NotificationKey.GUEST_MESSAGE_SENT), anyString(), anyString(), any());
    }

    @Test
    void whenReservationNotFound_thenThrows() {
        when(reservationRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () ->
            service.sendMessage(999L, 1L, 1L));
    }

    @Test
    void whenTemplateNotFound_thenThrows() {
        when(reservationRepository.findById(100L)).thenReturn(Optional.of(reservation));
        when(templateRepository.findByIdAndOrganizationId(999L, 1L)).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () ->
            service.sendMessage(100L, 999L, 1L));
    }

    @Test
    void whenAlreadySent_thenReturnsTrueFromRepo() {
        when(messageLogRepository.existsSentOrPendingByReservationAndType(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(true);

        assertTrue(service.alreadySent(100L, MessageTemplateType.CHECK_IN));
    }

    @Test
    void whenNotAlreadySent_thenReturnsFalse() {
        when(messageLogRepository.existsSentOrPendingByReservationAndType(100L, MessageTemplateType.CHECK_IN))
            .thenReturn(false);

        assertFalse(service.alreadySent(100L, MessageTemplateType.CHECK_IN));
    }
}
