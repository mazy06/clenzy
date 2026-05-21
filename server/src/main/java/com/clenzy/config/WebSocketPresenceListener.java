package com.clenzy.config;

import com.clenzy.service.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * Bridges Spring's WebSocket session lifecycle into {@link PresenceService}.
 *
 * <p>Connect → presence ONLINE. Disconnect → presence OFFLINE (only when the user's last session
 * goes away). Same conditional gate as {@link WebSocketConfig} so presence stays opt-in via
 * {@code clenzy.websocket.enabled}.</p>
 */
@Component
@ConditionalOnProperty(name = "clenzy.websocket.enabled", havingValue = "true", matchIfMissing = true)
public class WebSocketPresenceListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketPresenceListener.class);

    private final PresenceService presenceService;

    public WebSocketPresenceListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void onSessionConnected(SessionConnectedEvent event) {
        Principal user = event.getUser();
        String sessionId = StompHeaderAccessor.wrap(event.getMessage()).getSessionId();
        if (user == null || sessionId == null) return;
        presenceService.markOnline(user.getName(), sessionId);
    }

    @EventListener
    public void onSessionDisconnect(SessionDisconnectEvent event) {
        Principal user = event.getUser();
        String sessionId = event.getSessionId();
        if (user == null || sessionId == null) {
            log.debug("Disconnect event without principal/session — skipping presence update");
            return;
        }
        presenceService.markOffline(user.getName(), sessionId);
    }
}
