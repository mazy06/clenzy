package com.clenzy.controller;

import com.clenzy.dto.MaintenanceRequestDto;
import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.EmailService;
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
 * Contrôleur public pour les demandes de devis maintenance depuis la landing page.
 * Aucune authentification requise (endpoint public).
 *
 * POST /api/public/maintenance-request
 * - Valide les données du formulaire
 * - Envoie un email de notification à info@clenzy.fr
 * - Retourne un statut de succès
 */
@RestController
@RequestMapping("/api/public")
public class MaintenanceController {

    private static final Logger log = LoggerFactory.getLogger(MaintenanceController.class);

    private final EmailService emailService;
    private final ReceivedFormRepository receivedFormRepository;
    private final ObjectMapper objectMapper;

    // Rate limiter simple en mémoire : IP -> liste de timestamps
    private final Map<String, CopyOnWriteArrayList<Instant>> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    public MaintenanceController(EmailService emailService, ReceivedFormRepository receivedFormRepository,
                                 ObjectMapper objectMapper) {
        this.emailService = emailService;
        this.receivedFormRepository = receivedFormRepository;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/maintenance-request")
    public ResponseEntity<?> submitMaintenanceRequest(@RequestBody MaintenanceRequestDto dto, HttpServletRequest request) {

        // 1. Rate limiting
        String clientIp = getClientIp(request);
        if (isRateLimited(clientIp)) {
            log.warn("Rate limit maintenance dépassé pour l'IP : {}", clientIp);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of(
                            "status", "error",
                            "message", "Trop de demandes. Veuillez réessayer dans une heure."
                    ));
        }

        // 2. Validation
        String validationError = validateRequest(dto);
        if (validationError != null) {
            return ResponseEntity.badRequest()
                    .body(Map.of(
                            "status", "error",
                            "message", validationError
                    ));
        }

        // 3. Envoi de l'email de notification
        try {
            emailService.sendMaintenanceNotification(dto);
        } catch (Exception e) {
            log.error("Erreur d'envoi email maintenance mais réponse OK pour : {} — {}", dto.getFullName(), e.getMessage());
        }

        // 3b. Sauvegarde en BDD (double écriture)
        try {
            ReceivedForm form = new ReceivedForm();
            form.setFormType("MAINTENANCE");
            form.setFullName(dto.getFullName());
            form.setEmail(dto.getEmail());
            form.setPhone(dto.getPhone());
            form.setCity(dto.getCity());
            form.setPostalCode(dto.getPostalCode());
            form.setSubject("Maintenance — " + dto.getFullName() + (dto.getCity() != null ? " — " + dto.getCity() : ""));
            form.setPayload(objectMapper.writeValueAsString(dto));
            form.setIpAddress(clientIp);
            receivedFormRepository.save(form);
        } catch (Exception e) {
            log.error("Erreur sauvegarde formulaire maintenance : {}", e.getMessage());
        }

        int totalWorks = (dto.getSelectedWorks() != null ? dto.getSelectedWorks().size() : 0)
                + (dto.getCustomNeed() != null && !dto.getCustomNeed().isBlank() ? 1 : 0);

        log.info("Demande de devis maintenance traitée : {} ({}) — {} intervention(s) — Urgence : {}",
                dto.getFullName(), dto.getEmail(), totalWorks, dto.getUrgency());

        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Votre demande de devis maintenance a bien été envoyée. Nous vous recontacterons rapidement."
        ));
    }

    // ═══════════════════════════════════════════════════════════════
    // Validation & Rate Limiting
    // ═══════════════════════════════════════════════════════════════

    private String validateRequest(MaintenanceRequestDto dto) {
        if (dto.getFullName() == null || dto.getFullName().isBlank()) {
            return "Le nom complet est requis.";
        }
        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            return "L'adresse email est requise.";
        }
        if (!dto.getEmail().matches("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$")) {
            return "L'adresse email n'est pas valide.";
        }
        boolean hasWorks = dto.getSelectedWorks() != null && !dto.getSelectedWorks().isEmpty();
        boolean hasCustom = dto.getCustomNeed() != null && !dto.getCustomNeed().isBlank();
        if (!hasWorks && !hasCustom) {
            return "Veuillez sélectionner au moins un travail ou décrire votre besoin.";
        }
        return null;
    }

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
