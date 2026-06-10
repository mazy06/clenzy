package com.clenzy.controller;

import com.clenzy.dto.ContractSignaturePublicDto;
import com.clenzy.service.signature.ContractSignatureService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Endpoints publics de consultation + signature électronique du contrat de gestion
 * (page guest /sign/{token}). Couverts par le permitAll /api/public/** existant et
 * exclus du TenantFilter : tout est dérivé du token, jamais d'un id client.
 *
 * <p>Réponse 404 uniforme pour un token inconnu/malformé (anti-énumération) et
 * rate-limit Redis : par IP sur la consultation, par token sur la signature.</p>
 */
@RestController
@RequestMapping("/api/public/contract-signature")
public class PublicContractSignatureController {

    private static final Logger log = LoggerFactory.getLogger(PublicContractSignatureController.class);

    private static final int VIEW_MAX_PER_WINDOW = 30;
    private static final int SIGN_MAX_PER_WINDOW = 5;
    private static final Duration RATE_WINDOW = Duration.ofMinutes(10);

    private final ContractSignatureService contractSignatureService;
    private final StringRedisTemplate redisTemplate;

    public PublicContractSignatureController(ContractSignatureService contractSignatureService,
                                              StringRedisTemplate redisTemplate) {
        this.contractSignatureService = contractSignatureService;
        this.redisTemplate = redisTemplate;
    }

    @GetMapping("/{token}")
    public ContractSignaturePublicDto getView(@PathVariable String token, HttpServletRequest request) {
        enforceRateLimit("contract-sign:view:" + getClientIp(request), VIEW_MAX_PER_WINDOW);
        return contractSignatureService.getPublicView(parseToken(token));
    }

    @GetMapping("/{token}/document")
    public ResponseEntity<byte[]> getDocument(@PathVariable String token, HttpServletRequest request) {
        enforceRateLimit("contract-sign:view:" + getClientIp(request), VIEW_MAX_PER_WINDOW);
        var payload = contractSignatureService.getDocument(parseToken(token));
        String encodedFilename = URLEncoder.encode(payload.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header("Content-Disposition", "inline; filename=\"" + payload.fileName() + "\"; "
                        + "filename*=UTF-8''" + encodedFilename)
                // Document contractuel derrière token : pas de cache intermédiaire.
                .header("Cache-Control", "private, no-store")
                .body(payload.bytes());
    }

    public record PublicSignRequest(String signerName, Boolean consent) {}

    @PostMapping("/{token}/sign")
    public ContractSignaturePublicDto sign(@PathVariable String token,
                                            @RequestBody PublicSignRequest body,
                                            HttpServletRequest request) {
        enforceRateLimit("contract-sign:sign:" + token, SIGN_MAX_PER_WINDOW);
        return contractSignatureService.sign(
                parseToken(token),
                body.signerName(),
                Boolean.TRUE.equals(body.consent()),
                getClientIp(request),
                request.getHeader("User-Agent"));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleStatus(ResponseStatusException e) {
        return ResponseEntity.status(e.getStatusCode())
                .body(Map.of("error", e.getReason() != null ? e.getReason() : "Erreur"));
    }

    /** Token malformé = inconnu : 404 uniforme (anti-énumération). */
    private UUID parseToken(String token) {
        try {
            return UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    /** Rate-limit Redis incrémental, fail-open si Redis indisponible. */
    private void enforceRateLimit(String key, int maxPerWindow) {
        try {
            Long current = redisTemplate.opsForValue().increment(key);
            if (current != null && current == 1L) {
                redisTemplate.expire(key, RATE_WINDOW);
            }
            if (current != null && current > maxPerWindow) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Trop de tentatives, réessayez plus tard");
            }
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Rate-limit signature indisponible (Redis): {}", e.getMessage());
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}
