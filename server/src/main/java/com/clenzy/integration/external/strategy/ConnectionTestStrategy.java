package com.clenzy.integration.external.strategy;

import com.clenzy.service.signature.SignatureProviderType;

/**
 * Strategie de test de connexion vers un provider externe.
 *
 * <h2>Pourquoi ce pattern</h2>
 * Chaque provider (Yousign, Universign, DocaPoste, Odoo) a un endpoint de test
 * different (URL, format de requete, format de reponse). Au lieu de mettre des
 * if/else dans le controller (anti-pattern OCP), chaque provider implemente
 * sa propre {@link ConnectionTestStrategy}. Le {@link ConnectionTestStrategyRegistry}
 * dispatch automatiquement par {@link SignatureProviderType}.
 *
 * <h2>Ajouter un nouveau provider</h2>
 * Creer une nouvelle implementation @Service de cette interface. Spring
 * l'injecte automatiquement dans le registry. Pas besoin de modifier le
 * controller ou le registry. Open/Closed Principle.
 *
 * <h2>Comportement par defaut (scaffolding)</h2>
 * Pour les providers ou l'organisation Clenzy n'a pas encore de compte
 * (Yousign, Universign, DocaPoste), la strategie retourne {@code true}
 * sans appeler l'API distante. Cela permet de sauvegarder les credentials
 * meme sans connexion testable. Quand on aura un compte chez le provider,
 * on remplacera l'implementation par un vrai test HTTP.
 */
public interface ConnectionTestStrategy {

    /**
     * @return le type de provider gere par cette strategie
     */
    SignatureProviderType providerType();

    /**
     * Teste les credentials fournis contre l'API du provider.
     *
     * @param serverUrl URL serveur (ex: https://api.yousign.app)
     * @param accountIdentifier optionnel : nom de tenant, db name, account id
     * @param apiKey API key en CLAIR (deja dechiffree par le caller)
     * @return true si les credentials sont valides, false sinon
     */
    boolean testConnection(String serverUrl, String accountIdentifier, String apiKey);
}
