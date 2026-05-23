package com.clenzy.integration.external.strategy;

import com.clenzy.service.signature.SignatureProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Registry qui dispatch les {@link ConnectionTestStrategy} par
 * {@link SignatureProviderType}.
 *
 * Spring injecte toutes les implementations declarees @Service au demarrage.
 * Le controller utilise ensuite {@link #findFor(SignatureProviderType)} pour
 * recuperer la strategie correspondante.
 *
 * Pas d'init manuel necessaire — c'est full DI. Pour ajouter un provider :
 * juste creer une nouvelle @Service implementant ConnectionTestStrategy, et
 * elle sera automatiquement dans le registry.
 */
@Service
public class ConnectionTestStrategyRegistry {

    private static final Logger log = LoggerFactory.getLogger(ConnectionTestStrategyRegistry.class);

    private final Map<SignatureProviderType, ConnectionTestStrategy> byType;

    public ConnectionTestStrategyRegistry(List<ConnectionTestStrategy> strategies) {
        this.byType = new EnumMap<>(SignatureProviderType.class);
        for (ConnectionTestStrategy s : strategies) {
            this.byType.put(s.providerType(), s);
        }
        log.info("ConnectionTestStrategyRegistry initialized with {} strategies: {}",
                strategies.size(), byType.keySet());
    }

    public Optional<ConnectionTestStrategy> findFor(SignatureProviderType type) {
        return Optional.ofNullable(byType.get(type));
    }
}
