package com.clenzy.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

/**
 * Configuration WebSocket avec STOMP + SockJS pour les conversations en temps reel.
 * Supporte deux endpoints :
 * - /ws avec SockJS (web browser)
 * - /ws raw WebSocket (mobile React Native)
 *
 * <p>Les origines autorisees pour la handshake reutilisent la meme source que le CORS HTTP
 * ({@code cors.allowed-origins}, fournie par ALLOWED_ORIGINS en prod/staging). En dev, la
 * propriete est absente et le defaut couvre les origines localhost du frontend (alignees sur
 * SecurityConfig). Les clients sans header Origin (mobile React Native) restent acceptes,
 * conformement au comportement standard de Spring.</p>
 */
@Configuration
@EnableWebSocketMessageBroker
@ConditionalOnProperty(name = "clenzy.websocket.enabled", havingValue = "true", matchIfMissing = true)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final String DEV_DEFAULT_ORIGINS =
            "http://localhost:3000,http://localhost:3001,http://localhost:8080,"
            + "http://localhost:5173,http://localhost:5174,http://localhost:4173";

    private final WebSocketAuthInterceptor webSocketAuthInterceptor;
    private final WebSocketSubscribeAuthorizationInterceptor subscribeAuthorizationInterceptor;
    private final String allowedOrigins;

    public WebSocketConfig(WebSocketAuthInterceptor webSocketAuthInterceptor,
                           WebSocketSubscribeAuthorizationInterceptor subscribeAuthorizationInterceptor,
                           @Value("${cors.allowed-origins:" + DEV_DEFAULT_ORIGINS + "}") String allowedOrigins) {
        this.webSocketAuthInterceptor = webSocketAuthInterceptor;
        this.subscribeAuthorizationInterceptor = subscribeAuthorizationInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOriginsArray();
        // Endpoint avec SockJS pour le web
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins)
                .withSockJS();
        // Endpoint raw WebSocket pour mobile (React Native n'a pas SockJS)
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(origins);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthInterceptor, subscribeAuthorizationInterceptor);
    }

    private String[] allowedOriginsArray() {
        return Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toArray(String[]::new);
    }
}
