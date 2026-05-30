package com.clenzy.dto;

import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class ConversationMessageDtoTest {

    @Test
    void canonicalConstructor_exposesAllAccessors() {
        LocalDateTime sentAt = LocalDateTime.of(2026, 5, 1, 9, 0);
        LocalDateTime readAt = LocalDateTime.of(2026, 5, 1, 9, 5);

        ConversationMessageDto dto = new ConversationMessageDto(
            1L, 42L, MessageDirection.OUTBOUND, ConversationChannel.WHATSAPP,
            "Operator", "+33612345678",
            "Hello!", "<p>Hello!</p>",
            "ext-msg-id", "DELIVERED",
            sentAt, readAt
        );

        assertEquals(1L, dto.id());
        assertEquals(42L, dto.conversationId());
        assertEquals(MessageDirection.OUTBOUND, dto.direction());
        assertEquals(ConversationChannel.WHATSAPP, dto.channelSource());
        assertEquals("Operator", dto.senderName());
        assertEquals("+33612345678", dto.senderIdentifier());
        assertEquals("Hello!", dto.content());
        assertEquals("<p>Hello!</p>", dto.contentHtml());
        assertEquals("ext-msg-id", dto.externalMessageId());
        assertEquals("DELIVERED", dto.deliveryStatus());
        assertEquals(sentAt, dto.sentAt());
        assertEquals(readAt, dto.readAt());
    }

    @Test
    void from_mapsAllFieldsFromEntity() {
        Conversation conversation = new Conversation();
        conversation.setId(77L);

        LocalDateTime sentAt = LocalDateTime.of(2026, 6, 1, 10, 0);
        LocalDateTime readAt = LocalDateTime.of(2026, 6, 1, 10, 30);

        ConversationMessage message = new ConversationMessage();
        message.setId(10L);
        message.setConversation(conversation);
        message.setDirection(MessageDirection.INBOUND);
        message.setChannelSource(ConversationChannel.AIRBNB);
        message.setSenderName("Guest John");
        message.setSenderIdentifier("john@guest.com");
        message.setContent("When can I check in?");
        message.setContentHtml("<p>When can I check in?</p>");
        message.setExternalMessageId("airbnb-msg-999");
        message.setDeliveryStatus("READ");
        message.setSentAt(sentAt);
        message.setReadAt(readAt);

        ConversationMessageDto dto = ConversationMessageDto.from(message);

        assertEquals(10L, dto.id());
        assertEquals(77L, dto.conversationId());
        assertEquals(MessageDirection.INBOUND, dto.direction());
        assertEquals(ConversationChannel.AIRBNB, dto.channelSource());
        assertEquals("Guest John", dto.senderName());
        assertEquals("john@guest.com", dto.senderIdentifier());
        assertEquals("When can I check in?", dto.content());
        assertEquals("<p>When can I check in?</p>", dto.contentHtml());
        assertEquals("airbnb-msg-999", dto.externalMessageId());
        assertEquals("READ", dto.deliveryStatus());
        assertEquals(sentAt, dto.sentAt());
        assertEquals(readAt, dto.readAt());
    }

    @Test
    void from_defaultEntity_returnsExpectedDefaults() {
        Conversation conversation = new Conversation();
        conversation.setId(1L);

        ConversationMessage message = new ConversationMessage();
        message.setConversation(conversation);
        message.setChannelSource(ConversationChannel.INTERNAL);

        ConversationMessageDto dto = ConversationMessageDto.from(message);

        assertEquals(MessageDirection.INBOUND, dto.direction()); // entity default
        assertEquals("SENT", dto.deliveryStatus());              // entity default
        assertNotNull(dto.sentAt());                              // entity default = now()
        assertNull(dto.readAt());
        // metadata / attachments do not appear in the DTO (privacy / shape)
    }

    @Test
    void record_equalityByValue() {
        LocalDateTime sentAt = LocalDateTime.of(2026, 1, 1, 0, 0);
        ConversationMessageDto a = new ConversationMessageDto(
            1L, 1L, MessageDirection.INBOUND, ConversationChannel.EMAIL,
            "n", "id", "c", "h", "ext", "SENT", sentAt, null);
        ConversationMessageDto b = new ConversationMessageDto(
            1L, 1L, MessageDirection.INBOUND, ConversationChannel.EMAIL,
            "n", "id", "c", "h", "ext", "SENT", sentAt, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
