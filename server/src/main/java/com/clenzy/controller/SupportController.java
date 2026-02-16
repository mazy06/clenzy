package com.clenzy.controller;

import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.NotificationService;
import com.clenzy.model.NotificationKey;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Controleur public pour les demandes de support depuis la page d'authentification PMS.
 * Aucune authentification requise (endpoint public).
 *
 * POST /api/public/support
 * - Valide les donnees du formulaire
 * - Sauvegarde en BDD (table received_forms)
 * - Retourne un statut de succes
 */
@RestController
@RequestMapping("/api/public")
public class SupportController {

    private static final Logger log = LoggerFactory.getLogger(SupportController.class);

    private final ReceivedFormRepository receivedFormRepository;
    private final ObjectMapper objectMapper;
    private final NotificationService notificationService;

    // Rate limiter simple en memoire : IP -> liste de timestamps
    private final Map<String, CopyOnWriteArrayList<Instant>> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    // Labels de sujets correspondant a Support.tsx
    private static final Map<String, String> SUBJECT_LABELS = Map.of(
            "access", "Probleme d'acces / connexion",
            "technical", "Probleme technique",
            "billing", "Facturation / abonnement",
            "feature", "Demande de fonctionnalite",
            "other", "Autre"
    );

    public SupportController(ReceivedFormRepository receivedFormRepository, ObjectMapper objectMapper,
                             NotificationService notificationService) {
        this.receivedFormRepository = receivedFormRepository;
        this.objectMapper = objectMapper;
        this.notificationService = notificationService;
    }

    @PostMapping("/support")
    public ResponseEntity<?> submitSupportRequest(@RequestBody Map<String, String> body, HttpServletRequest request) {

        String name = body.getOrDefault("name", "").trim();
        String email = body.getOrDefault("email", "").trim();
        String phone = body.getOrDefault("phone", "").trim();
        String subject = body.getOrDefault("subject", "").trim();
        String message = body.getOrDefault("message", "").trim();

        // 1. Rate limiting
        String clientIp = getClientIp(request);
        if (isRateLimited(clientIp)) {
            log.warn("Rate limit support depasse pour l'IP : {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Trop de demandes. Veuillez reessayer dans une heure."));
        }

        // 2. Validation
        if (name.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le nom est requis."));
        }
        if (email.isEmpty() || !email.matches("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "L'adresse email n'est pas valide."));
        }
        if (subject.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le sujet est requis."));
        }
        if (message.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le message est requis."));
        }

        // 3. Sauvegarde en BDD
        try {
            String subjectLabel = SUBJECT_LABELS.getOrDefault(subject, subject);

            ReceivedForm form = new ReceivedForm();
            form.setFormType("SUPPORT");
            form.setFullName(name);
            form.setEmail(email);
            form.setPhone(phone.isEmpty() ? null : phone);
            form.setSubject("Support — " + subjectLabel + " — " + name);
            form.setPayload(objectMapper.writeValueAsString(body));
            form.setIpAddress(clientIp);
            receivedFormRepository.save(form);

            log.info("Demande de support sauvegardee : {} ({}) — Sujet : {}", name, email, subjectLabel);

            // Notification aux admins/managers
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.CONTACT_FORM_RECEIVED,
                    "Nouvelle demande de support — " + name,
                    "Sujet : " + subjectLabel + " — De : " + name + " (" + email + ")",
                    "/contact?tab=2"
            );
        } catch (Exception e) {
            log.error("Erreur sauvegarde formulaire support : {}", e.getMessage());
            return ResponseEntity.internalServerError()
                    .body(Map.of("status", "error", "message", "Erreur lors de l'enregistrement de votre demande."));
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Votre demande de support a bien ete envoyee. Notre equipe vous contactera dans les 24 heures."
        ));
    }

    // ═══════════════════════════════════════════════════════════════
    // Rate Limiting & Utils
    // ═══════════════════════════════════════════════════════════════

    private boolean isRateLimited(String ip) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);
        rateLimitMap.putIfAbsent(ip, new CopyOnWriteArrayList<>());
        CopyOnWriteArrayList<Instant> timestamps = rateLimitMap.get(ip);
        timestamps.removeIf(t -> t.isBefore(oneHourAgo));
        if (timestamps.size() >= MAX_REQUESTS_PER_HOUR) return true;
        timestamps.add(now);
        return false;
    }

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) return xForwardedFor.split(",")[0].trim();
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isBlank()) return xRealIp;
        return request.getRemoteAddr();
    }
}
