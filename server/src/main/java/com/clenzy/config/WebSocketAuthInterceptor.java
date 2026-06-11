package com.clenzy.config;

import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Intercepteur STOMP qui authentifie la trame CONNECT.
 *
 * <p>Le client envoie le token dans le header natif "Authorization: Bearer xxx".
 * Un CONNECT sans header Authorization valide ou avec un JWT invalide est REJETE
 * (la session STOMP n'est jamais etablie sans Principal).</p>
 *
 * <p>En plus du Principal (necessaire pour convertAndSendToUser), l'intercepteur
 * resout le contexte tenant de l'utilisateur (organizationId + platform staff)
 * et le stocke dans les attributs de session WebSocket. Ces attributs sont
 * consommes par {@link WebSocketSubscribeAuthorizationInterceptor} pour autoriser
 * les SUBSCRIBE org-scopes.</p>
 */
@Component
public class WebSocketAuthInterceptor implements ChannelInterceptor {

    /** Attribut de session WS : organizationId (Long) de l'utilisateur authentifie. */
    public static final String SESSION_ATTR_ORG_ID = "clenzy.ws.orgId";
    /** Attribut de session WS : true si l'utilisateur est staff plateforme (SUPER_ADMIN / SUPER_MANAGER). */
    public static final String SESSION_ATTR_PLATFORM_STAFF = "clenzy.ws.platformStaff";

    private static final Logger log = LoggerFactory.getLogger(WebSocketAuthInterceptor.class);

    private final JwtDecoder jwtDecoder;
    private final UserRepository userRepository;

    public WebSocketAuthInterceptor(JwtDecoder jwtDecoder, UserRepository userRepository) {
        this.jwtDecoder = jwtDecoder;
        this.userRepository = userRepository;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !isConnectFrame(accessor.getCommand())) {
            return message;
        }

        authenticate(accessor);
        return message;
    }

    /** La trame STOMP (1.2) est traitee comme CONNECT par Spring : meme exigence d'authentification. */
    private boolean isConnectFrame(StompCommand command) {
        return StompCommand.CONNECT.equals(command) || StompCommand.STOMP.equals(command);
    }

    private void authenticate(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("WebSocket STOMP CONNECT rejete : header Authorization absent ou malforme");
            throw new AccessDeniedException("Connexion WebSocket non authentifiee");
        }

        Jwt jwt = decodeOrReject(authHeader.substring(7));
        String userId = jwt.getSubject();
        if (userId == null || userId.isBlank()) {
            log.warn("WebSocket STOMP CONNECT rejete : JWT sans subject");
            throw new AccessDeniedException("Connexion WebSocket non authentifiee");
        }

        accessor.setUser(new StompPrincipal(userId));
        storeTenantAttributes(accessor, userId);
        log.debug("WebSocket STOMP CONNECT authentifie pour userId={}", userId);
    }

    private Jwt decodeOrReject(String token) {
        try {
            return jwtDecoder.decode(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("Echec authentification WebSocket STOMP: {}", e.getMessage());
            throw new AccessDeniedException("Connexion WebSocket non authentifiee");
        }
    }

    /**
     * Resout l'organisation et le statut staff plateforme de l'utilisateur, et les stocke
     * dans les attributs de session WebSocket (map partagee entre toutes les trames de la session).
     * Si l'utilisateur n'est pas encore provisionne en base, aucun attribut org n'est pose :
     * les SUBSCRIBE org-scopes seront refuses (deny by default).
     */
    private void storeTenantAttributes(StompHeaderAccessor accessor, String keycloakId) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (sessionAttributes == null) {
            return;
        }

        userRepository.findByKeycloakId(keycloakId).ifPresent(user -> {
            // Les attributs de session WS sont une ConcurrentHashMap : jamais de valeur null.
            if (user.getOrganizationId() != null) {
                sessionAttributes.put(SESSION_ATTR_ORG_ID, user.getOrganizationId());
            }
            boolean platformStaff = user.getRole() != null && user.getRole().isPlatformStaff();
            sessionAttributes.put(SESSION_ATTR_PLATFORM_STAFF, platformStaff);
        });
    }
}
