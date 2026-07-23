package com.clenzy.integration.kyc.strategy;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;

/**
 * Signature HMAC-SHA256 (hex minuscule) partagée par les stratégies KYC qui
 * signent leurs requêtes (Sumsub, Veriff).
 */
final class KycHmac {

    private KycHmac() {}

    static String sha256Hex(String secret, String payload) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16))
                   .append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            // HmacSHA256 est garanti par la JVM ; une clé invalide = bug de programmation.
            throw new IllegalStateException("Signature HMAC-SHA256 impossible", e);
        }
    }
}
