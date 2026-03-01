package com.clenzy.config;

import java.security.Principal;

/**
 * Principal minimal pour les connexions STOMP WebSocket.
 * Le name correspond au keycloakId (subject du JWT).
 */
public record StompPrincipal(String name) implements Principal {
    @Override
    public String getName() {
        return name;
    }
}
