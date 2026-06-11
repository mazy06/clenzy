package com.clenzy.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Intercepteur STOMP qui autorise les trames SUBSCRIBE (deny by default).
 *
 * <p>Politique par destination :</p>
 * <ul>
 *   <li>{@code /topic/conversations/{orgId}} et {@code /topic/contact/{orgId}} :
 *       l'orgId doit correspondre a l'organisation de la session (resolue au CONNECT
 *       par {@link WebSocketAuthInterceptor}) ; le staff plateforme bypass.</li>
 *   <li>{@code /topic/presence} : tout utilisateur authentifie (topic global par design,
 *       cf. PresenceService).</li>
 *   <li>{@code /topic/booking-engine/host/{userId}} : tout utilisateur authentifie
 *       (donnees d'affichage publiques : prenom + avatar du host).</li>
 *   <li>{@code /user/queue/...} : forme standard Spring, resolue sur le Principal de la
 *       session — toujours autorisee.</li>
 *   <li>{@code /user/{userId}/queue/...} : le userId embarque doit etre celui du Principal.</li>
 *   <li>Toute autre destination (y compris {@code /queue/...} direct, qui permettrait de
 *       cibler la queue resolue d'une autre session) : REJET.</li>
 * </ul>
 */
@Component
public class WebSocketSubscribeAuthorizationInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(WebSocketSubscribeAuthorizationInterceptor.class);

    private static final Pattern ORG_SCOPED_TOPIC = Pattern.compile("^/topic/(?:conversations|contact)/(\\d+)$");
    private static final Pattern USER_QUEUE = Pattern.compile("^/user/([^/]+)/queue/.+$");
    private static final Pattern BOOKING_HOST_TOPIC = Pattern.compile("^/topic/booking-engine/host/[^/]+$");
    private static final String PRESENCE_TOPIC = "/topic/presence";
    private static final String SELF_USER_QUEUE_PREFIX = "/user/queue/";

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || !StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            return message;
        }

        authorize(accessor);
        return message;
    }

    private void authorize(StompHeaderAccessor accessor) {
        Principal user = accessor.getUser();
        if (user == null || user.getName() == null || user.getName().isBlank()) {
            log.warn("WebSocket SUBSCRIBE rejete : session sans Principal");
            throw new AccessDeniedException("Abonnement non autorise");
        }

        String destination = accessor.getDestination();
        if (destination == null || destination.isBlank()) {
            log.warn("WebSocket SUBSCRIBE rejete : destination absente");
            throw new AccessDeniedException("Abonnement non autorise");
        }

        if (PRESENCE_TOPIC.equals(destination)
                || BOOKING_HOST_TOPIC.matcher(destination).matches()
                || destination.startsWith(SELF_USER_QUEUE_PREFIX)) {
            return;
        }

        Matcher orgMatcher = ORG_SCOPED_TOPIC.matcher(destination);
        if (orgMatcher.matches()) {
            authorizeOrgTopic(accessor, destination, orgMatcher.group(1));
            return;
        }

        Matcher userQueueMatcher = USER_QUEUE.matcher(destination);
        if (userQueueMatcher.matches()) {
            authorizeUserQueue(user, destination, userQueueMatcher.group(1));
            return;
        }

        log.warn("WebSocket SUBSCRIBE rejete : destination inconnue {}", destination);
        throw new AccessDeniedException("Abonnement non autorise");
    }

    private void authorizeOrgTopic(StompHeaderAccessor accessor, String destination, String rawOrgId) {
        Map<String, Object> sessionAttributes = accessor.getSessionAttributes();
        if (isPlatformStaff(sessionAttributes)) {
            return;
        }

        Long requestedOrgId = parseOrgId(rawOrgId);
        Long sessionOrgId = sessionOrgId(sessionAttributes);
        if (requestedOrgId == null || sessionOrgId == null || !sessionOrgId.equals(requestedOrgId)) {
            log.warn("WebSocket SUBSCRIBE rejete : org {} non autorisee pour la session (org session={})",
                    rawOrgId, sessionOrgId);
            throw new AccessDeniedException("Abonnement non autorise");
        }
        log.debug("WebSocket SUBSCRIBE autorise sur {}", destination);
    }

    private void authorizeUserQueue(Principal user, String destination, String requestedUserId) {
        if (!user.getName().equals(requestedUserId)) {
            log.warn("WebSocket SUBSCRIBE rejete : queue d'un autre utilisateur");
            throw new AccessDeniedException("Abonnement non autorise");
        }
        log.debug("WebSocket SUBSCRIBE autorise sur {}", destination);
    }

    private boolean isPlatformStaff(Map<String, Object> sessionAttributes) {
        return sessionAttributes != null
                && Boolean.TRUE.equals(sessionAttributes.get(WebSocketAuthInterceptor.SESSION_ATTR_PLATFORM_STAFF));
    }

    private Long sessionOrgId(Map<String, Object> sessionAttributes) {
        if (sessionAttributes == null) {
            return null;
        }
        Object orgId = sessionAttributes.get(WebSocketAuthInterceptor.SESSION_ATTR_ORG_ID);
        return orgId instanceof Long value ? value : null;
    }

    private Long parseOrgId(String rawOrgId) {
        try {
            return Long.valueOf(rawOrgId);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
