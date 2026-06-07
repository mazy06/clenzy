package com.clenzy.service.messaging.whatsapp;

import com.clenzy.repository.WhatsAppConfigRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Verifie la signature {@code X-OpenWA-Signature} des webhooks ENTRANTS OpenWA.
 *
 * <p>OpenWA signe le corps <b>brut</b> de chaque POST avec le {@code secret}
 * configure pour le webhook (HMAC-SHA256), au format {@code sha256=<hexdigest>}
 * (identique a Meta). Le secret est genere par Clenzy a la creation de session
 * et stocke chiffre en BDD
 * ({@link com.clenzy.model.WhatsAppConfig#getOpenwaWebhookSecret()}) — jamais en
 * .env. On recalcule le HMAC sur les memes octets bruts et on compare en temps
 * constant.</p>
 *
 * <p>Contrairement au verifier Meta (qui desactive la verif si aucun secret en
 * dev), ici on <b>refuse</b> tout POST quand aucun secret n'est configure :
 * l'endpoint est public et le secret est genere des la 1ere creation de session,
 * donc la verif est active de bout en bout, dev compris.</p>
 */
@Component
public class OpenWaSignatureVerifier {

    private static final Logger log = LoggerFactory.getLogger(OpenWaSignatureVerifier.class);
    private static final String SIGNATURE_PREFIX = "sha256=";
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final WhatsAppConfigRepository configRepository;

    public OpenWaSignatureVerifier(WhatsAppConfigRepository configRepository) {
        this.configRepository = configRepository;
    }

    /**
     * @param rawBody         octets bruts du corps de la requete (tels que recus d'OpenWA)
     * @param signatureHeader valeur de l'en-tete {@code X-OpenWA-Signature}
     * @return true si la signature est valide ; false si absente, malformee ou
     *         si aucun secret n'est configure
     */
    public boolean isValid(byte[] rawBody, String signatureHeader) {
        String secret = configRepository.findFirstByOrganizationIdIsNull()
            .map(com.clenzy.model.WhatsAppConfig::getOpenwaWebhookSecret)
            .orElse(null);
        if (secret == null || secret.isBlank()) {
            log.warn("Secret webhook OpenWA absent — POST entrant rejete (creer la session d'abord)");
            return false;
        }
        if (rawBody == null || signatureHeader == null || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
            log.warn("Signature webhook OpenWA absente ou malformee");
            return false;
        }

        String provided = signatureHeader.substring(SIGNATURE_PREFIX.length());
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            String expected = HexFormat.of().formatHex(mac.doFinal(rawBody));
            return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            log.error("Erreur verification signature OpenWA: {}", e.getMessage());
            return false;
        }
    }
}
