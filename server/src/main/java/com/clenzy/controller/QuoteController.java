package com.clenzy.controller;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.dto.QuoteResponseDto;
import com.clenzy.model.ReceivedForm;
import com.clenzy.repository.ReceivedFormRepository;
import com.clenzy.service.EmailService;
import com.clenzy.service.PricingConfigService;
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
 * Contrôleur public pour les demandes de devis depuis la landing page.
 * Aucune authentification requise (endpoint public).
 *
 * POST /api/public/quote-request
 * - Valide les données du formulaire
 * - Calcule le forfait recommandé (Essentiel / Confort / Premium)
 * - Calcule le tarif par intervention via un moteur de pondération
 *   (type logement × nbre logements × voyageurs × surface × fréquence)
 * - Envoie un email de notification à info@clenzy.fr
 * - Retourne le forfait recommandé au frontend
 */
@RestController
@RequestMapping("/api/public")
public class QuoteController {

    private static final Logger log = LoggerFactory.getLogger(QuoteController.class);

    private final EmailService emailService;
    private final PricingConfigService pricingConfigService;
    private final ReceivedFormRepository receivedFormRepository;
    private final ObjectMapper objectMapper;

    // Rate limiter simple en mémoire : IP -> liste de timestamps
    private final Map<String, CopyOnWriteArrayList<Instant>> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    public QuoteController(EmailService emailService, PricingConfigService pricingConfigService,
                           ReceivedFormRepository receivedFormRepository, ObjectMapper objectMapper) {
        this.emailService = emailService;
        this.pricingConfigService = pricingConfigService;
        this.receivedFormRepository = receivedFormRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Endpoint public pour exposer les prix configurables vers la landing page.
     * Retourne les prix de base des forfaits, les coefficients et les prix PMS.
     */
    @GetMapping("/pricing-info")
    public ResponseEntity<Map<String, Object>> getPricingInfo() {
        var config = pricingConfigService.getCurrentConfig();
        Map<String, Object> info = new java.util.LinkedHashMap<>();

        // Prix de base par forfait (EUR)
        info.put("basePriceEssentiel", config.getBasePriceEssentiel());
        info.put("basePriceConfort", config.getBasePriceConfort());
        info.put("basePricePremium", config.getBasePricePremium());
        info.put("minPrice", config.getMinPrice());

        // Prix PMS plateforme (centimes -> EUR pour la landing)
        info.put("pmsMonthlyPriceCents", config.getPmsMonthlyPriceCents());
        info.put("pmsSyncPriceCents", config.getPmsSyncPriceCents());

        // Coefficients
        info.put("propertyTypeCoeffs", config.getPropertyTypeCoeffs());
        info.put("propertyCountCoeffs", config.getPropertyCountCoeffs());
        info.put("guestCapacityCoeffs", config.getGuestCapacityCoeffs());
        info.put("frequencyCoeffs", config.getFrequencyCoeffs());
        info.put("surfaceTiers", config.getSurfaceTiers());

        return ResponseEntity.ok(info);
    }

    @PostMapping("/quote-request")
    public ResponseEntity<?> submitQuoteRequest(@RequestBody QuoteRequestDto dto, HttpServletRequest request) {

        // 1. Rate limiting
        String clientIp = getClientIp(request);
        if (isRateLimited(clientIp)) {
            log.warn("Rate limit dépassé pour l'IP : {}", clientIp);
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

        // 3. Calcul du forfait recommandé (essentiel / confort / premium)
        String recommendedPackage = computeRecommendedPackage(dto);
        int recommendedRate = computePrice(dto, recommendedPackage);

        // 4. Envoi de l'email de notification (non-bloquant en cas d'erreur)
        try {
            emailService.sendQuoteRequestNotification(dto, recommendedPackage, recommendedRate);
        } catch (Exception e) {
            // On ne bloque pas la réponse au prospect même si l'email échoue
            log.error("Erreur d'envoi email mais réponse OK pour : {} — {}", dto.getFullName(), e.getMessage());
        }

        // 4b. Sauvegarde en BDD (double écriture)
        try {
            ReceivedForm form = new ReceivedForm();
            form.setFormType("DEVIS");
            form.setFullName(dto.getFullName());
            form.setEmail(dto.getEmail());
            form.setPhone(dto.getPhone());
            form.setCity(dto.getCity());
            form.setPostalCode(dto.getPostalCode());
            form.setSubject("Demande de devis — " + dto.getFullName() + " — " + dto.getCity());
            form.setPayload(objectMapper.writeValueAsString(dto));
            form.setIpAddress(clientIp);
            receivedFormRepository.save(form);
        } catch (Exception e) {
            log.error("Erreur sauvegarde formulaire devis : {}", e.getMessage());
        }

        log.info("Demande de devis traitée : {} ({}) — Forfait : {} ({}€/intervention)",
                dto.getFullName(), dto.getEmail(), recommendedPackage, recommendedRate);

        // 5. Réponse avec le package recommandé
        QuoteResponseDto response = new QuoteResponseDto(
                "success",
                "Votre demande de devis a bien été envoyée. Nous vous recontacterons rapidement.",
                recommendedPackage,
                recommendedRate
        );

        return ResponseEntity.ok(response);
    }

    // ═══════════════════════════════════════════════════════════════
    // Algorithme de recommandation de forfait
    // ═══════════════════════════════════════════════════════════════

    /**
     * Calcule le forfait recommandé en fonction des réponses du formulaire.
     * Identique à la logique frontend dans computeRecommendedPackage().
     *
     * Note : la fréquence de réservation, le type de logement, la surface, etc.
     * n'influencent pas le tier du package recommandé — ils influencent
     * uniquement le tarif par intervention (voir computePrice).
     *
     * - Premium : synchro calendrier auto, grand bien (100m²+ & 7+ voyageurs),
     *   5+ services forfait, 3+ logements
     * - Confort : 2 logements, 3+ services forfait, surface ≥ 60m²,
     *   capacité 5-6 ou 7+ voyageurs
     * - Essentiel : par défaut
     */
    private String computeRecommendedPackage(QuoteRequestDto dto) {
        // Premium si besoins avancés (synchro, gros volume, multi-logements)
        if ("sync".equals(dto.getCalendarSync())) return "premium";
        if (dto.getServices() != null && dto.getServices().size() >= 5) return "premium";
        if (dto.getSurface() >= 100 && "7+".equals(dto.getGuestCapacity())) return "premium";
        if ("3-5".equals(dto.getPropertyCount()) || "6+".equals(dto.getPropertyCount())) return "premium";

        // Confort si besoins intermédiaires
        if ("2".equals(dto.getPropertyCount())) return "confort";
        if (dto.getServices() != null && dto.getServices().size() >= 3) return "confort";
        if (dto.getSurface() >= 60) return "confort";
        if ("5-6".equals(dto.getGuestCapacity()) || "7+".equals(dto.getGuestCapacity())) return "confort";

        // Essentiel par défaut
        return "essentiel";
    }

    /**
     * Calcule le tarif par intervention en fonction de tous les critères du formulaire.
     * Formule : base × typeLogement × nbreLogements × voyageurs × surface × fréquence
     * Arrondi à la tranche de 5€ la plus proche, avec un plancher configurable.
     *
     * Les coefficients et prix de base sont chargés dynamiquement depuis la DB
     * via PricingConfigService (configurable depuis le menu Tarification).
     */
    private int computePrice(QuoteRequestDto dto, String packageId) {
        Map<String, Integer> basePrices = pricingConfigService.getBasePrices();
        int base = basePrices.getOrDefault(packageId, 40);

        double typeCoeff = pricingConfigService.getPropertyTypeCoeffs().getOrDefault(dto.getPropertyType(), 1.0);
        double countCoeff = pricingConfigService.getPropertyCountCoeffs().getOrDefault(dto.getPropertyCount(), 1.0);
        double guestCoeff = pricingConfigService.getGuestCapacityCoeffs().getOrDefault(dto.getGuestCapacity(), 1.0);
        double surfaceCoeff = pricingConfigService.getSurfaceCoeff(dto.getSurface());
        double freqCoeff = pricingConfigService.getFrequencyCoeffs().getOrDefault(dto.getBookingFrequency(), 1.0);

        double raw = base * typeCoeff * countCoeff * guestCoeff * surfaceCoeff * freqCoeff;
        int minPrice = pricingConfigService.getMinPrice();
        return Math.max(minPrice, (int) (Math.round(raw / 5.0) * 5));
    }

    // ═══════════════════════════════════════════════════════════════
    // Validation & Rate Limiting
    // ═══════════════════════════════════════════════════════════════

    private String validateRequest(QuoteRequestDto dto) {
        if (dto.getFullName() == null || dto.getFullName().isBlank()) {
            return "Le nom complet est requis.";
        }
        if (dto.getEmail() == null || dto.getEmail().isBlank()) {
            return "L'adresse email est requise.";
        }
        if (!dto.getEmail().matches("^[A-Za-z0-9._%+\\-]+@[A-Za-z0-9.\\-]+\\.[A-Za-z]{2,}$")) {
            return "L'adresse email n'est pas valide.";
        }
        if (dto.getCity() == null || dto.getCity().isBlank()) {
            return "La ville est requise.";
        }
        if (dto.getPostalCode() == null || dto.getPostalCode().isBlank()) {
            return "Le code postal est requis.";
        }
        if (dto.getPropertyType() == null || dto.getPropertyType().isBlank()) {
            return "Le type de bien est requis.";
        }
        return null;
    }

    private boolean isRateLimited(String ip) {
        Instant now = Instant.now();
        Instant oneHourAgo = now.minusSeconds(3600);

        rateLimitMap.putIfAbsent(ip, new CopyOnWriteArrayList<>());
        CopyOnWriteArrayList<Instant> timestamps = rateLimitMap.get(ip);

        // Nettoyage des entrées expirées
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
