package com.clenzy.service.maps;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.Base64;

/**
 * Signature HMAC-SHA256 des jetons d'images de carte. L'URL d'une image est
 * publique (les clients mail la chargent sans session) : la signature garantit
 * qu'elle a été émise par le serveur, donc que le moteur de rendu ne dessine que
 * des cartes de logements réels.
 *
 * <p>Sans secret configuré ({@code clenzy.maps.signing-secret}), la fonction est
 * désactivée : aucune image n'est proposée, aucune n'est servie.</p>
 */
@Component
public class StaticMapSigner {

    private static final String ALGORITHM = "HmacSHA256";

    private final byte[] secret;

    public StaticMapSigner(@Value("${clenzy.maps.signing-secret:}") String secret) {
        this.secret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
    }

    public boolean isEnabled() {
        return secret.length >= 32;
    }

    public String sign(String payload) {
        if (!isEnabled()) throw new IllegalStateException("Signature des cartes non configuree");
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(payload));
    }

    /** Comparaison en temps constant : pas d'oracle de signature par mesure de durée. */
    public boolean verify(String payload, String signature) {
        if (!isEnabled() || payload == null || signature == null) return false;
        try {
            byte[] expected = hmac(payload);
            byte[] given = Base64.getUrlDecoder().decode(signature);
            return MessageDigest.isEqual(expected, given);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private byte[] hmac(String payload) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret, ALGORITHM));
            return mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HMAC indisponible", e);
        }
    }
}
