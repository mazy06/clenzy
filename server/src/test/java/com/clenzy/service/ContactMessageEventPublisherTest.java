package com.clenzy.service;

import com.clenzy.dto.ContactMessageDto;
import com.clenzy.dto.ContactMessageEvent;
import com.clenzy.model.ContactMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ContactMessageEventPublisherTest {

    @Mock private SimpMessagingTemplate messagingTemplate;
    @Mock private ObjectProvider<SimpMessagingTemplate> messagingProvider;

    private ContactMessageEventPublisher publisher;

    @BeforeEach
    void setUp() {
        when(messagingProvider.getIfAvailable()).thenReturn(messagingTemplate);
        publisher = new ContactMessageEventPublisher(messagingProvider);
    }

    @Test
    void publishNewMessage_sendsToBothUsersAndTopic() {
        ContactMessage msg = createMsg("sender1", "recipient1");
        ContactMessageDto dto = mockDto();

        publisher.publishNewMessage(msg, dto);

        verify(messagingTemplate).convertAndSendToUser(eq("recipient1"), eq("/queue/contact-messages"), any(ContactMessageEvent.class));
        verify(messagingTemplate).convertAndSendToUser(eq("sender1"), eq("/queue/contact-messages"), any(ContactMessageEvent.class));
        verify(messagingTemplate).convertAndSend(eq("/topic/contact/100"), any(ContactMessageEvent.class));
    }

    @Test
    void publishNewMessage_externalRecipient_skipsRecipientQueue() {
        ContactMessage msg = createMsg("sender1", "external");
        ContactMessageDto dto = mockDto();

        publisher.publishNewMessage(msg, dto);

        verify(messagingTemplate, never()).convertAndSendToUser(eq("external"), any(), any(Object.class));
        verify(messagingTemplate).convertAndSendToUser(eq("sender1"), any(), any(Object.class));
        verify(messagingTemplate).convertAndSend(any(String.class), any(Object.class));
    }

    @Test
    void publishNewMessage_nullRecipient_skipsRecipientQueue() {
        ContactMessage msg = createMsg("sender1", null);
        ContactMessageDto dto = mockDto();

        publisher.publishNewMessage(msg, dto);

        verify(messagingTemplate, times(1)).convertAndSendToUser(any(String.class), any(), any(Object.class));
    }

    @Test
    void publishNewMessage_noMessagingTemplate_noOp() {
        when(messagingProvider.getIfAvailable()).thenReturn(null);
        ContactMessageEventPublisher p = new ContactMessageEventPublisher(messagingProvider);
        ContactMessage msg = createMsg("a", "b");

        p.publishNewMessage(msg, mockDto());
        // No exception expected, and messagingTemplate is not called (it's null)
    }

    @Test
    void publishNewMessage_throwsException_caughtSilently() {
        doThrow(new RuntimeException("boom"))
            .when(messagingTemplate).convertAndSendToUser(any(String.class), any(), any(Object.class));

        ContactMessage msg = createMsg("a", "b");
        publisher.publishNewMessage(msg, mockDto());
        // No throw expected
    }

    @Test
    void publishThreadRead_sendsToCounterpart() {
        publisher.publishThreadRead("reader1", "counter1", 100L, 5);

        verify(messagingTemplate).convertAndSendToUser(
            eq("counter1"),
            eq("/queue/contact-messages"),
            any(ContactMessageEvent.class));
    }

    @Test
    void publishThreadRead_noMessagingTemplate_noOp() {
        when(messagingProvider.getIfAvailable()).thenReturn(null);
        ContactMessageEventPublisher p = new ContactMessageEventPublisher(messagingProvider);

        p.publishThreadRead("a", "b", 1L, 1);
        // Doesn't throw
    }

    @Test
    void publishThreadRead_exceptionThrown_caughtSilently() {
        doThrow(new RuntimeException("boom"))
            .when(messagingTemplate).convertAndSendToUser(any(String.class), any(), any(Object.class));

        publisher.publishThreadRead("a", "b", 1L, 1);
        // No throw expected
    }

    private ContactMessage createMsg(String sender, String recipient) {
        ContactMessage msg = new ContactMessage();
        msg.setId(1L);
        msg.setOrganizationId(100L);
        msg.setSenderKeycloakId(sender);
        msg.setRecipientKeycloakId(recipient);
        return msg;
    }

    private ContactMessageDto mockDto() {
        return mock(ContactMessageDto.class);
    }
}
