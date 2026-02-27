package com.clenzy.dto;

import com.clenzy.model.*;
import java.time.LocalDateTime;

public record ConversationMessageDto(
    Long id,
    Long conversationId,
    MessageDirection direction,
    ConversationChannel channelSource,
    String senderName,
    String senderIdentifier,
    String content,
    String contentHtml,
    String externalMessageId,
    String deliveryStatus,
    LocalDateTime sentAt,
    LocalDateTime readAt
) {
    public static ConversationMessageDto from(ConversationMessage m) {
        return new ConversationMessageDto(
            m.getId(),
            m.getConversation().getId(),
            m.getDirection(),
            m.getChannelSource(),
            m.getSenderName(),
            m.getSenderIdentifier(),
            m.getContent(),
            m.getContentHtml(),
            m.getExternalMessageId(),
            m.getDeliveryStatus(),
            m.getSentAt(),
            m.getReadAt()
        );
    }
}
