package com.clenzy.integration.oauth;

/** Messages HTTP Baitly : ne jamais réafficher une erreur historique ou fournisseur. */
public final class BaitlyOAuthHttpDiagnostics {
    public static final String CONFIGURATION_UNAVAILABLE = "Connexion OAuth indisponible ; vérifiez la configuration";
    public static final String DISCONNECT_UNCONFIRMED = "Déconnexion non confirmée ; vérifiez la connexion avant de réessayer";
    public static final String LOCAL_DISCONNECT = "Déconnexion locale enregistrée ; révocation distante à vérifier";
    public static final String CONNECTION_ERROR = "Connexion indisponible ; vérifiez les paramètres ou reconnectez le fournisseur";

    private BaitlyOAuthHttpDiagnostics() {}

    public static String connectionError(String storedError) {
        return storedError == null || storedError.isBlank() ? null : CONNECTION_ERROR;
    }
}
