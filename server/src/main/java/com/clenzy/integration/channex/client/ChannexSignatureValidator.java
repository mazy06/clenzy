package com.clenzy.integration.channex.client;

import com.clenzy.integration.channex.config.ChannexProperties;
import com.clenzy.integration.channex.exception.ChannexException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.InvalidKeyException;
import java.util.HexFormat;

/**
 * Validation des signatures HMAC-SHA256 des webhooks Channex.
 *
 * <p>Channex signe le body brut du webhook avec le shared secret configure
 * cote dashboard. Le header {@code X-Channex-Signature} contient le hex digest.
 * On compare en constant-time pour eviter les timing attacks.</p>
 */
@Component
public class ChannexSignatureValidator {

    private static final Logger log = LoggerFactory.getLogger(ChannexSignatureValidator.class);
    private static final String HMAC_ALGORITHM = "HmacSHA256";

    private final ChannexProperties props;

    public ChannexSignatureValidator(ChannexProperties props) {
        this.props = props;
    }

    /**
     * Valide une signature de webhook Channex.
     *
     * @param rawBody      Corps brut du webhook (tel qu'envoye par Channex)
     * @param signatureHex Signature recue dans le header X-Channex-Signature
     * @return true si valide, false sinon
     */
    public boolean isValid(String rawBody, String signatureHex) {
        if (rawBody == null || signatureHex == null || signatureHex.isBlank()) {
            log.warn("Channex webhook: body or signature null/empty");
            return false;
        }
        String secret = props.getWebhookSecret();
        if (secret == null || secret.isBlank()) {
            log.error("Channex webhook secret not configured (clenzy.channex.webhook-secret) — refusing all webhooks");
            return false;
        }

        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] expected = mac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
            String expectedHex = HexFormat.of().formatHex(expected);
            return MessageDigest.isEqual(
                expectedHex.getBytes(StandardCharsets.UTF_8),
                signatureHex.trim().toLowerCase().getBytes(StandardCharsets.UTF_8)
            );
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new ChannexException(ChannexException.Kind.TRANSPORT,
                "HMAC signature validation failed: " + e.getMessage(), e);
        }
    }
}
