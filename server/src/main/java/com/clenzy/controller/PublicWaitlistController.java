package com.clenzy.controller;

import com.clenzy.dto.WaitlistSignupDto;
import com.clenzy.service.WaitlistService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Endpoint public d'inscription à la waitlist de lancement (depuis la landing).
 * Aucune authentification (couvert par /api/public/** → permitAll).
 *
 * POST /api/public/waitlist       → inscription
 * GET  /api/public/waitlist/stats → compteur public (urgence « plus que X places »)
 */
@RestController
@RequestMapping("/api/public/waitlist")
public class PublicWaitlistController {

    private static final Logger log = LoggerFactory.getLogger(PublicWaitlistController.class);

    private final WaitlistService waitlistService;

    // Rate limiter simple en mémoire : IP -> timestamps.
    private final Map<String, CopyOnWriteArrayList<Instant>> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_HOUR = 10;

    public PublicWaitlistController(WaitlistService waitlistService) {
        this.waitlistService = waitlistService;
    }

    @PostMapping
    public ResponseEntity<?> signup(@RequestBody WaitlistSignupDto dto, HttpServletRequest request) {
        String ip = clientIp(request);
        if (isRateLimited(ip)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Trop de tentatives. Réessayez plus tard."));
        }
        try {
            return ResponseEntity.ok(waitlistService.register(dto, ip));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        } catch (Exception e) {
            log.error("Erreur inscription waitlist : {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error",
                            "message", "Impossible d'enregistrer votre inscription. Réessayez."));
        }
    }

    @GetMapping("/stats")
    public ResponseEntity<WaitlistService.WaitlistStats> stats() {
        return ResponseEntity.ok(waitlistService.stats());
    }

    // ── Rate limiting / IP (même approche que QuoteController) ──────────────

    private boolean isRateLimited(String ip) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);
        rateLimitMap.putIfAbsent(ip, new CopyOnWriteArrayList<>());
        CopyOnWriteArrayList<Instant> timestamps = rateLimitMap.get(ip);
        timestamps.removeIf(t -> t.isBefore(oneHourAgo));
        if (timestamps.size() >= MAX_REQUESTS_PER_HOUR) {
            return true;
        }
        timestamps.add(now);
        return false;
    }

    private String clientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) return xRealIp;
        return request.getRemoteAddr();
    }
}
