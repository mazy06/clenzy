package com.clenzy.service.messaging.whatsapp;

import com.clenzy.model.WhatsAppConfig;
import com.clenzy.model.WhatsAppProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Resout la bonne implementation {@link WhatsAppProvider} a partir d'une
 * {@link WhatsAppConfig} d'organisation.
 *
 * <h3>Comment ca marche</h3>
 * Spring injecte la liste de tous les beans {@link WhatsAppProvider} disponibles
 * (typiquement {@link MetaWhatsAppProvider} et {@link OpenWaWhatsAppProvider}).
 * On indexe par {@link WhatsAppProviderType} dans un {@link EnumMap} au boot,
 * puis le lookup en {@code resolve()} est O(1).
 *
 * <h3>Defaut securitaire</h3>
 * Si la config a un {@code provider} null (ne devrait pas arriver vu que la
 * colonne est NOT NULL DEFAULT 'META', mais ceinture+bretelles), on retombe
 * sur META. Si META n'est pas dans la map (erreur de wiring), on throw
 * explicitement au boot ne pas en silence en runtime.
 *
 * <h3>Pourquoi pas un {@code @Qualifier}</h3>
 * Le choix du provider est runtime (par-org) et pas compile-time. Un
 * {@code @Qualifier} forcerait un seul provider au niveau application, ce
 * qui casserait la promesse multi-tenant de Clenzy.
 */
@Component
public class WhatsAppProviderResolver {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppProviderResolver.class);

    private final Map<WhatsAppProviderType, WhatsAppProvider> providers;

    public WhatsAppProviderResolver(List<WhatsAppProvider> providerList) {
        Map<WhatsAppProviderType, WhatsAppProvider> map = new EnumMap<>(WhatsAppProviderType.class);
        for (WhatsAppProvider p : providerList) {
            WhatsAppProvider existing = map.put(p.getProviderType(), p);
            if (existing != null) {
                // Defense en profondeur : si deux beans declarent le meme type,
                // on echoue au boot plutot que de prendre silencieusement le
                // dernier (Spring respecte l'ordre d'injection, fragile).
                throw new IllegalStateException(String.format(
                    "Deux WhatsAppProvider declarent le meme type %s: %s et %s",
                    p.getProviderType(), existing.getClass().getName(), p.getClass().getName()));
            }
        }
        this.providers = Map.copyOf(map);
        log.info("WhatsAppProviderResolver initialise avec {} providers: {}",
            providers.size(), providers.keySet());
    }

    /**
     * Retourne le provider associe au type configure pour l'org. Retombe
     * sur META si la config est null ou son provider null (defense en
     * profondeur — la colonne DB est NOT NULL DEFAULT 'META' depuis 0153).
     *
     * @throws IllegalStateException si le provider requis n'est pas wired
     *         (ex: OPENWA configure mais le bean n'a pas demarre — erreur
     *         de deploiement qu'il faut detecter immediatement).
     */
    public WhatsAppProvider resolve(WhatsAppConfig config) {
        WhatsAppProviderType type = (config != null && config.getProvider() != null)
            ? config.getProvider()
            : WhatsAppProviderType.META;

        WhatsAppProvider provider = providers.get(type);
        if (provider == null) {
            throw new IllegalStateException("Aucune implementation WhatsAppProvider pour " + type +
                ". Verifier que le bean correspondant est bien actif (pas de profile=, pas de @ConditionalOnProperty manquant).");
        }
        return provider;
    }
}
