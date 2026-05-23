package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Validation des webhooks Channex via header statique partage.
 *
 * <p>Channex ne signe pas dynamiquement le body avec une HMAC : ils permettent
 * de configurer des headers custom dans le dashboard (Settings → Webhooks →
 * Headers). On y met un token aleatoire fort (32+ bytes) qui sert d'API key
 * d'authentification — Channex le renvoie tel quel dans chaque requete webhook,
 * Clenzy le compare au {@code CHANNEX_WEBHOOK_SECRET} configure cote env.</p>
 *
 * <p><b>Securite :</b> moins fort qu'une HMAC dynamique (un attaquant qui sniff
 * un seul webhook legitime peut le rejouer indefiniment), mais c'est le design
 * Channex. Mitigations possibles : HTTPS only (deja en place via nginx), IP
 * whitelist (a evaluer), rotation periodique du token (recommande tous les
 * 6 mois via le dashboard Channex).</p>
 *
 * <p>La comparaison se fait en constant-time via {@link MessageDigest#isEqual}
 * pour eviter les timing attacks sur le secret.</p>
 *
 * <p>Header attendu dans la requete entrante : {@code X-Channex-Token}.</p>
 */
@Component
public class ChannexSignatureValidator {

    private static final Logger log = LoggerFactory.getLogger(ChannexSignatureValidator.class);

    private final ChannexProperties props;

    public ChannexSignatureValidator(ChannexProperties props) {
        this.props = props;
    }

    /**
     * Valide qu'un webhook entrant provient bien de Channex en comparant le
     * header {@code X-Channex-Token} a la valeur configuree cote backend.
     *
     * @param receivedToken Valeur du header X-Channex-Token (peut etre null)
     * @return true si valide, false sinon
     */
    public boolean isValid(String receivedToken) {
        if (receivedToken == null || receivedToken.isBlank()) {
            log.warn("Channex webhook: header X-Channex-Token manquant ou vide");
            return false;
        }
        String expected = props.getWebhookSecret();
        if (expected == null || expected.isBlank()) {
            log.error("Channex webhook secret not configured (clenzy.channex.webhook-secret) — refusing all webhooks");
            return false;
        }
        // Constant-time compare to avoid timing attacks
        return MessageDigest.isEqual(
            expected.getBytes(StandardCharsets.UTF_8),
            receivedToken.trim().getBytes(StandardCharsets.UTF_8)
        );
    }
}
