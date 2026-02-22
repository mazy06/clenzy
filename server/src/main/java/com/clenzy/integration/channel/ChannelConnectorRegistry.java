package com.clenzy.integration.channel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Registre central des connecteurs channel.
 *
 * Spring injecte automatiquement toutes les implementations de
 * {@link ChannelConnector} disponibles dans le contexte.
 *
 * Usage :
 *   ChannelConnector airbnb = registry.getRequiredConnector(ChannelName.AIRBNB);
 *   Set<ChannelName> available = registry.getAvailableChannels();
 */
@Component
public class ChannelConnectorRegistry {

    private static final Logger log = LoggerFactory.getLogger(ChannelConnectorRegistry.class);

    private final Map<ChannelName, ChannelConnector> connectors;

    public ChannelConnectorRegistry(List<ChannelConnector> connectorList) {
        this.connectors = connectorList.stream()
                .collect(Collectors.toMap(
                        ChannelConnector::getChannelName,
                        c -> c,
                        (a, b) -> {
                            log.warn("Duplicate ChannelConnector for {}, using {}",
                                    a.getChannelName(), b.getClass().getSimpleName());
                            return b;
                        }
                ));

        log.info("ChannelConnectorRegistry initialise avec {} connecteur(s): {}",
                connectors.size(), connectors.keySet());
    }

    /**
     * Retourne le connecteur pour un channel, ou empty.
     */
    public Optional<ChannelConnector> getConnector(ChannelName name) {
        return Optional.ofNullable(connectors.get(name));
    }

    /**
     * Retourne le connecteur pour un channel, ou leve une exception.
     */
    public ChannelConnector getRequiredConnector(ChannelName name) {
        ChannelConnector connector = connectors.get(name);
        if (connector == null) {
            throw new IllegalArgumentException("Aucun connecteur enregistre pour le channel: " + name);
        }
        return connector;
    }

    /**
     * Retourne tous les connecteurs enregistres.
     */
    public Collection<ChannelConnector> getAllConnectors() {
        return Collections.unmodifiableCollection(connectors.values());
    }

    /**
     * Retourne les noms des channels disponibles.
     */
    public Set<ChannelName> getAvailableChannels() {
        return Collections.unmodifiableSet(connectors.keySet());
    }

    /**
     * Retourne tous les connecteurs qui supportent une capacite donnee.
     */
    public List<ChannelConnector> getConnectorsWithCapability(ChannelCapability capability) {
        return connectors.values().stream()
                .filter(c -> c.supports(capability))
                .collect(Collectors.toList());
    }
}
