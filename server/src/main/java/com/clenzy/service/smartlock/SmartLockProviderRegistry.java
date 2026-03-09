package com.clenzy.service.smartlock;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Registre central des providers de serrures connectees.
 *
 * Spring injecte automatiquement toutes les implementations de
 * {@link SmartLockProvider} disponibles dans le contexte.
 *
 * Usage :
 *   SmartLockProvider nuki = registry.getRequiredProvider(SmartLockBrand.NUKI);
 *   Set<SmartLockBrand> brands = registry.getAvailableBrands();
 */
@Component
public class SmartLockProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(SmartLockProviderRegistry.class);

    private final Map<SmartLockBrand, SmartLockProvider> providers;

    public SmartLockProviderRegistry(List<SmartLockProvider> providerList) {
        this.providers = providerList.stream()
                .collect(Collectors.toMap(
                        SmartLockProvider::getBrand,
                        p -> p,
                        (a, b) -> {
                            log.warn("Duplicate SmartLockProvider pour {}, utilisation de {}",
                                    a.getBrand(), b.getClass().getSimpleName());
                            return b;
                        }
                ));

        log.info("SmartLockProviderRegistry initialise avec {} provider(s): {}",
                providers.size(), providers.keySet());
    }

    /**
     * Retourne le provider pour une marque, ou empty.
     */
    public Optional<SmartLockProvider> getProvider(SmartLockBrand brand) {
        return Optional.ofNullable(providers.get(brand));
    }

    /**
     * Retourne le provider pour une marque, ou leve une exception.
     */
    public SmartLockProvider getRequiredProvider(SmartLockBrand brand) {
        SmartLockProvider provider = providers.get(brand);
        if (provider == null) {
            throw new IllegalArgumentException("Aucun provider enregistre pour la marque: " + brand);
        }
        return provider;
    }

    /**
     * Retourne tous les providers enregistres.
     */
    public Collection<SmartLockProvider> getAllProviders() {
        return Collections.unmodifiableCollection(providers.values());
    }

    /**
     * Retourne les marques disponibles.
     */
    public Set<SmartLockBrand> getAvailableBrands() {
        return Collections.unmodifiableSet(providers.keySet());
    }
}
