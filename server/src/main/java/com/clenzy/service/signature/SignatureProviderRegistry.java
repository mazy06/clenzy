package com.clenzy.service.signature;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Registre des fournisseurs de signature electronique.
 * Permet de selectionner le fournisseur actif et d'acceder a tous les fournisseurs disponibles.
 */
@Component
public class SignatureProviderRegistry {

    private static final Logger log = LoggerFactory.getLogger(SignatureProviderRegistry.class);

    private final Map<SignatureProviderType, SignatureProvider> providers;
    private final SignatureProviderType activeProviderType;

    public SignatureProviderRegistry(
            List<SignatureProvider> providerList,
            @Value("${clenzy.signature.active-provider:pennylane}") String activeProvider) {

        this.providers = providerList.stream()
            .collect(Collectors.toMap(SignatureProvider::getType, Function.identity()));

        this.activeProviderType = parseProviderType(activeProvider);

        log.info("SignatureProviderRegistry — {} fournisseur(s) enregistre(s), actif: {}",
            providers.size(), activeProviderType);
    }

    /**
     * Recupere un fournisseur par son type.
     *
     * @param type type du fournisseur
     * @return fournisseur correspondant
     */
    public Optional<SignatureProvider> getProvider(SignatureProviderType type) {
        return Optional.ofNullable(providers.get(type));
    }

    /**
     * Recupere le fournisseur actif configure via clenzy.signature.active-provider.
     *
     * @return fournisseur actif
     * @throws IllegalStateException si le fournisseur actif n'est pas disponible
     */
    public SignatureProvider getActiveProvider() {
        SignatureProvider provider = providers.get(activeProviderType);
        if (provider == null) {
            throw new IllegalStateException(
                "Fournisseur de signature actif non disponible: " + activeProviderType
                    + ". Fournisseurs enregistres: " + providers.keySet());
        }
        if (!provider.isAvailable()) {
            throw new IllegalStateException(
                "Fournisseur de signature " + activeProviderType + " est enregistre mais non disponible");
        }
        return provider;
    }

    /**
     * @return tous les fournisseurs enregistres
     */
    public Map<SignatureProviderType, SignatureProvider> getAllProviders() {
        return Map.copyOf(providers);
    }

    private SignatureProviderType parseProviderType(String value) {
        try {
            return SignatureProviderType.valueOf(value.toUpperCase().replace("-", "_"));
        } catch (IllegalArgumentException e) {
            log.warn("Type de fournisseur inconnu '{}', fallback sur PENNYLANE", value);
            return SignatureProviderType.PENNYLANE;
        }
    }
}
