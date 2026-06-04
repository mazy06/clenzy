package com.clenzy.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;

/**
 * Emet et valide des <b>tickets HMAC court-vecu, scopes a un seul flux media</b>
 * ({@code streamName}). Ils autorisent l'acces a {@code /media/} : nginx les valide via
 * {@code auth_request} -> {@code /api/media/verify} avant de proxifier go2rtc, ce qui ferme
 * le trou « n'importe qui connaissant le nom de stream peut voir le flux ».
 *
 * <p>Format : {@code "{expEpochSec}.{base64url(HMAC_SHA256(streamName + "." + exp, key))}"}.
 *
 * <p>La cle HMAC est <b>derivee du secret de chiffrement existant</b> (domain separation),
 * donc aucun nouveau secret n'est a provisionner en prod. L'expiration est <b>quantifiee par
 * fenetre</b> : pour un meme flux, le ticket est stable pendant toute la fenetre courante ->
 * l'URL ne change pas a chaque refetch et reste donc cacheable par le navigateur (sinon on
 * re-activerait la source go2rtc en continu). Il tourne a chaque fenetre et expire.
 */
@Service
public class MediaTicketService {

    /** Fenetre de stabilite/rotation du ticket (s). TTL effectif entre WINDOW et 2*WINDOW. */
    private static final long WINDOW_SECONDS = 900; // 15 min
    private static final String HMAC_ALGO = "HmacSHA256";

    private final byte[] key;

    public MediaTicketService(@Value("${jasypt.encryptor.password}") String encryptionSecret) {
        this.key = deriveKey(encryptionSecret);
    }

    /** Emet un ticket pour ce flux (null si streamName vide). */
    public String mint(String streamName) {
        if (streamName == null || streamName.isBlank()) {
            return null;
        }
        long exp = expForWindow(Instant.now().getEpochSecond());
        return exp + "." + sign(streamName, exp);
    }

    /** Valide un ticket pour ce flux : signature correcte (constant-time) ET non expire. */
    public boolean verify(String streamName, String ticket) {
        if (streamName == null || streamName.isBlank() || ticket == null) {
            return false;
        }
        int dot = ticket.indexOf('.');
        if (dot <= 0 || dot == ticket.length() - 1) {
            return false;
        }
        final long exp;
        try {
            exp = Long.parseLong(ticket.substring(0, dot));
        } catch (NumberFormatException e) {
            return false;
        }
        if (Instant.now().getEpochSecond() > exp) {
            return false;
        }
        byte[] provided = ticket.substring(dot + 1).getBytes(StandardCharsets.UTF_8);
        byte[] expected = sign(streamName, exp).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(provided, expected); // comparaison a temps constant
    }

    /** Expiration quantifiee : meme valeur pour toute la fenetre courante (URL stable/cacheable). */
    private static long expForWindow(long nowSec) {
        return ((nowSec / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
    }

    /** Signature HMAC-SHA256 base64url (sans padding). Package-private : seam de test. */
    String sign(String streamName, long exp) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGO);
            mac.init(new SecretKeySpec(key, HMAC_ALGO));
            byte[] raw = mac.doFinal((streamName + "." + exp).getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        } catch (Exception e) {
            throw new IllegalStateException("Signature media-ticket impossible", e);
        }
    }

    /** Derive une cle HMAC dediee (domain separation) a partir du secret de chiffrement. */
    private static byte[] deriveKey(String secret) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return md.digest(("clenzy-media-ticket:" + (secret == null ? "" : secret)).getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException("Derivation cle media-ticket impossible", e);
        }
    }
}
