package com.clenzy.integration.channel;

import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.ChannelCancellationPolicy;
import com.clenzy.model.ChannelContentMapping;
import com.clenzy.model.ChannelFee;
import com.clenzy.model.ChannelPromotion;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.service.PriceEngine;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Adaptateur ChannelConnector pour Airbnb.
 *
 * Le traitement INBOUND (Airbnb -> PMS) continue de passer par les
 * Kafka consumers existants (AirbnbCalendarService, AirbnbReservationService).
 * Ce adaptateur fournit :
 * - resolveMapping() pour le systeme generique
 * - pushCalendarUpdate() pour le fan-out OUTBOUND via Airbnb Calendar API
 * - pushPromotion() pour pousser des promotions vers Airbnb
 * - checkHealth() basee sur le statut de la connexion OAuth
 */
@Component
public class AirbnbChannelAdapter implements ChannelConnector {

    private static final Logger log = LoggerFactory.getLogger(AirbnbChannelAdapter.class);
    private static final String AIRBNB_API_BASE = "https://api.airbnb.com/v2";

    private final AirbnbOAuthService airbnbOAuthService;
    private final AirbnbConnectionRepository airbnbConnectionRepository;
    private final AirbnbTokenEncryptionService tokenEncryptionService;
    private final ChannelMappingRepository channelMappingRepository;
    private final PriceEngine priceEngine;
    private final RestTemplate restTemplate;
    private final BookingRestrictionRepository bookingRestrictionRepository;

    public AirbnbChannelAdapter(AirbnbOAuthService airbnbOAuthService,
                                AirbnbConnectionRepository airbnbConnectionRepository,
                                AirbnbTokenEncryptionService tokenEncryptionService,
                                ChannelMappingRepository channelMappingRepository,
                                PriceEngine priceEngine,
                                RestTemplate restTemplate,
                                BookingRestrictionRepository bookingRestrictionRepository) {
        this.airbnbOAuthService = airbnbOAuthService;
        this.airbnbConnectionRepository = airbnbConnectionRepository;
        this.tokenEncryptionService = tokenEncryptionService;
        this.channelMappingRepository = channelMappingRepository;
        this.priceEngine = priceEngine;
        this.restTemplate = restTemplate;
        this.bookingRestrictionRepository = bookingRestrictionRepository;
    }

    @Override
    public ChannelName getChannelName() {
        return ChannelName.AIRBNB;
    }

    @Override
    public Set<ChannelCapability> getCapabilities() {
        return EnumSet.of(
                ChannelCapability.INBOUND_CALENDAR,
                ChannelCapability.OUTBOUND_CALENDAR,
                ChannelCapability.INBOUND_RESERVATIONS,
                ChannelCapability.WEBHOOKS,
                ChannelCapability.OAUTH,
                ChannelCapability.MESSAGING,
                ChannelCapability.PROMOTIONS,
                ChannelCapability.OUTBOUND_RESTRICTIONS,
                ChannelCapability.CONTENT_SYNC,
                ChannelCapability.FEES,
                ChannelCapability.CANCELLATION_POLICIES
        );
    }

    @Override
    public Optional<ChannelMapping> resolveMapping(Long propertyId, Long orgId) {
        return channelMappingRepository.findByPropertyIdAndChannel(
                propertyId, ChannelName.AIRBNB, orgId);
    }

    @Override
    public void handleInboundEvent(String eventType, Map<String, Object> data, Long orgId) {
        log.debug("AirbnbChannelAdapter.handleInboundEvent: type={} (delegue aux Kafka consumers)",
                eventType);
    }

    /**
     * Push calendrier vers Airbnb (OUTBOUND).
     * Utilise l'API Airbnb Calendar pour pousser les prix et disponibilites.
     */
    @Override
    public SyncResult pushCalendarUpdate(Long propertyId, LocalDate from,
                                          LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + propertyId);
        }

        String listingId = mappingOpt.get().getExternalId();

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        try {
            Map<LocalDate, BigDecimal> prices = priceEngine.resolvePriceRange(propertyId, from, to, orgId);
            List<BookingRestriction> restrictions = bookingRestrictionRepository
                    .findApplicable(propertyId, from, to, orgId);

            int pushed = 0;
            for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                if (entry.getValue() == null) continue;
                try {
                    BookingRestriction restriction = findApplicableRestriction(restrictions, entry.getKey());
                    pushSingleDayToAirbnb(listingId, entry.getKey(), entry.getValue(),
                            restriction, accessToken);
                    pushed++;
                } catch (Exception e) {
                    log.warn("Failed to push price for listing {} date {}: {}",
                            listingId, entry.getKey(), e.getMessage());
                }
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("Pushed {} days of pricing to Airbnb listing {} for property {}",
                    pushed, listingId, propertyId);
            return SyncResult.success(pushed, duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push calendrier Airbnb pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    /**
     * Pousse une promotion vers Airbnb.
     */
    @Override
    public SyncResult pushPromotion(ChannelPromotion promo, Long orgId) {
        long startTime = System.currentTimeMillis();

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        Optional<ChannelMapping> mappingOpt = resolveMapping(promo.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + promo.getPropertyId());
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            HttpHeaders headers = buildAirbnbHeaders(accessToken);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("listing_id", listingId);
            payload.put("promotion_type", mapPromotionType(promo));
            if (promo.getDiscountPercentage() != null) {
                payload.put("discount_percentage", promo.getDiscountPercentage());
            }
            if (promo.getStartDate() != null) {
                payload.put("start_date", promo.getStartDate().toString());
            }
            if (promo.getEndDate() != null) {
                payload.put("end_date", promo.getEndDate().toString());
            }
            payload.put("enabled", promo.getEnabled());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            String url = AIRBNB_API_BASE + "/listings/" + listingId + "/promotions";

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST, request, String.class
            );

            long duration = System.currentTimeMillis() - startTime;
            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Promotion {} pushed to Airbnb listing {}", promo.getId(), listingId);
                return SyncResult.success(1, duration);
            }
            return SyncResult.failed("Airbnb returned " + response.getStatusCode(), duration);

        } catch (RestClientException e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Airbnb promotion push error for listing {}: {}", listingId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    @Override
    public HealthStatus checkHealth(Long connectionId) {
        Optional<AirbnbConnection> connOpt = airbnbConnectionRepository.findById(connectionId);
        if (connOpt.isEmpty()) {
            return HealthStatus.UNKNOWN;
        }

        AirbnbConnection conn = connOpt.get();
        if (!conn.isActive()) {
            return HealthStatus.UNHEALTHY;
        }
        if (conn.isTokenExpired()) {
            return HealthStatus.DEGRADED;
        }
        return HealthStatus.HEALTHY;
    }

    // ── Restrictions ────────────────────────────────────────────────────────

    /**
     * Pousse les restrictions de sejour vers Airbnb (OUTBOUND).
     * Utilise PUT /v2/calendar/{listingId}/{date} avec min_nights, max_nights, CTA, CTD.
     */
    @Override
    public SyncResult pushRestrictions(Long propertyId, LocalDate from,
                                         LocalDate to, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + propertyId);
        }

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            List<BookingRestriction> restrictions = bookingRestrictionRepository
                    .findApplicable(propertyId, from, to, orgId);

            int pushed = 0;
            LocalDate current = from;
            while (current.isBefore(to)) {
                BookingRestriction restriction = findApplicableRestriction(restrictions, current);
                try {
                    HttpHeaders headers = buildAirbnbHeaders(accessToken);
                    Map<String, Object> payload = new LinkedHashMap<>();
                    if (restriction != null) {
                        if (restriction.getMinStay() != null) payload.put("min_nights", restriction.getMinStay());
                        if (restriction.getMaxStay() != null) payload.put("max_nights", restriction.getMaxStay());
                        payload.put("closed_to_arrival", Boolean.TRUE.equals(restriction.getClosedToArrival()));
                        payload.put("closed_to_departure", Boolean.TRUE.equals(restriction.getClosedToDeparture()));
                    } else {
                        // Reset to defaults when no restriction applies
                        payload.put("min_nights", 1);
                        payload.put("max_nights", 365);
                        payload.put("closed_to_arrival", false);
                        payload.put("closed_to_departure", false);
                    }
                    HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
                    String url = AIRBNB_API_BASE + "/calendar/" + listingId + "/" + current;
                    restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
                    pushed++;
                } catch (Exception e) {
                    log.warn("Failed to push restriction for listing {} date {}: {}",
                            listingId, current, e.getMessage());
                }
                current = current.plusDays(1);
            }

            long duration = System.currentTimeMillis() - startTime;
            log.info("Pushed {} days of restrictions to Airbnb listing {} for property {}",
                    pushed, listingId, propertyId);
            return SyncResult.success(pushed, duration);

        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push restrictions Airbnb pour propriete {}: {}", propertyId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    // ── Content ─────────────────────────────────────────────────────────────

    /**
     * Pousse le contenu (description, photos, amenities) vers Airbnb.
     * Utilise PUT /v2/listings/{listingId}.
     */
    @Override
    public SyncResult pushContent(ChannelContentMapping content, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(content.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + content.getPropertyId());
        }

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            HttpHeaders headers = buildAirbnbHeaders(accessToken);
            Map<String, Object> payload = new LinkedHashMap<>();
            if (content.getTitle() != null) payload.put("name", content.getTitle());
            if (content.getDescription() != null) payload.put("description", content.getDescription());
            if (content.getAmenities() != null && !content.getAmenities().isEmpty()) {
                payload.put("listing_amenities", content.getAmenities());
            }
            if (content.getPhotoUrls() != null && !content.getPhotoUrls().isEmpty()) {
                payload.put("photos", content.getPhotoUrls().stream()
                        .map(url -> Map.of("url", url))
                        .toList());
            }
            if (content.getPropertyType() != null) payload.put("property_type_group", content.getPropertyType());
            if (content.getBedrooms() != null) payload.put("bedrooms", content.getBedrooms());
            if (content.getBathrooms() != null) payload.put("bathrooms", content.getBathrooms());
            if (content.getMaxGuests() != null) payload.put("person_capacity", content.getMaxGuests());

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            String url = AIRBNB_API_BASE + "/listings/" + listingId;

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
            long duration = System.currentTimeMillis() - startTime;

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Content pushed to Airbnb listing {} for property {}", listingId, content.getPropertyId());
                return SyncResult.success(1, duration);
            }
            return SyncResult.failed("Airbnb returned " + response.getStatusCode(), duration);

        } catch (RestClientException e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push content Airbnb pour listing {}: {}", listingId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    /**
     * Recupere le contenu depuis Airbnb pour reconciliation.
     * Utilise GET /v2/listings/{listingId}.
     */
    @Override
    public SyncResult pullContent(Long propertyId, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + propertyId);
        }

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            HttpHeaders headers = buildAirbnbHeaders(accessToken);
            HttpEntity<Void> request = new HttpEntity<>(headers);
            String url = AIRBNB_API_BASE + "/listings/" + listingId;

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.GET, request, String.class);
            long duration = System.currentTimeMillis() - startTime;

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Content pulled from Airbnb listing {} for property {}", listingId, propertyId);
                return SyncResult.success(1, duration);
            }
            return SyncResult.failed("Airbnb returned " + response.getStatusCode(), duration);

        } catch (RestClientException e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur pull content Airbnb pour listing {}: {}", listingId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    // ── Fees ─────────────────────────────────────────────────────────────────

    /**
     * Pousse les frais supplementaires vers Airbnb.
     * Utilise PUT /v2/listings/{listingId}/pricing_settings.
     */
    @Override
    public SyncResult pushFees(java.util.List<ChannelFee> fees, Long orgId) {
        if (fees.isEmpty()) {
            return SyncResult.skipped("Aucun fee a pousser vers Airbnb");
        }

        long startTime = System.currentTimeMillis();
        Long propertyId = fees.getFirst().getPropertyId();

        Optional<ChannelMapping> mappingOpt = resolveMapping(propertyId, orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + propertyId);
        }

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            HttpHeaders headers = buildAirbnbHeaders(accessToken);

            List<Map<String, Object>> feePayloads = fees.stream()
                    .filter(ChannelFee::getEnabled)
                    .map(fee -> {
                        Map<String, Object> f = new LinkedHashMap<>();
                        f.put("fee_type", fee.getFeeType().name().toLowerCase());
                        f.put("amount", fee.getAmount());
                        f.put("currency", fee.getCurrency());
                        f.put("charge_type", fee.getChargeType().name().toLowerCase());
                        f.put("is_mandatory", fee.getIsMandatory());
                        return f;
                    })
                    .toList();

            Map<String, Object> payload = Map.of("fees", feePayloads);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            String url = AIRBNB_API_BASE + "/listings/" + listingId + "/pricing_settings";

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
            long duration = System.currentTimeMillis() - startTime;

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Pushed {} fees to Airbnb listing {} for property {}", feePayloads.size(), listingId, propertyId);
                return SyncResult.success(feePayloads.size(), duration);
            }
            return SyncResult.failed("Airbnb returned " + response.getStatusCode(), duration);

        } catch (RestClientException e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push fees Airbnb pour listing {}: {}", listingId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    // ── Cancellation Policies ───────────────────────────────────────────────

    /**
     * Pousse une politique d'annulation vers Airbnb.
     * Utilise PUT /v2/listings/{listingId} avec le champ cancellation_policy.
     * Airbnb supporte : flexible, moderate, firm, strict, super_strict_30, super_strict_60.
     */
    @Override
    public SyncResult pushCancellationPolicy(ChannelCancellationPolicy policy, Long orgId) {
        long startTime = System.currentTimeMillis();

        Optional<ChannelMapping> mappingOpt = resolveMapping(policy.getPropertyId(), orgId);
        if (mappingOpt.isEmpty()) {
            return SyncResult.skipped("Aucun mapping Airbnb pour propriete " + policy.getPropertyId());
        }

        String accessToken = resolveDecryptedAccessToken();
        if (accessToken == null) {
            return SyncResult.failed("Pas de token OAuth Airbnb valide");
        }

        String listingId = mappingOpt.get().getExternalId();

        try {
            HttpHeaders headers = buildAirbnbHeaders(accessToken);
            Map<String, Object> payload = Map.of(
                    "cancellation_policy", mapCancellationPolicyType(policy)
            );

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
            String url = AIRBNB_API_BASE + "/listings/" + listingId;

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
            long duration = System.currentTimeMillis() - startTime;

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Cancellation policy pushed to Airbnb listing {} for property {}",
                        listingId, policy.getPropertyId());
                return SyncResult.success(1, duration);
            }
            return SyncResult.failed("Airbnb returned " + response.getStatusCode(), duration);

        } catch (RestClientException e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("Erreur push cancellation policy Airbnb pour listing {}: {}", listingId, e.getMessage());
            return SyncResult.failed("Erreur API Airbnb: " + e.getMessage(), duration);
        }
    }

    // ================================================================
    // Helpers
    // ================================================================

    private void pushSingleDayToAirbnb(String listingId, LocalDate date,
                                         BigDecimal price, BookingRestriction restriction,
                                         String accessToken) {
        HttpHeaders headers = buildAirbnbHeaders(accessToken);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("daily_price", price.intValue());
        payload.put("available", true);
        if (restriction != null) {
            if (restriction.getMinStay() != null) payload.put("min_nights", restriction.getMinStay());
            if (restriction.getMaxStay() != null) payload.put("max_nights", restriction.getMaxStay());
            payload.put("closed_to_arrival", Boolean.TRUE.equals(restriction.getClosedToArrival()));
            payload.put("closed_to_departure", Boolean.TRUE.equals(restriction.getClosedToDeparture()));
        }
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);
        String url = AIRBNB_API_BASE + "/calendar/" + listingId + "/" + date;
        restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
    }

    private HttpHeaders buildAirbnbHeaders(String accessToken) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);
        return headers;
    }

    private String resolveDecryptedAccessToken() {
        List<AirbnbConnection> connections = airbnbConnectionRepository
                .findByStatus(AirbnbConnection.AirbnbConnectionStatus.ACTIVE);
        if (connections.isEmpty()) return null;
        AirbnbConnection conn = connections.getFirst();
        if (conn.getAccessTokenEncrypted() == null) return null;
        try {
            return tokenEncryptionService.decrypt(conn.getAccessTokenEncrypted());
        } catch (Exception e) {
            log.error("Failed to decrypt Airbnb access token: {}", e.getMessage());
            return null;
        }
    }

    private String mapPromotionType(ChannelPromotion promo) {
        return switch (promo.getPromotionType()) {
            case EARLY_BIRD_OTA -> "early_bird";
            case FLASH_SALE -> "flash_sale";
            case LONG_STAY_OTA -> "weekly_monthly";
            case MOBILE_RATE -> "mobile_discount";
            default -> "custom";
        };
    }

    /**
     * Trouve la restriction applicable pour une date donnee.
     * Retourne la premiere restriction applicable (ordonnee par priorite DESC).
     */
    private BookingRestriction findApplicableRestriction(List<BookingRestriction> restrictions, LocalDate date) {
        return restrictions.stream()
                .filter(r -> r.appliesTo(date))
                .findFirst()
                .orElse(null);
    }

    /**
     * Mappe le type de politique d'annulation vers le format Airbnb.
     */
    private String mapCancellationPolicyType(ChannelCancellationPolicy policy) {
        return switch (policy.getPolicyType()) {
            case FLEXIBLE -> "flexible";
            case MODERATE -> "moderate";
            case FIRM -> "firm";
            case STRICT -> "strict";
            case SUPER_STRICT -> "super_strict_60";
            case NON_REFUNDABLE -> "strict";
            case CUSTOM -> "moderate";
        };
    }
}
