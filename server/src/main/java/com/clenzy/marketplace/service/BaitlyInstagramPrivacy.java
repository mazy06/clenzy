package com.clenzy.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/** Signed Meta privacy callbacks. No unsigned user ID can trigger erasure. */
@Service
public class BaitlyInstagramPrivacy {
    private static final Duration RECEIPT_TTL = Duration.ofDays(30);
    private final String secret;
    private final String redirect;
    private final ObjectMapper json;
    private final Clock clock;
    private final StringRedisTemplate redis;
    private final BaitlyReels reels;

    public BaitlyInstagramPrivacy(@Value("${baitly.instagram.app-secret:${BAITLY_INSTAGRAM_APP_SECRET:}}") String secret,
            @Value("${baitly.instagram.redirect-uri:${BAITLY_INSTAGRAM_REDIRECT_URI:}}") String redirect, ObjectMapper json,
            Clock clock, StringRedisTemplate redis, BaitlyReels reels) {
        this.secret = secret; this.redirect = redirect; this.json = json;
        this.clock = clock; this.redis = redis; this.reels = reels;
    }

    public Map<String, String> erase(String signedRequest) {
        String userId = verifiedUserId(signedRequest);
        String statusBase = statusBase();
        String eventKey = "baitly:instagram:privacy:event:" + fingerprint(signedRequest);
        String previous = redis.opsForValue().get(eventKey);
        if (previous != null && !previous.equals("processing")) return receipt(statusBase, previous);
        if (!Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(eventKey, "processing", Duration.ofMinutes(5))))
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Demande en cours, réessayez");
        try {
            // The transactional service commits before any completed receipt is emitted.
            reels.eraseInstagramData(userId);
            String code = UUID.randomUUID().toString();
            redis.opsForValue().set("baitly:instagram:privacy:receipt:" + code, "completed", RECEIPT_TTL);
            redis.opsForValue().set(eventKey, code, RECEIPT_TTL);
            return receipt(statusBase, code);
        } catch (RuntimeException error) {
            redis.delete(eventKey);
            throw error;
        }
    }

    public boolean completed(String code) {
        if (code == null || !code.matches("[0-9a-f-]{36}")) return false;
        return "completed".equals(redis.opsForValue().get("baitly:instagram:privacy:receipt:" + code));
    }

    String verifiedUserId(String signedRequest) {
        if (secret.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Instagram non configuré");
        try {
            if (signedRequest == null || signedRequest.length() > 8192) throw new IllegalArgumentException();
            String[] parts = signedRequest.split("\\.", -1);
            if (parts.length != 2 || parts[0].isEmpty() || parts[1].isEmpty()) throw new IllegalArgumentException();
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature = Base64.getUrlDecoder().decode(parts[0]);
            if (!MessageDigest.isEqual(signature, mac.doFinal(parts[1].getBytes(StandardCharsets.US_ASCII))))
                throw new IllegalArgumentException();
            var payload = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
            String id = payload.path("user_id").asText();
            long issued = payload.path("issued_at").asLong(0);
            long now = clock.instant().getEpochSecond();
            if (!"HMAC-SHA256".equals(payload.path("algorithm").asText()) || !id.matches("[0-9]{1,100}")
                    || issued <= 0 || issued > now + 300 || issued < now - Duration.ofDays(7).toSeconds())
                throw new IllegalArgumentException();
            return id;
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Signature Meta invalide");
        }
    }

    private String statusBase() {
        try {
            URI uri = URI.create(redirect);
            if (!"https".equals(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                    || uri.getQuery() != null || uri.getFragment() != null
                    || !"/api/public/baitly-catalog/instagram/callback".equals(uri.getPath()))
                throw new IllegalArgumentException();
            return "https://" + uri.getRawAuthority() + "/api/public/baitly-catalog/instagram/deletion-status/";
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Retour Instagram non configuré");
        }
    }

    private static Map<String, String> receipt(String base, String code) {
        return Map.of("url", base + code, "confirmation_code", code);
    }

    private static String fingerprint(String value) {
        try {
            // Signature padding variants must not turn a replay into a new erasure.
            byte[] payload = Base64.getUrlDecoder().decode(value.substring(value.indexOf('.') + 1));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload));
        } catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
    }
}
