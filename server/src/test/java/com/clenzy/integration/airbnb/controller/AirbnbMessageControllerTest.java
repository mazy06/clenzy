package com.clenzy.integration.airbnb.controller;

import com.clenzy.integration.airbnb.dto.AirbnbMessageDto;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.MessageDirection;
import com.clenzy.repository.ConversationMessageRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AirbnbMessageControllerTest {

    @Mock private ConversationMessageRepository messageRepository;
    @Mock private TenantContext tenantContext;

    private AirbnbMessageController controller;

    @BeforeEach
    void setUp() {
        // Service reel sur repository mocke (refactor T-ARCH-01)
        controller = new AirbnbMessageController(
                new com.clenzy.integration.airbnb.service.AirbnbMessageQueryService(messageRepository),
                tenantContext);
        lenient().when(tenantContext.getOrganizationId()).thenReturn(42L);
    }

    private ConversationMessage msg(Long id, String externalId, MessageDirection direction,
                                     String senderId, String content, boolean read,
                                     String conversationExternalId) {
        ConversationMessage m = new ConversationMessage();
        m.setId(id);
        m.setExternalMessageId(externalId);
        m.setDirection(direction);
        m.setSenderName("Alice");
        m.setSenderIdentifier(senderId);
        m.setContent(content);
        m.setSentAt(LocalDateTime.of(2026, 4, 1, 10, 0));
        if (read) m.setReadAt(LocalDateTime.of(2026, 4, 1, 11, 0));
        if (conversationExternalId != null) {
            Conversation c = new Conversation();
            c.setExternalConversationId(conversationExternalId);
            m.setConversation(c);
        }
        return m;
    }

    @Test
    void getMessages_returnsAll_whenNoFilter() {
        ConversationMessage inboundMsg = msg(1L, "ext-1", MessageDirection.INBOUND,
                "airbnb:reservation_111", "Hello", false, "thread-1");
        ConversationMessage outboundMsg = msg(2L, "ext-2", MessageDirection.OUTBOUND,
                "airbnb:reservation_222", "Hi back", true, "thread-2");
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(inboundMsg, outboundMsg));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);

        assertThat(resp.getStatusCode().is2xxSuccessful()).isTrue();
        assertThat(resp.getBody()).hasSize(2);
        AirbnbMessageDto dto1 = resp.getBody().get(0);
        assertThat(dto1.getId()).isEqualTo("ext-1");
        assertThat(dto1.getSenderRole()).isEqualTo("guest");
        assertThat(dto1.isRead()).isFalse();
        assertThat(dto1.getReservationId()).isEqualTo("reservation_111");
        assertThat(dto1.getThreadId()).isEqualTo("thread-1");
        AirbnbMessageDto dto2 = resp.getBody().get(1);
        assertThat(dto2.getSenderRole()).isEqualTo("host");
        assertThat(dto2.isRead()).isTrue();
    }

    @Test
    void getMessages_filtersByReservationId() {
        ConversationMessage m1 = msg(1L, "ext-1", MessageDirection.INBOUND,
                "airbnb:reservation_111", "hi", false, "t1");
        ConversationMessage m2 = msg(2L, "ext-2", MessageDirection.OUTBOUND,
                "airbnb:reservation_222", "bye", false, "t2");
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(m1, m2));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages("reservation_111");

        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).getReservationId()).isEqualTo("reservation_111");
    }

    @Test
    void getMessages_externalIdNull_fallsBackToInternalId() {
        ConversationMessage m = msg(123L, null, MessageDirection.INBOUND,
                "airbnb:reservation_x", "msg", false, null);
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(m));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);

        assertThat(resp.getBody().get(0).getId()).isEqualTo("123");
    }

    @Test
    void getMessages_senderIdentifierNotAirbnb_doesNotSetReservation() {
        ConversationMessage m = msg(1L, "ext", MessageDirection.INBOUND,
                "email:foo@bar.com", "x", false, null);
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(m));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);
        assertThat(resp.getBody().get(0).getReservationId()).isNull();
    }

    @Test
    void getMessages_nullSenderIdentifier_handledGracefully() {
        ConversationMessage m = new ConversationMessage();
        m.setId(1L);
        m.setExternalMessageId("ext-x");
        m.setDirection(MessageDirection.INBOUND);
        m.setSenderName("S");
        m.setContent("c");
        m.setSentAt(LocalDateTime.now());
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(m));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);
        assertThat(resp.getBody()).hasSize(1);
        assertThat(resp.getBody().get(0).getReservationId()).isNull();
    }

    @Test
    void getMessages_nullConversation_threadIdNull() {
        ConversationMessage m = msg(1L, "ext", MessageDirection.INBOUND,
                "airbnb:reservation_z", "hello", false, null);
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of(m));

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);
        assertThat(resp.getBody().get(0).getThreadId()).isNull();
    }

    @Test
    void getMessages_emptyResult() {
        when(messageRepository.findByOrgAndChannelWithConversation(42L, ConversationChannel.AIRBNB))
                .thenReturn(List.of());

        ResponseEntity<List<AirbnbMessageDto>> resp = controller.getMessages(null);
        assertThat(resp.getBody()).isEmpty();
    }
}
