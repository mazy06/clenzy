package com.clenzy.integration.channel;

import com.clenzy.integration.airbnb.model.AirbnbConnection;
import com.clenzy.integration.airbnb.repository.AirbnbConnectionRepository;
import com.clenzy.integration.airbnb.service.AirbnbOAuthService;
import com.clenzy.integration.airbnb.service.AirbnbTokenEncryptionService;
import com.clenzy.integration.channel.model.ChannelMapping;
import com.clenzy.integration.channel.repository.ChannelMappingRepository;
import com.clenzy.model.ChannelPromotion;
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

    public AirbnbChannelAdapter(AirbnbOAuthService airbnbOAuthService,
                                AirbnbConnectionRepository airbnbConnectionRepository,
                                AirbnbTokenEncryptionService tokenEncryptionService,
                                ChannelMappingRepository channelMappingRepository,
                                PriceEngine priceEngine,
                                RestTemplate restTemplate) {
        this.airbnbOAuthService = airbnbOAuthService;
        this.airbnbConnectionRepository = airbnbConnectionRepository;
        this.tokenEncryptionService = tokenEncryptionService;
        this.channelMappingRepository = channelMappingRepository;
        this.priceEngine = priceEngine;
        this.restTemplate = restTemplate;
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
                ChannelCapability.PROMOTIONS
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

            int pushed = 0;
            for (Map.Entry<LocalDate, BigDecimal> entry : prices.entrySet()) {
                if (entry.getValue() == null) continue;
                try {
                    pushSingleDayToAirbnb(listingId, entry.getKey(), entry.getValue(), accessToken);
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

    // ================================================================
    // Helpers
    // ================================================================

    private void pushSingleDayToAirbnb(String listingId, LocalDate date,
                                         BigDecimal price, String accessToken) {
        HttpHeaders headers = buildAirbnbHeaders(accessToken);
        Map<String, Object> payload = Map.of("daily_price", price.intValue(), "available", true);
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
}
