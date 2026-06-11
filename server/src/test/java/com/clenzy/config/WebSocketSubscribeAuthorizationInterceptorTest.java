package com.clenzy.config;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("WebSocketSubscribeAuthorizationInterceptor")
@ExtendWith(MockitoExtension.class)
class WebSocketSubscribeAuthorizationInterceptorTest {

    private static final String KEYCLOAK_ID = "user-123";

    @Mock
    private MessageChannel channel;

    private WebSocketSubscribeAuthorizationInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new WebSocketSubscribeAuthorizationInterceptor();
    }

    // ── Topics org-scopes ────────────────────────────────────────────────────

    @Test
    @DisplayName("when subscribing to own org conversations topic - accepted")
    void whenSubscribeToOwnOrgConversationsTopic_thenAccepted() {
        Message<byte[]> message = subscribe("/topic/conversations/42",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
    }

    @Test
    @DisplayName("when subscribing to another org conversations topic - rejected")
    void whenSubscribeToOtherOrgConversationsTopic_thenRejected() {
        Message<byte[]> message = subscribe("/topic/conversations/43",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when subscribing to another org contact topic - rejected")
    void whenSubscribeToOtherOrgContactTopic_thenRejected() {
        Message<byte[]> message = subscribe("/topic/contact/99",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when subscribing to own org contact topic - accepted")
    void whenSubscribeToOwnOrgContactTopic_thenAccepted() {
        Message<byte[]> message = subscribe("/topic/contact/42",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("when platform staff subscribes to any org topic - accepted (bypass)")
    void whenPlatformStaffSubscribesToAnyOrgTopic_thenAccepted() {
        Message<byte[]> message = subscribe("/topic/conversations/77",
                new StompPrincipal(KEYCLOAK_ID), attrs(null, true));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("when session has no resolved org - org topic subscribe rejected")
    void whenSessionWithoutResolvedOrg_thenOrgTopicRejected() {
        Message<byte[]> message = subscribe("/topic/conversations/42",
                new StompPrincipal(KEYCLOAK_ID), new HashMap<>());

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Session non authentifiee ─────────────────────────────────────────────

    @Test
    @DisplayName("when subscribing without principal - rejected")
    void whenSubscribeWithoutPrincipal_thenRejected() {
        Message<byte[]> message = subscribe("/topic/conversations/42", null, attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Queues utilisateur ───────────────────────────────────────────────────

    @Test
    @DisplayName("when subscribing to own user queue - accepted")
    void whenSubscribeToOwnUserQueue_thenAccepted() {
        Message<byte[]> message = subscribe("/user/" + KEYCLOAK_ID + "/queue/contact-messages",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("when subscribing to another user's queue - rejected")
    void whenSubscribeToOtherUserQueue_thenRejected() {
        Message<byte[]> message = subscribe("/user/other-user/queue/contact-messages",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when subscribing to spring-style self user queue - accepted")
    void whenSubscribeToSelfUserQueue_thenAccepted() {
        Message<byte[]> message = subscribe("/user/queue/contact-messages",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("when subscribing directly to a broker queue - rejected (session hijack guard)")
    void whenSubscribeToRawBrokerQueue_thenRejected() {
        Message<byte[]> message = subscribe("/queue/contact-messages-userabc123",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Topics publics authentifies ──────────────────────────────────────────

    @Test
    @DisplayName("when subscribing to global presence topic - accepted")
    void whenSubscribeToPresenceTopic_thenAccepted() {
        Message<byte[]> message = subscribe("/topic/presence",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("when subscribing to booking-engine host topic - accepted")
    void whenSubscribeToBookingEngineHostTopic_thenAccepted() {
        Message<byte[]> message = subscribe("/topic/booking-engine/host/some-host-id",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatCode(() -> interceptor.preSend(message, channel)).doesNotThrowAnyException();
    }

    // ── Deny by default ──────────────────────────────────────────────────────

    @Test
    @DisplayName("when subscribing to unknown destination - rejected")
    void whenSubscribeToUnknownDestination_thenRejected() {
        Message<byte[]> message = subscribe("/topic/whatever",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when subscribing without destination - rejected")
    void whenSubscribeWithoutDestination_thenRejected() {
        Message<byte[]> message = subscribe(null,
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when org topic id is not a valid long - rejected")
    void whenOrgTopicIdOverflows_thenRejected() {
        Message<byte[]> message = subscribe("/topic/conversations/99999999999999999999999",
                new StompPrincipal(KEYCLOAK_ID), attrs(42L, false));

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    // ── Trames non-SUBSCRIBE ─────────────────────────────────────────────────

    @Test
    @DisplayName("when non-SUBSCRIBE frame - passes through untouched")
    void whenNonSubscribeFrame_thenPassesThrough() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SEND);
        accessor.setDestination("/app/anything");
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
    }

    @Test
    @DisplayName("when message has no STOMP accessor - passes through untouched")
    void whenMessageWithoutStompAccessor_thenPassesThrough() {
        Message<byte[]> message = MessageBuilder.withPayload(new byte[0]).build();

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Message<byte[]> subscribe(String destination, Principal user, Map<String, Object> sessionAttributes) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSubscriptionId("sub-1");
        if (destination != null) {
            accessor.setDestination(destination);
        }
        if (user != null) {
            accessor.setUser(user);
        }
        accessor.setSessionAttributes(sessionAttributes);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Map<String, Object> attrs(Long orgId, boolean platformStaff) {
        Map<String, Object> attrs = new HashMap<>();
        if (orgId != null) {
            attrs.put(WebSocketAuthInterceptor.SESSION_ATTR_ORG_ID, orgId);
        }
        attrs.put(WebSocketAuthInterceptor.SESSION_ATTR_PLATFORM_STAFF, platformStaff);
        return attrs;
    }
}
