package com.clenzy.service.messaging;

import com.clenzy.model.*;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.repository.ConversationRepository;
import com.clenzy.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConversationServiceTest {

    @Mock private ConversationRepository conversationRepository;
    @Mock private ConversationMessageRepository messageRepository;
    @Mock private ConversationEventPublisher eventPublisher;
    @Mock private NotificationService notificationService;
    @Mock private WhatsAppChannel whatsAppChannel;
    @Mock private com.clenzy.repository.ReservationRepository reservationRepository;
    @Mock private com.clenzy.repository.GuestRepository guestRepository;
    @Mock private com.clenzy.repository.UserRepository userRepository;
    @Mock private com.clenzy.service.AssistantOutcomeTracker outcomeTracker;
    @Mock private org.springframework.context.ApplicationEventPublisher applicationEventPublisher;

    private ConversationService service;

    @BeforeEach
    void setUp() {
        service = new ConversationService(conversationRepository, messageRepository,
            eventPublisher, notificationService, whatsAppChannel, reservationRepository, guestRepository,
            userRepository, outcomeTracker, applicationEventPublisher);
    }

    @Test
    void getOrCreate_existingConversation_returnsExisting() {
        Conversation existing = new Conversation();
        existing.setId(1L);
        when(conversationRepository.findByOrganizationIdAndChannelAndExternalConversationId(
            1L, ConversationChannel.AIRBNB, "ext-123"))
            .thenReturn(Optional.of(existing));

        Conversation result = service.getOrCreate(1L, ConversationChannel.AIRBNB, "ext-123",
            null, null, null, "Test");

        assertThat(result.getId()).isEqualTo(1L);
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void getOrCreate_newConversation_createsNew() {
        when(conversationRepository.findByOrganizationIdAndChannelAndExternalConversationId(
            1L, ConversationChannel.WHATSAPP, "ext-456"))
            .thenReturn(Optional.empty());

        Conversation saved = new Conversation();
        saved.setId(2L);
        when(conversationRepository.save(any())).thenReturn(saved);

        Conversation result = service.getOrCreate(1L, ConversationChannel.WHATSAPP, "ext-456",
            null, null, null, "New conv");

        assertThat(result.getId()).isEqualTo(2L);
        verify(conversationRepository).save(any());
    }

    @Test
    void addInboundMessage_createsMessageAndUpdatesConversation() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.EMAIL);
        conv.setMessageCount(3);
        conv.setStatus(ConversationStatus.OPEN);

        ConversationMessage saved = new ConversationMessage();
        saved.setId(10L);
        saved.setConversation(conv);
        saved.setDirection(MessageDirection.INBOUND);
        saved.setChannelSource(ConversationChannel.EMAIL);
        when(messageRepository.save(any())).thenReturn(saved);
        when(conversationRepository.save(any())).thenReturn(conv);

        ConversationMessage result = service.addInboundMessage(conv, "Jean", "jean@test.com",
            "Bonjour", null, "ext-msg-1");

        assertThat(result.getId()).isEqualTo(10L);
        assertThat(conv.getMessageCount()).isEqualTo(4);
        assertThat(conv.isUnread()).isTrue();
        verify(eventPublisher).publishNewMessage(eq(conv), any());
    }

    @Test
    void addInboundMessage_closedConversation_reopens() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.AIRBNB);
        conv.setStatus(ConversationStatus.CLOSED);
        conv.setMessageCount(5);

        ConversationMessage saved = new ConversationMessage();
        saved.setId(11L);
        saved.setConversation(conv);
        saved.setDirection(MessageDirection.INBOUND);
        saved.setChannelSource(ConversationChannel.AIRBNB);
        when(messageRepository.save(any())).thenReturn(saved);
        when(conversationRepository.save(any())).thenReturn(conv);

        service.addInboundMessage(conv, "Guest", "guest@airbnb", "Help", null, null);

        assertThat(conv.getStatus()).isEqualTo(ConversationStatus.OPEN);
    }

    @Test
    void sendOutboundMessage_createsOutboundMessage() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.INTERNAL);
        conv.setMessageCount(0);
        conv.setStatus(ConversationStatus.OPEN);

        ConversationMessage saved = new ConversationMessage();
        saved.setId(20L);
        saved.setConversation(conv);
        saved.setDirection(MessageDirection.OUTBOUND);
        saved.setChannelSource(ConversationChannel.INTERNAL);
        when(messageRepository.save(any())).thenReturn(saved);
        when(conversationRepository.save(any())).thenReturn(conv);

        ConversationMessage result = service.sendOutboundMessage(conv, "Admin", "admin-kc-id",
            "Response", null);

        assertThat(result.getDirection()).isEqualTo(MessageDirection.OUTBOUND);
        assertThat(conv.getMessageCount()).isEqualTo(1);
    }

    @Test
    void markAsRead_existingConversation_setsUnreadFalse() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setUnread(true);
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(conv));
        when(conversationRepository.save(any())).thenReturn(conv);

        service.markAsRead(1L, 1L);

        assertThat(conv.isUnread()).isFalse();
    }

    @Test
    void markAsRead_nonExisting_throws() {
        when(conversationRepository.findByIdAndOrganizationId(99L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markAsRead(99L, 1L))
            .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignConversation_setsKeycloakIdAndNotifies() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(conv));
        when(conversationRepository.save(any())).thenReturn(conv);
        com.clenzy.model.User assignee = new com.clenzy.model.User();
        assignee.setOrganizationId(1L);
        when(userRepository.findByKeycloakId("user-kc-id")).thenReturn(Optional.of(assignee));

        Conversation result = service.assignConversation(1L, 1L, "user-kc-id");

        assertThat(result.getAssignedToKeycloakId()).isEqualTo("user-kc-id");
        verify(notificationService).send(eq("user-kc-id"), eq(NotificationKey.CONVERSATION_ASSIGNED),
            anyString(), anyString(), any());
    }

    @Test
    void assignConversation_rejectsAssigneeFromAnotherOrg() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(conv));
        com.clenzy.model.User otherOrgUser = new com.clenzy.model.User();
        otherOrgUser.setOrganizationId(2L); // autre org
        when(userRepository.findByKeycloakId("user-kc-id")).thenReturn(Optional.of(otherOrgUser));

        assertThatThrownBy(() -> service.assignConversation(1L, 1L, "user-kc-id"))
            .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void updateStatus_changesStatus() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setStatus(ConversationStatus.OPEN);
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.of(conv));
        when(conversationRepository.save(any())).thenReturn(conv);

        Conversation result = service.updateStatus(1L, 1L, ConversationStatus.ARCHIVED);

        assertThat(result.getStatus()).isEqualTo(ConversationStatus.ARCHIVED);
    }

    @Test
    void getUnreadCount_returnsCount() {
        when(conversationRepository.countUnreadByOrganizationId(1L)).thenReturn(5L);

        long count = service.getUnreadCount(1L);

        assertThat(count).isEqualTo(5);
    }

    @Test
    void getInbox_withStatus_filtersCorrectly() {
        Page<Conversation> page = new PageImpl<>(List.of(new Conversation()));
        when(conversationRepository.findByOrganizationIdAndStatusOrderByLastMessageAtDesc(
            eq(1L), eq(ConversationStatus.OPEN), any()))
            .thenReturn(page);

        Page<Conversation> result = service.getInbox(1L, ConversationStatus.OPEN, PageRequest.of(0, 20));
        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void getInbox_noStatus_excludesArchived() {
        Page<Conversation> page = new PageImpl<>(List.of(new Conversation(), new Conversation()));
        when(conversationRepository.findByOrganizationIdAndStatusNotOrderByLastMessageAtDesc(
                eq(1L), eq(ConversationStatus.ARCHIVED), any()))
            .thenReturn(page);

        Page<Conversation> result = service.getInbox(1L, null, PageRequest.of(0, 20));
        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    // ─── Additional coverage ────────────────────────────────────────────

    @Test
    void getOrCreateForReservation_existing_returnsExisting() {
        Conversation existing = new Conversation();
        existing.setId(50L);
        when(conversationRepository.findByOrganizationIdAndReservationIdAndChannel(
                1L, 99L, ConversationChannel.EMAIL))
                .thenReturn(Optional.of(existing));

        Conversation result = service.getOrCreateForReservation(
                1L, 99L, ConversationChannel.EMAIL, null, null, null);

        assertThat(result.getId()).isEqualTo(50L);
        verify(conversationRepository, never()).save(any());
    }

    @Test
    void getOrCreateForReservation_new_createsWithPropertyAsSubject() {
        when(conversationRepository.findByOrganizationIdAndReservationIdAndChannel(
                1L, 99L, ConversationChannel.AIRBNB))
                .thenReturn(Optional.empty());
        Property property = new Property();
        property.setName("My Studio");

        Conversation created = new Conversation();
        created.setId(60L);
        when(conversationRepository.save(any())).thenReturn(created);

        service.getOrCreateForReservation(1L, 99L, ConversationChannel.AIRBNB,
                null, property, null);

        org.mockito.ArgumentCaptor<Conversation> captor = org.mockito.ArgumentCaptor.forClass(Conversation.class);
        verify(conversationRepository).save(captor.capture());
        assertThat(captor.getValue().getSubject()).isEqualTo("My Studio");
        assertThat(captor.getValue().getStatus()).isEqualTo(ConversationStatus.OPEN);
        assertThat(captor.getValue().isUnread()).isTrue();
    }

    @Test
    void getOrCreateForReservation_newWithNoProperty_subjectIsConversation() {
        when(conversationRepository.findByOrganizationIdAndReservationIdAndChannel(
                1L, 99L, ConversationChannel.WHATSAPP))
                .thenReturn(Optional.empty());
        when(conversationRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Conversation result = service.getOrCreateForReservation(1L, 99L, ConversationChannel.WHATSAPP,
                null, null, null);

        assertThat(result.getSubject()).isEqualTo("Conversation");
    }

    @Test
    void addInboundMessage_assignedConversation_notifiesAssignee() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.AIRBNB);
        conv.setMessageCount(0);
        conv.setStatus(ConversationStatus.OPEN);
        conv.setAssignedToKeycloakId("assignee-kc-id");

        ConversationMessage saved = new ConversationMessage();
        saved.setId(99L);
        when(messageRepository.save(any())).thenReturn(saved);
        when(conversationRepository.save(any())).thenReturn(conv);

        service.addInboundMessage(conv, "Guest", "guest@a.com", "Hi", null, null);

        verify(notificationService).send(eq("assignee-kc-id"),
                eq(NotificationKey.CONVERSATION_NEW_MESSAGE),
                anyString(), anyString(), eq("/contact?highlight=1"));
    }

    @Test
    void addInboundMessage_longContent_truncatesPreview() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.EMAIL);
        conv.setMessageCount(0);
        conv.setStatus(ConversationStatus.OPEN);

        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(conversationRepository.save(any())).thenReturn(conv);

        String longContent = "x".repeat(300);
        service.addInboundMessage(conv, "G", "g@a.com", longContent, null, null);

        // truncate to 200 + "..."
        assertThat(conv.getLastMessagePreview()).hasSize(203);
    }

    @Test
    void getInboxByChannels_withStatus_filtersBoth() {
        List<ConversationChannel> channels = List.of(ConversationChannel.AIRBNB, ConversationChannel.BOOKING);
        Page<Conversation> page = new PageImpl<>(List.of(new Conversation()));
        when(conversationRepository.findByOrganizationIdAndChannelInAndStatusOrderByLastMessageAtDesc(
                eq(1L), eq(channels), eq(ConversationStatus.OPEN), any()))
                .thenReturn(page);

        Page<Conversation> result = service.getInboxByChannels(1L, channels,
                ConversationStatus.OPEN, PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void getInboxByChannels_noStatus_excludesArchived() {
        List<ConversationChannel> channels = List.of(ConversationChannel.AIRBNB);
        Page<Conversation> page = new PageImpl<>(List.of(new Conversation(), new Conversation()));
        when(conversationRepository.findByOrganizationIdAndChannelInAndStatusNotOrderByLastMessageAtDesc(
                eq(1L), eq(channels), eq(ConversationStatus.ARCHIVED), any())).thenReturn(page);

        Page<Conversation> result = service.getInboxByChannels(1L, channels,
                null, PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(2);
    }

    @Test
    void getMyConversations_delegatesWithKeycloakId() {
        Page<Conversation> page = new PageImpl<>(List.of(new Conversation()));
        when(conversationRepository.findByOrganizationIdAndAssignedToKeycloakIdOrderByLastMessageAtDesc(
                eq(1L), eq("kc-1"), any())).thenReturn(page);

        Page<Conversation> result = service.getMyConversations(1L, "kc-1", PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void getById_delegatesToRepository() {
        Conversation c = new Conversation();
        c.setId(1L);
        when(conversationRepository.findByIdAndOrganizationId(1L, 5L)).thenReturn(Optional.of(c));

        Optional<Conversation> result = service.getById(1L, 5L);

        assertThat(result).isPresent();
    }

    @Test
    void getMessages_delegatesToRepository() {
        Page<ConversationMessage> page = new PageImpl<>(List.of(new ConversationMessage()));
        when(messageRepository.findByConversationIdAndOrganizationIdOrderBySentAtAsc(
                eq(1L), eq(5L), any())).thenReturn(page);

        Page<ConversationMessage> result = service.getMessages(1L, 5L, PageRequest.of(0, 20));

        assertThat(result.getTotalElements()).isEqualTo(1);
    }

    @Test
    void updateStatus_notFound_throws() {
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(1L, 1L, ConversationStatus.ARCHIVED))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void assignConversation_notFound_throws() {
        when(conversationRepository.findByIdAndOrganizationId(1L, 1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.assignConversation(1L, 1L, "kc-1"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sendOutboundMessage_closedConv_reopens() {
        Conversation conv = new Conversation();
        conv.setId(1L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.AIRBNB);
        conv.setStatus(ConversationStatus.CLOSED);
        conv.setMessageCount(2);

        ConversationMessage saved = new ConversationMessage();
        saved.setId(33L);
        when(messageRepository.save(any())).thenReturn(saved);
        when(conversationRepository.save(any())).thenReturn(conv);

        service.sendOutboundMessage(conv, "Admin", "admin-1", "Reply", "<p>reply</p>");

        assertThat(conv.getStatus()).isEqualTo(ConversationStatus.OPEN);
    }

    @Test
    void sendOutboundMessage_whatsappWithin24h_sendsSignedMessage() {
        Guest guest = new Guest("Alice", "Martin", 1L);
        guest.setPhone("+33612345678");
        guest.setLanguage("fr");
        Property property = new Property();
        property.setName("Villa Azur");
        Conversation conv = new Conversation();
        conv.setId(50L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.WHATSAPP);
        conv.setStatus(ConversationStatus.OPEN);
        conv.setMessageCount(0);
        conv.setGuest(guest);
        conv.setProperty(property);

        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(conversationRepository.findById(50L)).thenReturn(Optional.of(conv));
        ConversationMessage inbound = new ConversationMessage();
        inbound.setSentAt(LocalDateTime.now());
        when(messageRepository.findTopByConversationIdAndDirectionOrderBySentAtDesc(50L, MessageDirection.INBOUND))
            .thenReturn(Optional.of(inbound));
        when(whatsAppChannel.send(any())).thenReturn(MessageDeliveryResult.success("wamid-out"));

        ConversationMessage result = service.sendOutboundMessage(
            conv, "Jean", "kc-host", "Bonjour", "<p>Bonjour</p>");

        ArgumentCaptor<MessageDeliveryRequest> captor = ArgumentCaptor.forClass(MessageDeliveryRequest.class);
        verify(whatsAppChannel).send(captor.capture());
        assertThat(captor.getValue().recipientPhone()).isEqualTo("+33612345678");
        assertThat(captor.getValue().plainBody()).isEqualTo("Jean (Villa Azur) : Bonjour");
        assertThat(result.getDeliveryStatus()).isEqualTo("SENT");
        assertThat(result.getExternalMessageId()).isEqualTo("wamid-out");
    }

    @Test
    void sendOutboundMessage_whatsappOutside24h_doesNotSend() {
        Guest guest = new Guest("Alice", "Martin", 1L);
        guest.setPhone("+33612345678");
        Conversation conv = new Conversation();
        conv.setId(51L);
        conv.setOrganizationId(1L);
        conv.setChannel(ConversationChannel.WHATSAPP);
        conv.setStatus(ConversationStatus.OPEN);
        conv.setMessageCount(0);
        conv.setGuest(guest);

        when(messageRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(conversationRepository.findById(51L)).thenReturn(Optional.of(conv));
        when(messageRepository.findTopByConversationIdAndDirectionOrderBySentAtDesc(51L, MessageDirection.INBOUND))
            .thenReturn(Optional.empty()); // aucun inbound -> hors fenetre 24h

        ConversationMessage result = service.sendOutboundMessage(
            conv, "Jean", "kc-host", "Bonjour", "<p>Bonjour</p>");

        verify(whatsAppChannel, never()).send(any());
        assertThat(result.getDeliveryStatus()).isEqualTo("WINDOW_EXPIRED");
    }
}
