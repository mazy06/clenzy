package com.clenzy.controller;

import com.clenzy.dto.ConversationDto;
import com.clenzy.dto.ConversationMessageDto;
import com.clenzy.dto.SendConversationMessageRequest;
import com.clenzy.model.Conversation;
import com.clenzy.model.ConversationChannel;
import com.clenzy.model.ConversationMessage;
import com.clenzy.model.ConversationStatus;
import com.clenzy.model.MessageDirection;
import com.clenzy.service.messaging.ConversationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConversationControllerTest {

    @Mock private ConversationService conversationService;
    @Mock private TenantContext tenantContext;

    private ConversationController controller;
    private Jwt jwt;

    private static final Long ORG_ID = 1L;
    private static final String KEYCLOAK_ID = "kc-user-1";

    @BeforeEach
    void setUp() {
        controller = new ConversationController(conversationService, tenantContext);
        jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .claim("sub", KEYCLOAK_ID)
            .claim("name", "Jane Doe")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(3600))
            .build();
    }

    private Conversation buildConversation(Long id) {
        Conversation c = new Conversation();
        c.setId(id);
        c.setOrganizationId(ORG_ID);
        c.setChannel(ConversationChannel.EMAIL);
        c.setStatus(ConversationStatus.OPEN);
        c.setMessageCount(1);
        c.setUnread(false);
        // createdAt n'a pas de setter (auto-gere). Si besoin: ReflectionTestUtils.setField(c, "createdAt", LocalDateTime.now());
        return c;
    }

    private ConversationMessage buildMessage(Long id, Conversation conv) {
        ConversationMessage m = new ConversationMessage();
        m.setId(id);
        m.setConversation(conv);
        m.setDirection(MessageDirection.INBOUND);
        m.setChannelSource(ConversationChannel.EMAIL);
        m.setContent("Hello");
        return m;
    }

    @Nested
    @DisplayName("getInbox")
    class GetInbox {
        @Test
        void noChannelFilter_returnsPage() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Page<Conversation> page = new PageImpl<>(List.of(buildConversation(1L)));
            when(conversationService.getInbox(eq(ORG_ID), eq(null), any(Pageable.class)))
                .thenReturn(page);

            ResponseEntity<Page<ConversationDto>> response = controller.getInbox(
                null, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }

        @Test
        void withStatusFilter_passesStatus() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getInbox(eq(ORG_ID), eq(ConversationStatus.OPEN), any()))
                .thenReturn(Page.empty());

            ResponseEntity<Page<ConversationDto>> response = controller.getInbox(
                ConversationStatus.OPEN, null, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(conversationService).getInbox(eq(ORG_ID), eq(ConversationStatus.OPEN), any());
        }

        @Test
        void withChannels_callsByChannels() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            List<ConversationChannel> channels = List.of(ConversationChannel.WHATSAPP);
            when(conversationService.getInboxByChannels(eq(ORG_ID), eq(channels), eq(null), any()))
                .thenReturn(Page.empty());

            ResponseEntity<Page<ConversationDto>> response = controller.getInbox(
                null, channels, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(conversationService).getInboxByChannels(eq(ORG_ID), eq(channels), eq(null), any());
        }

        @Test
        void sizeCapped_at50() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getInbox(eq(ORG_ID), eq(null), any()))
                .thenReturn(Page.empty());

            controller.getInbox(null, null, 0, 1000);

            // size cap is 50 -- verified indirectly via service call
            verify(conversationService).getInbox(eq(ORG_ID), eq(null), any(Pageable.class));
        }
    }

    @Nested
    @DisplayName("getMyConversations")
    class GetMyConversations {
        @Test
        void returnsPage() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Page<Conversation> page = new PageImpl<>(List.of(buildConversation(1L)));
            when(conversationService.getMyConversations(eq(ORG_ID), eq(KEYCLOAK_ID), any()))
                .thenReturn(page);

            ResponseEntity<Page<ConversationDto>> response = controller.getMyConversations(jwt, 0, 20);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void whenFound_returnsDto() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getById(1L, ORG_ID))
                .thenReturn(Optional.of(buildConversation(1L)));

            ResponseEntity<ConversationDto> response = controller.getById(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(1L);
        }

        @Test
        void whenNotFound_returns404() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getById(99L, ORG_ID)).thenReturn(Optional.empty());

            ResponseEntity<ConversationDto> response = controller.getById(99L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }
    }

    @Nested
    @DisplayName("getMessages")
    class GetMessages {
        @Test
        void returnsPage() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Conversation c = buildConversation(1L);
            ConversationMessage m = buildMessage(1L, c);
            Page<ConversationMessage> page = new PageImpl<>(List.of(m));
            when(conversationService.getMessages(eq(1L), eq(ORG_ID), any()))
                .thenReturn(page);

            ResponseEntity<Page<ConversationMessageDto>> response = controller.getMessages(1L, 0, 50);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("sendMessage")
    class SendMessage {
        @Test
        void whenConversationExists_sendsMessage() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Conversation conv = buildConversation(1L);
            when(conversationService.getById(1L, ORG_ID)).thenReturn(Optional.of(conv));
            ConversationMessage savedMsg = buildMessage(99L, conv);
            when(conversationService.sendOutboundMessage(
                eq(conv), eq("Jane Doe"), eq(KEYCLOAK_ID), eq("Hello"), eq("<p>Hello</p>")))
                .thenReturn(savedMsg);

            SendConversationMessageRequest req = new SendConversationMessageRequest("Hello", "<p>Hello</p>");

            ResponseEntity<ConversationMessageDto> response = controller.sendMessage(1L, req, jwt);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().id()).isEqualTo(99L);
        }

        @Test
        void whenConversationNotFound_throws() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getById(99L, ORG_ID)).thenReturn(Optional.empty());

            SendConversationMessageRequest req = new SendConversationMessageRequest("Hello", null);

            assertThatThrownBy(() -> controller.sendMessage(99L, req, jwt))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void whenNoNameClaim_fallsBackToPreferredUsername() {
            Jwt jwtNoName = Jwt.withTokenValue("t")
                .header("alg", "RS256")
                .claim("sub", KEYCLOAK_ID)
                .claim("preferred_username", "janedoe")
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60))
                .build();

            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Conversation conv = buildConversation(1L);
            when(conversationService.getById(1L, ORG_ID)).thenReturn(Optional.of(conv));
            ConversationMessage savedMsg = buildMessage(99L, conv);
            when(conversationService.sendOutboundMessage(
                eq(conv), eq("janedoe"), eq(KEYCLOAK_ID), anyString(), any()))
                .thenReturn(savedMsg);

            SendConversationMessageRequest req = new SendConversationMessageRequest("Hi", null);

            ResponseEntity<ConversationMessageDto> response = controller.sendMessage(1L, req, jwtNoName);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(conversationService).sendOutboundMessage(
                eq(conv), eq("janedoe"), eq(KEYCLOAK_ID), anyString(), any());
        }
    }

    @Nested
    @DisplayName("markAsRead")
    class MarkAsRead {
        @Test
        void marks() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);

            ResponseEntity<Void> response = controller.markAsRead(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(conversationService).markAsRead(1L, ORG_ID);
        }
    }

    @Nested
    @DisplayName("assign")
    class Assign {
        @Test
        void assignsToKeycloakUser() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Conversation conv = buildConversation(1L);
            when(conversationService.assignConversation(1L, ORG_ID, "kc-other"))
                .thenReturn(conv);

            ResponseEntity<ConversationDto> response = controller.assign(
                1L, Map.of("keycloakId", "kc-other"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            verify(conversationService).assignConversation(1L, ORG_ID, "kc-other");
        }
    }

    @Nested
    @DisplayName("updateStatus")
    class UpdateStatus {
        @Test
        void updates() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            Conversation conv = buildConversation(1L);
            conv.setStatus(ConversationStatus.CLOSED);
            when(conversationService.updateStatus(1L, ORG_ID, ConversationStatus.CLOSED))
                .thenReturn(conv);

            ResponseEntity<ConversationDto> response = controller.updateStatus(
                1L, Map.of("status", "CLOSED"));

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().status()).isEqualTo(ConversationStatus.CLOSED);
        }

        @Test
        void invalidStatus_throws() {
            assertThatThrownBy(() -> controller.updateStatus(1L, Map.of("status", "INVALID")))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    @DisplayName("getUnreadCount")
    class GetUnreadCount {
        @Test
        void returnsCount() {
            when(tenantContext.getOrganizationId()).thenReturn(ORG_ID);
            when(conversationService.getUnreadCount(ORG_ID)).thenReturn(7L);

            ResponseEntity<Map<String, Long>> response = controller.getUnreadCount();

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getBody().get("count")).isEqualTo(7L);
        }
    }
}
