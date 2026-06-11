package com.clenzy.controller;

import com.clenzy.dto.ContractSignaturePublicDto;
import com.clenzy.service.signature.ContractSignatureService;
import com.clenzy.service.signature.TrustedClientIpResolver;
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Endpoints publics de consultation + signature électronique du contrat de gestion
 * (page guest /sign/{token}). Couverts par le permitAll /api/public/** existant et
 * exclus du TenantFilter : tout est dérivé du token, jamais d'un id client.
 *
 * <p>Réponse 404 uniforme pour un token inconnu/malformé (anti-énumération) et
 * rate-limit Redis à double dimension (Z4B-SECBUGS-03) : consultation limitée par
 * IP <b>et</b> par token (un botnet qui tourne sur les IP ne peut plus marteler un
 * token donné), signature limitée par token <b>et</b> par IP (une IP unique ne peut
 * pas brute-forcer la signature de plusieurs tokens). Si Redis est indisponible,
 * repli sur un compteur en mémoire locale plutôt que fail-open.</p>
 */
@RestController
@RequestMapping("/api/public/contract-signature")
public class PublicContractSignatureController {

    private static final Logger log = LoggerFactory.getLogger(PublicContractSignatureController.class);

    private static final int VIEW_MAX_PER_WINDOW = 30;
    // Par token : un signataire légitime ouvre la page + le PDF quelques fois ;
    // 60/10 min absorbe largement les relectures tout en bloquant le martelage
    // distribué (rotation d'IP) sur un même token.
    private static final int VIEW_TOKEN_MAX_PER_WINDOW = 60;
    private static final int SIGN_MAX_PER_WINDOW = 5;
    // Par IP : une signature légitime = 1-2 tentatives ; borne les essais
    // multi-tokens depuis une même IP.
    private static final int SIGN_IP_MAX_PER_WINDOW = 10;
    private static final Duration RATE_WINDOW = Duration.ofMinutes(10);
    private static final int LOCAL_WINDOWS_CLEANUP_THRESHOLD = 1_000;

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
        UUID parsed = parseToken(token);
        enforceRateLimit("contract-sign:view-token:" + parsed, VIEW_TOKEN_MAX_PER_WINDOW);
        return contractSignatureService.getPublicView(parsed);
    }

    @GetMapping("/{token}/document")
    public ResponseEntity<byte[]> getDocument(@PathVariable String token, HttpServletRequest request) {
        enforceRateLimit("contract-sign:view:" + getClientIp(request), VIEW_MAX_PER_WINDOW);
        UUID parsed = parseToken(token);
        enforceRateLimit("contract-sign:view-token:" + parsed, VIEW_TOKEN_MAX_PER_WINDOW);
        var payload = contractSignatureService.getDocument(parsed);
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
        enforceRateLimit("contract-sign:sign-ip:" + getClientIp(request), SIGN_IP_MAX_PER_WINDOW);
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

    /**
     * Rate-limit Redis incrémental. Si Redis est indisponible, repli sur un
     * compteur en mémoire locale (par instance) plutôt que fail-open : le flux de
     * signature est public et sensible, une panne Redis ne doit pas désactiver
     * toute protection (Z4B-SECBUGS-03).
     */
    private void enforceRateLimit(String key, int maxPerWindow) {
        long current;
        try {
            Long value = redisTemplate.opsForValue().increment(key);
            if (value == null) {
                current = incrementLocal(key);
            } else {
                if (value == 1L) {
                    redisTemplate.expire(key, RATE_WINDOW);
                }
                current = value;
            }
        } catch (Exception e) {
            log.warn("Rate-limit signature: Redis indisponible, repli compteur local: {}", e.getMessage());
            current = incrementLocal(key);
        }
        if (current > maxPerWindow) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Trop de tentatives, réessayez plus tard");
        }
    }

    /** Fenêtres locales de repli (clé → compteur + début de fenêtre). */
    private final ConcurrentHashMap<String, LocalWindow> localWindows = new ConcurrentHashMap<>();

    private long incrementLocal(String key) {
        if (localWindows.size() > LOCAL_WINDOWS_CLEANUP_THRESHOLD) {
            localWindows.entrySet().removeIf(entry -> entry.getValue().isExpired());
        }
        LocalWindow window = localWindows.compute(key, (k, existing) ->
                existing == null || existing.isExpired() ? LocalWindow.startNow() : existing);
        return window.count().incrementAndGet();
    }

    private record LocalWindow(long startMillis, AtomicLong count) {

        static LocalWindow startNow() {
            return new LocalWindow(System.currentTimeMillis(), new AtomicLong());
        }

        boolean isExpired() {
            return System.currentTimeMillis() - startMillis > RATE_WINDOW.toMillis();
        }
    }

    /**
     * IP cliente pour le rate-limit ET le dossier de preuve de signature (certificat
     * SES) : X-Forwarded-For n'est honoré que si le pair direct est un proxy de
     * confiance, parcouru de droite à gauche — sinon le signataire pourrait forger
     * l'IP attestée dans le certificat via un simple en-tête.
     */
    private String getClientIp(HttpServletRequest request) {
        return TrustedClientIpResolver.resolve(
                request.getRemoteAddr(),
                request.getHeader("X-Forwarded-For"),
                request.getHeader("X-Real-IP"));
    }
}
