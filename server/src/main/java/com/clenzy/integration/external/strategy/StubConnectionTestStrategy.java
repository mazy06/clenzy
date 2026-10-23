package com.clenzy.integration.external.strategy;

import com.clenzy.service.signature.SignatureProviderType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Strategie stub utilisee tant que l'organisation Baitly n'a pas de compte
 * chez le provider. Aucun contrôle de champs ne confirme une connexion distante.
 *
 * <h2>Pourquoi pas une seule @Service stub instance</h2>
 * Pour respecter le principe de stricte unicite des strategies par provider
 * (le registry mappe 1 type → 1 strategie), chaque provider stub a sa propre
 * sous-classe declaree @Service. Quand on cablera la vraie API, on remplacera
 * juste la sous-classe par une vraie implementation, sans toucher au registry.
 *
 * Open/Closed Principle : ajouter / remplacer un provider sans modifier les
 * autres ni le code central.
 */
abstract class StubConnectionTestStrategy implements ConnectionTestStrategy {

    private static final Logger log = LoggerFactory.getLogger(StubConnectionTestStrategy.class);

    @Override
    public boolean testConnection(String serverUrl, String accountIdentifier, String apiKey) {
        log.warn("Vérification fournisseur indisponible pour {}", providerType());
        return false;
    }
}

@Service
class YousignConnectionTestStrategy extends StubConnectionTestStrategy {
    @Override public SignatureProviderType providerType() { return SignatureProviderType.YOUSIGN; }
}

@Service
class UniversignConnectionTestStrategy extends StubConnectionTestStrategy {
    @Override public SignatureProviderType providerType() { return SignatureProviderType.UNIVERSIGN; }
}

@Service
class DocaPosteConnectionTestStrategy extends StubConnectionTestStrategy {
    @Override public SignatureProviderType providerType() { return SignatureProviderType.DOCAPOSTE; }
}
