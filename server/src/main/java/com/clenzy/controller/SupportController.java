package com.clenzy.controller;

import com.clenzy.service.NotificationService;
import com.clenzy.service.ReceivedFormService;
import com.clenzy.model.NotificationKey;
import com.clenzy.util.ClientIpResolver;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Réception publique des demandes Baitly (site et page d'authentification PMS).
 * Aucune authentification requise (endpoint public).
 *
 * POST /api/public/support
 * - Valide les donnees du formulaire
 * - Sauvegarde en BDD (table received_forms)
 * - Retourne un statut de succes
 */
@RestController
@RequestMapping("/api/public")
@PreAuthorize("permitAll()") // Déjà couvert par /api/public/** dans SecurityConfigProd.
public class SupportController {

    private static final Logger log = LoggerFactory.getLogger(SupportController.class);

    private final ReceivedFormService receivedFormService;
    private final NotificationService notificationService;

    // Rate limiter simple en memoire : IP -> liste de timestamps
    private final Cache<String, List<Instant>> rateLimitMap = Caffeine.newBuilder()
            .maximumSize(10_000).expireAfterAccess(Duration.ofHours(1)).build();
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    // Labels de sujets correspondant a Support.tsx
    private static final Map<String, String> SUBJECT_LABELS = Map.of(
            "access", "Probleme d'acces / connexion",
            "technical", "Probleme technique",
            "billing", "Facturation / abonnement",
            "feature", "Demande de fonctionnalite",
            "other", "Autre",
            "demo", "Découverte du produit",
            "migration", "Préparer une migration",
            "contact", "Question avant de démarrer",
            "privacy", "Données personnelles"
    );

    public SupportController(ReceivedFormService receivedFormService,
                             NotificationService notificationService) {
        this.receivedFormService = receivedFormService;
        this.notificationService = notificationService;
    }

    @PostMapping("/support")
    public ResponseEntity<?> submitSupportRequest(@RequestBody Map<String, String> body, HttpServletRequest request) {

        if (body == null) return ResponseEntity.badRequest().body(Map.of("status", "error"));
        String name = value(body, "name");
        String email = value(body, "email");
        String phone = value(body, "phone");
        String subject = value(body, "subject");
        String message = value(body, "message");

        // 1. Rate limiting
        String clientIp = ClientIpResolver.resolve(request.getRemoteAddr(),
                request.getHeader("X-Forwarded-For"), request.getHeader("X-Real-IP"));
        if (isRateLimited(clientIp)) {
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("status", "error", "message", "Trop de demandes. Veuillez reessayer dans une heure."));
        }

        // 2. Validation
        if (name.isEmpty() || name.length() > 120) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le nom est requis."));
        }
        if (email.length() > 254 || !email.matches("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$")) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "L'adresse email n'est pas valide."));
        }
        if (subject.isEmpty() || subject.length() > 100 || phone.length() > 50) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le sujet est requis."));
        }
        if (message.isEmpty() || message.length() > 5000) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", "Le message est requis."));
        }

        // Ne conserver que les champs attendus, avec une taille bornée.
        Map<String, String> payload = new LinkedHashMap<>();
        for (String key : List.of("name", "email", "phone", "subject", "message", "language", "source", "properties", "tool", "plan", "market")) {
            String field = value(body, key);
            if (!"message".equals(key) && field.length() > 254)
                return ResponseEntity.badRequest().body(Map.of("status", "error"));
            payload.put(key, field);
        }
        // Champ leurre : aucun message ni notification pour une soumission automatisée.
        if (!value(body, "website").isEmpty()) return ResponseEntity.ok(Map.of("status", "success"));

        String subjectLabel = SUBJECT_LABELS.getOrDefault(subject, subject);
        final Long savedFormId;
        // 3. La confirmation dépend de la persistance, pas d'une notification secondaire.
        try {
            savedFormId = receivedFormService.recordSupportForm(name, email, phone, subjectLabel, payload, clientIp);
        } catch (Exception e) {
            log.error("Erreur de sauvegarde du formulaire Baitly", e);
            return ResponseEntity.internalServerError().body(Map.of("status", "error"));
        }
        try {
            // Endpoint sans locataire : notifier les responsables de la plateforme.
            notificationService.notifyAllPlatformStaff(
                    NotificationKey.CONTACT_FORM_RECEIVED,
                    "Nouvelle demande de support — " + name,
                    "Sujet : " + subjectLabel + " — De : " + name + " (" + email + ")",
                    savedFormId != null ? "/contact?highlight=" + savedFormId : "/contact"
            );
        } catch (Exception e) {
            log.error("Notification indisponible pour le formulaire enregistré #{}", savedFormId, e);
        }

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Votre demande a bien été enregistrée."
        ));
    }

    // ═══════════════════════════════════════════════════════════════
    // Rate Limiting & Utils
    // ═══════════════════════════════════════════════════════════════

    private synchronized boolean isRateLimited(String ip) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);
        List<Instant> timestamps = rateLimitMap.get(ip, key -> new ArrayList<>());
        timestamps.removeIf(t -> t.isBefore(oneHourAgo));
        if (timestamps.size() >= MAX_REQUESTS_PER_HOUR) return true;
        timestamps.add(now);
        return false;
    }

    private static String value(Map<String, String> body, String key) {
        String value = body.get(key);
        return value == null ? "" : value.trim();
    }
}
