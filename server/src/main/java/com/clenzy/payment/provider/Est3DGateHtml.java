package com.clenzy.payment.provider;

import com.clenzy.util.StringUtils;

import java.util.Map;

/**
 * Rendu HTML partage pour les passerelles marocaines {@code est3Dgate}
 * (protocole Maroc Telecommerce : CMI, Attijari Payment, etc.).
 *
 * <p>Ces passerelles exigent un <strong>formulaire HTML POST signe</strong>
 * (pas une URL GET). Le contrat {@link com.clenzy.payment.PaymentResult} ne
 * retournant qu'une {@code redirectUrl} unique, chaque provider renvoie une
 * URL vers son controller de redirection, lequel construit les parametres,
 * calcule le hash puis rend cette page — identique d'un provider a l'autre,
 * seul le libelle affiche change. D'ou cette factorisation : un seul rendu
 * (spinner + auto-submit + fallback bouton) mutualise entre tous les
 * adaptateurs est3Dgate, plutot qu'un copier-coller de ~80 lignes par provider.
 *
 * <p>Toutes les valeurs sont echappees HTML ({@link StringUtils#escapeHtml})
 * pour prevenir les injections.
 */
public final class Est3DGateHtml {

    private Est3DGateHtml() {
    }

    /**
     * Rend la page auto-submit vers la passerelle {@code est3Dgate}.
     *
     * @param providerLabel libelle affiche a l'utilisateur (ex. "CMI",
     *                       "Attijari Payment") — repris dans le titre
     * @param gatewayUrl     URL {@code action} du formulaire (passerelle)
     * @param params         parametres du formulaire (dont le {@code HASH})
     * @return HTML complet, self-contained (aucune dependance externe)
     */
    public static String autoSubmitForm(String providerLabel, String gatewayUrl, Map<String, String> params) {
        StringBuilder formFields = new StringBuilder();
        params.forEach((name, value) ->
            formFields.append("    <input type=\"hidden\" name=\"")
                .append(StringUtils.escapeHtml(name))
                .append("\" value=\"")
                .append(StringUtils.escapeHtml(value != null ? value : ""))
                .append("\">\n"));

        // Note : self-contained HTML, pas de dependance externe.
        return """
            <!DOCTYPE html>
            <html lang="fr">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Redirection vers %s</title>
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
                  display: flex; align-items: center; justify-content: center;
                  min-height: 100vh; margin: 0; background: #F8FAFB; color: #2D3748;
                }
                .container { text-align: center; padding: 2rem; }
                .spinner {
                  width: 40px; height: 40px; margin: 0 auto 1.5rem;
                  border: 3px solid #E2E8F0; border-top-color: #4A9B8E;
                  border-radius: 50%%; animation: spin 0.8s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }
                h1 { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.5rem; }
                p { font-size: 0.875rem; color: #718096; margin: 0 0 1.5rem; }
                button {
                  background: #4A9B8E; color: #fff; border: 0; border-radius: 8px;
                  padding: 0.625rem 1.25rem; font-size: 0.875rem; font-weight: 600;
                  cursor: pointer;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="spinner" aria-hidden="true"></div>
                <h1>Redirection vers %s…</h1>
                <p>Vous allez être redirigé(e) vers la page de paiement sécurisée.</p>
                <form id="est3dgate-form" method="POST" action="%s">
            %s
                  <button type="submit">Continuer si la redirection ne se fait pas automatiquement</button>
                </form>
              </div>
              <script>document.getElementById('est3dgate-form').submit();</script>
            </body>
            </html>
            """.formatted(
                StringUtils.escapeHtml(providerLabel),
                StringUtils.escapeHtml(providerLabel),
                StringUtils.escapeHtml(gatewayUrl),
                formFields.toString());
    }
}
