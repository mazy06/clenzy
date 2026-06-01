package com.clenzy.service.messaging.whatsapp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Verifie la signature {@code X-Hub-Signature-256} des webhooks Meta WhatsApp Cloud API.
 *
 * <p>Meta signe le corps <b>brut</b> de chaque POST avec l'App Secret (HMAC-SHA256)
 * et l'envoie dans l'en-tete au format {@code sha256=<hexdigest>}. On recalcule le
 * HMAC sur les memes octets bruts et on compare en temps constant.</p>
 *
 * <p>Modele App globale (Tech Provider / Embedded Signup) : un App Secret unique
 * ({@code clenzy.whatsapp.meta.app-secret}, deja utilise par {@link MetaSignupService})
 * signe les webhooks de toutes les organisations.</p>
 *
 * <p>Si l'App Secret n'est pas configure (dev), la verification est desactivee
 * (log WARN) pour ne pas bloquer les tests locaux. En prod le secret est toujours
 * renseigne -> verification stricte, et tout payload non signe ou mal signe est rejete
 * avant la moindre mutation d'etat.</p>
 */
@Component
public class WhatsAppSignatureVerifier {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppSignatureVerifier.class);
    private static final String SIGNATURE_PREFIX = "sha256=";
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final String appSecret;

    public WhatsAppSignatureVerifier(@Value("${clenzy.whatsapp.meta.app-secret:}") String appSecret) {
        this.appSecret = appSecret;
    }

    /**
     * @param rawBody         octets bruts du corps de la requete (tels que recus de Meta)
     * @param signatureHeader valeur de l'en-tete {@code X-Hub-Signature-256}
     * @return true si la signature est valide, ou si aucun secret n'est configure (dev)
     */
    public boolean isValid(byte[] rawBody, String signatureHeader) {
        if (appSecret == null || appSecret.isBlank()) {
            log.warn("App Secret Meta non configure — signature webhook WhatsApp non verifiee (dev uniquement)");
            return true;
        }
        if (rawBody == null || signatureHeader == null || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
            log.warn("Signature webhook WhatsApp absente ou malformee");
            return false;
        }

        String provided = signatureHeader.substring(SIGNATURE_PREFIX.length());
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            String expected = HexFormat.of().formatHex(mac.doFinal(rawBody));
            // Comparaison constant-time pour eviter une timing attack sur la signature.
            return MessageDigest.isEqual(
                    expected.getBytes(StandardCharsets.UTF_8),
                    provided.toLowerCase().getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Erreur verification signature webhook WhatsApp: {}", e.getMessage());
            return false;
        }
    }
}
