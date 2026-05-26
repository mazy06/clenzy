package com.clenzy.service.agent.briefing;

import com.clenzy.model.AssistantBriefingPref;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.User;
import com.clenzy.model.WhatsAppConfig;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.WhatsAppConfigRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.service.messaging.EmailChannel;
import com.clenzy.service.messaging.MessageDeliveryRequest;
import com.clenzy.service.messaging.MessageDeliveryResult;
import com.clenzy.service.messaging.WhatsAppApiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class BriefingDeliveryTest {

    private NotificationService notificationService;
    private EmailChannel emailChannel;
    private WhatsAppApiService whatsAppApiService;
    private UserRepository userRepository;
    private WhatsAppConfigRepository whatsAppConfigRepository;
    private BriefingDelivery delivery;

    @BeforeEach
    void setUp() {
        notificationService = mock(NotificationService.class);
        emailChannel = mock(EmailChannel.class);
        whatsAppApiService = mock(WhatsAppApiService.class);
        userRepository = mock(UserRepository.class);
        whatsAppConfigRepository = mock(WhatsAppConfigRepository.class);
        delivery = new BriefingDelivery(notificationService, emailChannel, whatsAppApiService,
                userRepository, whatsAppConfigRepository);
    }

    private static BriefingComposer.BriefingResult sample() {
        return new BriefingComposer.BriefingResult(
                42L, "Voici ton briefing : hier, KPIs OK, 3 reservations à venir.",
                AssistantBriefingPref.Frequency.DAILY_MORNING);
    }

    private static User user(String email, String phone) {
        User u = new User();
        u.setKeycloakId("user-x");
        u.setEmail(email);
        u.setFirstName("Alice");
        u.setLastName("Doe");
        u.setPhoneNumber(phone);
        return u;
    }

    // ─── in_app ─────────────────────────────────────────────────────────────

    @Test
    void dispatch_inAppOnly_callsNotificationService() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("a@b.com", null)));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("in_app"));

        assertEquals(List.of("in_app"), delivered);
        ArgumentCaptor<String> actionUrl = ArgumentCaptor.forClass(String.class);
        verify(notificationService).send(eq("user-x"),
                eq(NotificationKey.BRIEFING_READY),
                eq("Briefing matinal"), anyString(), actionUrl.capture(), eq(1L));
        assertEquals("/assistant/conversations/42", actionUrl.getValue());
        verifyNoInteractions(emailChannel);
        verifyNoInteractions(whatsAppApiService);
    }

    @Test
    void dispatch_inApp_serviceFailure_dropsChannel() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("a@b.com", null)));
        doThrow(new RuntimeException("notify down"))
                .when(notificationService).send(any(), any(), any(), any(), any(), any());

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("in_app"));
        assertTrue(delivered.isEmpty());
    }

    // ─── email ──────────────────────────────────────────────────────────────

    @Test
    void dispatch_email_buildsHtmlAndCallsChannel() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("alice@example.com", null)));
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any(MessageDeliveryRequest.class)))
                .thenReturn(MessageDeliveryResult.success("msg-1"));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("email"));

        assertEquals(List.of("email"), delivered);
        ArgumentCaptor<MessageDeliveryRequest> reqCap =
                ArgumentCaptor.forClass(MessageDeliveryRequest.class);
        verify(emailChannel).send(reqCap.capture());
        MessageDeliveryRequest req = reqCap.getValue();
        assertEquals("alice@example.com", req.recipientEmail());
        assertEquals("Alice Doe", req.recipientName());
        assertTrue(req.subject().startsWith("[Clenzy]"));
        assertTrue(req.htmlBody().contains("Briefing matinal"));
    }

    @Test
    void dispatch_email_skippedWhenNoEmail() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user(null, null)));
        when(emailChannel.isAvailable()).thenReturn(true);

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("email"));
        assertTrue(delivered.isEmpty());
        // L'email channel n'est pas appele pour ENVOYER (le user n'a pas d'email).
        // isAvailable() peut etre invoque avant le check email, c'est OK.
        verify(emailChannel, never()).send(any());
    }

    @Test
    void dispatch_email_skippedWhenChannelUnavailable() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("a@b.com", null)));
        when(emailChannel.isAvailable()).thenReturn(false);

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("email"));
        assertTrue(delivered.isEmpty());
        verify(emailChannel, never()).send(any());
    }

    @Test
    void dispatch_email_failureResult_dropsChannel() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("a@b.com", null)));
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.failure("SMTP down"));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("email"));
        assertTrue(delivered.isEmpty());
    }

    // ─── whatsapp ───────────────────────────────────────────────────────────

    @Test
    void dispatch_whatsapp_callsTemplateApi() {
        when(userRepository.findByKeycloakId("user-x"))
                .thenReturn(Optional.of(user("a@b.com", "+33611223344")));
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(true);
        when(whatsAppConfigRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));
        when(whatsAppApiService.sendTemplateMessage(eq(config), eq("+33611223344"),
                anyString(), eq("fr"))).thenReturn("wa-msg-1");

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("whatsapp"));

        assertEquals(List.of("whatsapp"), delivered);
        verify(whatsAppApiService).sendTemplateMessage(eq(config), eq("+33611223344"),
                anyString(), eq("fr"));
    }

    @Test
    void dispatch_whatsapp_skippedWhenNoPhone() {
        when(userRepository.findByKeycloakId("user-x"))
                .thenReturn(Optional.of(user("a@b.com", null)));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("whatsapp"));
        assertTrue(delivered.isEmpty());
        verifyNoInteractions(whatsAppApiService);
    }

    @Test
    void dispatch_whatsapp_skippedWhenConfigDisabled() {
        when(userRepository.findByKeycloakId("user-x"))
                .thenReturn(Optional.of(user("a@b.com", "+33611223344")));
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(false);
        when(whatsAppConfigRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L, List.of("whatsapp"));
        assertTrue(delivered.isEmpty());
        verifyNoInteractions(whatsAppApiService);
    }

    // ─── multi-canal + isolation ───────────────────────────────────────────

    @Test
    void dispatch_all3Channels_independentSuccess() {
        when(userRepository.findByKeycloakId("user-x"))
                .thenReturn(Optional.of(user("a@b.com", "+33611223344")));
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenReturn(MessageDeliveryResult.success("m"));
        WhatsAppConfig config = new WhatsAppConfig();
        config.setEnabled(true);
        when(whatsAppConfigRepository.findByOrganizationId(1L)).thenReturn(Optional.of(config));
        when(whatsAppApiService.sendTemplateMessage(any(), any(), any(), any())).thenReturn("ok");

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L,
                List.of("in_app", "email", "whatsapp"));

        assertEquals(3, delivered.size());
        assertTrue(delivered.contains("in_app"));
        assertTrue(delivered.contains("email"));
        assertTrue(delivered.contains("whatsapp"));
    }

    @Test
    void dispatch_emailFailure_doesNotBlockOtherChannels() {
        when(userRepository.findByKeycloakId("user-x"))
                .thenReturn(Optional.of(user("a@b.com", "+33611223344")));
        when(emailChannel.isAvailable()).thenReturn(true);
        when(emailChannel.send(any())).thenThrow(new RuntimeException("SMTP boom"));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L,
                List.of("in_app", "email"));

        assertTrue(delivered.contains("in_app"));
        assertFalse(delivered.contains("email"));
    }

    @Test
    void dispatch_unknownChannel_skippedSilently() {
        when(userRepository.findByKeycloakId("user-x")).thenReturn(Optional.of(user("a@b.com", null)));

        List<String> delivered = delivery.dispatch(sample(), "user-x", 1L,
                List.of("in_app", "carrier-pigeon"));

        // in_app delivere, canal inconnu skip
        assertEquals(List.of("in_app"), delivered);
    }
}
