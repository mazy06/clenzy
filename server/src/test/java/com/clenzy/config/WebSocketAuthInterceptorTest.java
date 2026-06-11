package com.clenzy.config;

import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.UserRepository;
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
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@DisplayName("WebSocketAuthInterceptor")
@ExtendWith(MockitoExtension.class)
class WebSocketAuthInterceptorTest {

    private static final String KEYCLOAK_ID = "user-123";

    @Mock
    private JwtDecoder jwtDecoder;

    @Mock
    private UserRepository userRepository;

    @Mock
    private MessageChannel channel;

    private WebSocketAuthInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new WebSocketAuthInterceptor(jwtDecoder, userRepository);
    }

    @Test
    @DisplayName("when CONNECT without Authorization header - connection is rejected")
    void whenConnectWithoutAuthorizationHeader_thenConnectionRejected() {
        ConnectFrame frame = connectFrame(null);

        assertThatThrownBy(() -> interceptor.preSend(frame.message(), channel))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(jwtDecoder, userRepository);
    }

    @Test
    @DisplayName("when CONNECT with malformed Authorization header - connection is rejected")
    void whenConnectWithMalformedAuthorizationHeader_thenConnectionRejected() {
        ConnectFrame frame = connectFrame("Basic dXNlcjpwYXNz");

        assertThatThrownBy(() -> interceptor.preSend(frame.message(), channel))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(jwtDecoder, userRepository);
    }

    @Test
    @DisplayName("when CONNECT with invalid JWT - connection is rejected, no anonymous session")
    void whenConnectWithInvalidJwt_thenConnectionRejected() {
        ConnectFrame frame = connectFrame("Bearer expired-token");
        when(jwtDecoder.decode("expired-token")).thenThrow(new JwtException("Jwt expired"));

        assertThatThrownBy(() -> interceptor.preSend(frame.message(), channel))
                .isInstanceOf(AccessDeniedException.class);
        assertThat(frame.accessor().getUser()).isNull();
        verifyNoInteractions(userRepository);
    }

    @Test
    @DisplayName("when CONNECT with valid JWT - principal is set and tenant attributes stored")
    void whenConnectWithValidJwt_thenPrincipalSetAndTenantAttributesStored() {
        ConnectFrame frame = connectFrame("Bearer valid-token");
        when(jwtDecoder.decode("valid-token")).thenReturn(jwt(KEYCLOAK_ID));
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(user(42L, UserRole.HOST)));

        Message<?> result = interceptor.preSend(frame.message(), channel);

        assertThat(result).isSameAs(frame.message());
        assertThat(frame.accessor().getUser()).isEqualTo(new StompPrincipal(KEYCLOAK_ID));
        assertThat(frame.sessionAttributes())
                .containsEntry(WebSocketAuthInterceptor.SESSION_ATTR_ORG_ID, 42L)
                .containsEntry(WebSocketAuthInterceptor.SESSION_ATTR_PLATFORM_STAFF, false);
    }

    @Test
    @DisplayName("when CONNECT with valid JWT of platform staff - platformStaff attribute is true")
    void whenConnectWithPlatformStaffJwt_thenPlatformStaffAttributeStored() {
        ConnectFrame frame = connectFrame("Bearer valid-token");
        when(jwtDecoder.decode("valid-token")).thenReturn(jwt(KEYCLOAK_ID));
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(user(null, UserRole.SUPER_ADMIN)));

        interceptor.preSend(frame.message(), channel);

        assertThat(frame.sessionAttributes())
                .containsEntry(WebSocketAuthInterceptor.SESSION_ATTR_PLATFORM_STAFF, true)
                .doesNotContainKey(WebSocketAuthInterceptor.SESSION_ATTR_ORG_ID);
    }

    @Test
    @DisplayName("when CONNECT with valid JWT but user not provisioned - principal set, no org attribute")
    void whenConnectWithUnknownUser_thenPrincipalSetWithoutOrgAttribute() {
        ConnectFrame frame = connectFrame("Bearer valid-token");
        when(jwtDecoder.decode("valid-token")).thenReturn(jwt(KEYCLOAK_ID));
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

        interceptor.preSend(frame.message(), channel);

        assertThat(frame.accessor().getUser()).isEqualTo(new StompPrincipal(KEYCLOAK_ID));
        assertThat(frame.sessionAttributes())
                .doesNotContainKey(WebSocketAuthInterceptor.SESSION_ATTR_ORG_ID)
                .doesNotContainKey(WebSocketAuthInterceptor.SESSION_ATTR_PLATFORM_STAFF);
    }

    @Test
    @DisplayName("when STOMP 1.2 connect frame without Authorization - connection is rejected")
    void whenStompFrameWithoutAuthorizationHeader_thenConnectionRejected() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.STOMP);
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        assertThatThrownBy(() -> interceptor.preSend(message, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("when non-CONNECT frame without Authorization - passes through untouched")
    void whenNonConnectFrame_thenPassesThrough() {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination("/topic/presence");
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
        verifyNoInteractions(jwtDecoder, userRepository);
    }

    @Test
    @DisplayName("when message has no STOMP accessor - passes through untouched")
    void whenMessageWithoutStompAccessor_thenPassesThrough() {
        Message<byte[]> message = MessageBuilder.withPayload(new byte[0]).build();

        Message<?> result = interceptor.preSend(message, channel);

        assertThat(result).isSameAs(message);
        verifyNoInteractions(jwtDecoder, userRepository);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private record ConnectFrame(Message<byte[]> message, StompHeaderAccessor accessor,
                                Map<String, Object> sessionAttributes) {
    }

    private ConnectFrame connectFrame(String authorizationHeader) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        Map<String, Object> sessionAttributes = new HashMap<>();
        accessor.setSessionAttributes(sessionAttributes);
        if (authorizationHeader != null) {
            accessor.setNativeHeader("Authorization", authorizationHeader);
        }
        accessor.setLeaveMutable(true);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new ConnectFrame(message, accessor, sessionAttributes);
    }

    private Jwt jwt(String subject) {
        return Jwt.withTokenValue("valid-token")
                .header("alg", "RS256")
                .subject(subject)
                .build();
    }

    private User user(Long organizationId, UserRole role) {
        User user = new User();
        user.setKeycloakId(KEYCLOAK_ID);
        user.setOrganizationId(organizationId);
        user.setRole(role);
        return user;
    }
}
