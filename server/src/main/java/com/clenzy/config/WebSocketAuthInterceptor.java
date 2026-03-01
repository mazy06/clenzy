package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Intercepteur STOMP qui extrait le JWT de la trame CONNECT
 * et definit le Principal (necessaire pour convertAndSendToUser).
 *
 * Le client envoie le token dans le header natif "Authorization: Bearer xxx".
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);

    private final JwtDecoder jwtDecoder;

    public WebSocketAuthInterceptor(JwtDecoder jwtDecoder) {
        this.jwtDecoder = jwtDecoder;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader != null && authHeader.startsWith("Bearer ")) {
                try {
                    String token = authHeader.substring(7);
                    Jwt jwt = jwtDecoder.decode(token);
                    String userId = jwt.getSubject();
                    accessor.setUser(new StompPrincipal(userId));
                    log.debug("WebSocket STOMP CONNECT authentifie pour userId={}", userId);
                } catch (Exception e) {
                    log.warn("Echec authentification WebSocket STOMP: {}", e.getMessage());
                }
            } else {
                log.debug("WebSocket STOMP CONNECT sans header Authorization");
            }
        }

        return message;
    }
}
