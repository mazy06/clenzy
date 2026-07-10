package com.clenzy.controller;

import com.clenzy.dto.QuoteRequestDto;
import com.clenzy.dto.QuoteResponseDto;
import com.clenzy.dto.WaitlistSignupDto;
import com.clenzy.model.DocumentType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.ReferenceType;
import com.clenzy.service.DocumentGeneratorService;
import com.clenzy.service.EmailService;
import com.clenzy.service.NotificationService;
import com.clenzy.service.PlatformSettingsService;
import com.clenzy.service.PricingConfigService;
import com.clenzy.service.ReceivedFormService;
import com.clenzy.service.WaitlistService;
import com.clenzy.service.pricing.CleaningPricingEngine;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
 * - Calcule le tarif par intervention via le moteur ménage unifié
 *   (CleaningPricingEngine) + sur-couche commerciale (package × nbre
 *   logements × fréquence, plancher, arrondi 5 €)
 * - Génère le devis PDF et l'envoie au prospect (info@clenzy.fr en copie CC)
 * - Retourne le forfait recommandé au frontend
 */
@RestController
@RequestMapping("/api/public")
public class QuoteController {

    private static final Logger log = LoggerFactory.getLogger(QuoteController.class);

    private final EmailService emailService;
    private final PricingConfigService pricingConfigService;
    private final ReceivedFormService receivedFormService;
    private final NotificationService notificationService;
    private final DocumentGeneratorService documentGeneratorService;
    private final PlatformSettingsService platformSettingsService;
    private final WaitlistService waitlistService;
    private final CleaningPricingEngine cleaningPricingEngine;

    // Rate limiter simple en mémoire : IP -> liste de timestamps
    private final Map<String, CopyOnWriteArrayList<Instant>> rateLimitMap = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_HOUR = 5;

    /**
     * Facteur commercial par package appliqué sur le prix moteur (équivalent à
     * moduler le taux horaire de référence, le prix moteur étant linéaire en
     * taux horaire). TRANSITOIRE (P3, PLAN-MOTEUR-MENAGE.md) : la modulation
     * par package sera portée DANS le moteur ultérieurement.
     */
    private static final Map<String, Double> PACKAGE_RATE_FACTORS = Map.of(
            "essentiel", 0.9,
            "confort", 1.0,
            "premium", 1.15);

    public QuoteController(EmailService emailService, PricingConfigService pricingConfigService,
                           ReceivedFormService receivedFormService,
                           NotificationService notificationService,
                           DocumentGeneratorService documentGeneratorService,
                           PlatformSettingsService platformSettingsService,
                           WaitlistService waitlistService,
                           CleaningPricingEngine cleaningPricingEngine) {
        this.emailService = emailService;
        this.pricingConfigService = pricingConfigService;
        this.receivedFormService = receivedFormService;
        this.notificationService = notificationService;
        this.documentGeneratorService = documentGeneratorService;
        this.platformSettingsService = platformSettingsService;
        this.waitlistService = waitlistService;
        this.cleaningPricingEngine = cleaningPricingEngine;
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

        // Supplément IA mensuel par forfait (centimes) — campagne X5
        info.put("aiSurchargeEssentielCents", config.getAiSurchargeEssentielCents());
        info.put("aiSurchargeConfortCents", config.getAiSurchargeConfortCents());
        info.put("aiSurchargePremiumCents", config.getAiSurchargePremiumCents());

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

        // 4. Sauvegarde en BDD (PRIORITAIRE — si ca echoue, on remonte une 500
        //    pour que le prospect retente plutot que de perdre sa demande).
        final Long savedFormId;
        try {
            savedFormId = receivedFormService.recordQuoteForm(dto, clientIp);
        } catch (Exception e) {
            log.error("Erreur CRITIQUE sauvegarde formulaire devis pour {} : {}",
                    dto.getFullName(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "status", "error",
                            "message", "Impossible d'enregistrer votre demande. Reessayez ou contactez-nous au 07 66 72 91 09."
                    ));
        }

        // 5. Génération PDF devis + envoi au prospect, avec info@clenzy.fr en COPIE (CC)
        //    via EmailService.sendQuoteToProspect. PAS d'email interne séparé dans le
        //    cas nominal. Le devis ne part qu'une fois (dédup) ; un clic "Générer PDF"
        //    ultérieur dans le PMS ne renverra pas.
        //    Non-bloquant : la demande reste en BDD/PMS même si l'envoi échoue.
        // 4b. Pré-lancement : verser le lead devis dans la waitlist de lancement
        //     (toggle plateforme add_devis_leads_to_waitlist, DÉSACTIVÉ par défaut —
        //     seul le formulaire /bientot-disponible alimente la waitlist par défaut).
        //     Best-effort : ne jamais faire échouer la demande de devis. Idempotent par email.
        if (platformSettingsService.isAddDevisLeadsToWaitlist()) {
            try {
                waitlistService.register(new WaitlistSignupDto(
                        dto.getEmail(), dto.getFullName(), dto.getPhone(),
                        dto.getPropertyCount(), dto.getCity(), "devis"), clientIp);
            } catch (Exception e) {
                log.warn("Ajout du devis #{} à la waitlist KO : {}", savedFormId, e.getMessage());
            }
        }

        // Toggle plateforme : en pré-lancement, les SUPER_ADMIN / SUPER_MANAGER peuvent
        // couper l'envoi des emails de devis aux prospects. info@clenzy.fr reste notifié
        // via le fallback ci-dessous (sendQuoteRequestNotification), pour ne jamais rester
        // aveugle sur une demande entrante.
        boolean prospectEmailsEnabled = platformSettingsService.isSendProspectDevisEmails();
        boolean prospectNotified = false;
        if (prospectEmailsEnabled && dto.getEmail() != null && !dto.getEmail().isBlank()) {
            try {
                documentGeneratorService.generateFromEvent(
                        DocumentType.DEVIS,
                        savedFormId,
                        ReferenceType.RECEIVED_FORM,
                        dto.getEmail(),
                        null   // organizationId null → template GLOBAL (si configuré en BDD)
                );
                prospectNotified = true;
            } catch (Exception e) {
                log.warn("Envoi devis prospect KO pour #{} ({}) : {}",
                        savedFormId, dto.getFullName(), e.getMessage());
            }
        } else if (!prospectEmailsEnabled) {
            log.info("Emails devis prospect DÉSACTIVÉS (réglage plateforme) — devis #{} non envoyé au prospect ; info@ sera notifié.",
                    savedFormId);
        }
        // FILET : le prospect n'a pas pu être notifié (pas d'email — cas théorique car
        // validateRequest l'exige — OU échec d'envoi/génération) → on prévient quand
        // même l'équipe par un email interne à info@clenzy.fr, pour ne jamais rester
        // aveugle sur une demande de devis.
        if (!prospectNotified) {
            try {
                emailService.sendQuoteRequestNotification(dto, recommendedPackage, recommendedRate, null);
            } catch (Exception e) {
                log.warn("Notification interne devis #{} KO : {}", savedFormId, e.getMessage());
            }
        }

        // 7. Notification a tous les SUPER_ADMIN et SUPER_MANAGER de la plateforme
        //    (non-bloquant). On utilise notifyAllPlatformStaff car cet endpoint est
        //    public (pas de JWT, pas de TenantContext) — notifyAdminsAndManagers
        //    qui lit le TenantContext planterait silencieusement.
        try {
            notificationService.notifyAllPlatformStaff(
                    NotificationKey.CONTACT_FORM_RECEIVED,
                    "Nouveau devis — " + dto.getFullName(),
                    "Demande de devis de " + dto.getFullName() + " (" + dto.getCity() + ") — Forfait : " + recommendedPackage,
                    "/contact?highlight=" + savedFormId
            );
        } catch (Exception e) {
            log.error("Notification admins KO mais demande #{} sauvegardee en BDD : {}",
                    savedFormId, e.getMessage());
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
        // Pré-lancement : signale au front si l'email de devis est réellement parti.
        // Si non (toggle plateforme OFF), le front affiche « notre équipe vous
        // recontactera pour votre devis » au lieu de « devis envoyé par email ».
        response.setProspectEmailSent(prospectNotified);

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
     * Calcule le tarif ménage par intervention pour le devis prospect
     * (P3, PLAN-MOTEUR-MENAGE.md).
     *
     * <p>Cœur du prix = {@link CleaningPricingEngine} : les mêmes minutes normées ×
     * taux horaire de référence que le PMS. Endpoint public sans tenant : le moteur
     * lit la config platform via {@code getCleaningEngineConfigJson} qui replie sur
     * la dernière config globale quand aucune org n'est résolue (même mécanisme que
     * {@code getCurrentConfig}). L'ancienne formule
     * base(package) × typeCoeff × surfaceCoeff × guestCoeff est remplacée :
     * surface et capacité entrent désormais directement dans le moteur.</p>
     *
     * <p>Sur-couche commerciale CONSERVÉE : facteur par package sur le prix moteur
     * ({@link #PACKAGE_RATE_FACTORS}), × countCoeff (dégressivité multi-logements),
     * × frequencyCoeff, plancher minPrice landing, arrondi au multiple de 5 €.</p>
     */
    private int computePrice(QuoteRequestDto dto, String packageId) {
        BigDecimal engineRecommended = cleaningPricingEngine
                .quote(prospectCleaningInputs(dto), CleaningPricingEngine.STANDARD_CLEANING)
                .recommended();

        double packageFactor = PACKAGE_RATE_FACTORS.getOrDefault(packageId, 1.0);
        double countCoeff = pricingConfigService.getPropertyCountCoeffs().getOrDefault(dto.getPropertyCount(), 1.0);
        double freqCoeff = pricingConfigService.getFrequencyCoeffs().getOrDefault(dto.getBookingFrequency(), 1.0);

        double raw = engineRecommended.doubleValue() * packageFactor * countCoeff * freqCoeff;
        int minPrice = pricingConfigService.getMinPrice();
        return Math.max(minPrice, (int) (Math.round(raw / 5.0) * 5));
    }

    /**
     * Traduit le formulaire prospect en composants du logement pour le moteur.
     *
     * <p>APPROXIMATION documentée : le formulaire landing ne demande ni chambres ni
     * salles de bain. Seuls surface et capacité voyageurs sont réels. On estime :
     * chambres = max(1, voyageurs / 2) (couchage double par chambre), 1 salle de
     * bain (pas de supplément), 1 seul niveau, extérieur/linge inconnus (null).</p>
     */
    private CleaningPricingEngine.CleaningInputs prospectCleaningInputs(QuoteRequestDto dto) {
        int guests = estimateGuests(dto.getGuestCapacity());
        int bedrooms = Math.max(1, guests / 2);
        Integer surface = dto.getSurface() > 0 ? dto.getSurface() : null;
        return new CleaningPricingEngine.CleaningInputs(
                bedrooms, 1, surface, 1, null, null, guests);
    }

    /**
     * Capacité voyageurs du formulaire ("1-2", "3-4", "5-6", "7+") → nombre :
     * borne haute de la tranche, "7+" → 8. Valeur inconnue/absente → 4 (profil médian).
     */
    private static int estimateGuests(String guestCapacity) {
        if (guestCapacity == null || guestCapacity.isBlank()) return 4;
        String trimmed = guestCapacity.trim();
        try {
            if (trimmed.endsWith("+")) {
                return Integer.parseInt(trimmed.substring(0, trimmed.length() - 1)) + 1;
            }
            int dash = trimmed.lastIndexOf('-');
            return Integer.parseInt(dash >= 0 ? trimmed.substring(dash + 1) : trimmed);
        } catch (NumberFormatException e) {
            return 4;
        }
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
