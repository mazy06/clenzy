package com.clenzy.integration.airbnb.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.integration.airbnb.dto.AirbnbListingDto;
import com.clenzy.integration.airbnb.model.AirbnbListingMapping;
import com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.AuditLogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service de gestion des annonces (listings) Airbnb.
 *
 * Gere le mapping entre les proprietes Clenzy et les listings Airbnb :
 * - Lier / delier une propriete a un listing
 * - Synchroniser les informations du listing
 * - Activer / desactiver la sync automatique
 */
@Service
public class AirbnbListingService {

    private static final Logger log = LoggerFactory.getLogger(AirbnbListingService.class);

    private final AirbnbListingMappingRepository listingMappingRepository;
    private final PropertyRepository propertyRepository;
    private final AirbnbWebhookService webhookService;
    private final AuditLogService auditLogService;

    public AirbnbListingService(AirbnbListingMappingRepository listingMappingRepository,
                                PropertyRepository propertyRepository,
                                AirbnbWebhookService webhookService,
                                AuditLogService auditLogService) {
        this.listingMappingRepository = listingMappingRepository;
        this.propertyRepository = propertyRepository;
        this.webhookService = webhookService;
        this.auditLogService = auditLogService;
    }

    /**
     * Consumer Kafka pour les evenements listing Airbnb.
     */
    @KafkaListener(topics = KafkaConfig.TOPIC_AIRBNB_LISTINGS, groupId = "clenzy-listings")
    public void handleListingEvent(Map<String, Object> event) {
        String eventType = (String) event.get("event_type");
        String eventId = (String) event.get("event_id");

        log.info("Traitement evenement listing Airbnb: {} ({})", eventType, eventId);

        try {
            Map<String, Object> data = (Map<String, Object>) event.get("data");
            if (data == null) {
                webhookService.markAsFailed(eventId, "Missing data field");
                return;
            }

            String airbnbListingId = (String) data.get("listing_id");

            switch (eventType) {
                case "listing.updated":
                    handleListingUpdated(airbnbListingId, data);
                    break;
                case "listing.deactivated":
                    handleListingDeactivated(airbnbListingId);
                    break;
                default:
                    log.warn("Type d'evenement listing inconnu: {}", eventType);
            }

            webhookService.markAsProcessed(eventId);

        } catch (Exception e) {
            log.error("Erreur traitement listing Airbnb {}: {}", eventId, e.getMessage());
            webhookService.markAsFailed(eventId, e.getMessage());
        }
    }

    /**
     * Lie une propriete Clenzy a un listing Airbnb.
     */
    @Transactional
    public AirbnbListingMapping linkPropertyToListing(Long propertyId, String airbnbListingId,
                                                      String airbnbListingTitle, String airbnbListingUrl) {
        // Verifier que la propriete existe
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new RuntimeException("Propriete introuvable: " + propertyId));

        // Verifier que le listing n'est pas deja lie
        if (listingMappingRepository.existsByAirbnbListingId(airbnbListingId)) {
            throw new RuntimeException("Le listing Airbnb " + airbnbListingId + " est deja lie a une propriete");
        }

        if (listingMappingRepository.existsByPropertyId(propertyId)) {
            throw new RuntimeException("La propriete " + propertyId + " est deja liee a un listing Airbnb");
        }

        // Creer le mapping
        AirbnbListingMapping mapping = new AirbnbListingMapping();
        mapping.setPropertyId(propertyId);
        mapping.setProperty(property);
        mapping.setAirbnbListingId(airbnbListingId);
        mapping.setAirbnbListingTitle(airbnbListingTitle);
        mapping.setAirbnbListingUrl(airbnbListingUrl);
        mapping.setSyncEnabled(true);
        mapping.setAutoCreateInterventions(true);

        AirbnbListingMapping saved = listingMappingRepository.save(mapping);

        // Mettre a jour la propriete avec l'ID Airbnb
        property.setAirbnbListingId(airbnbListingId);
        property.setAirbnbUrl(airbnbListingUrl);
        propertyRepository.save(property);

        auditLogService.logSync("AirbnbListingMapping", saved.getId().toString(),
                "Propriete " + propertyId + " liee au listing Airbnb " + airbnbListingId);

        log.info("Propriete {} liee au listing Airbnb {}", propertyId, airbnbListingId);
        return saved;
    }

    /**
     * Delie une propriete d'un listing Airbnb.
     */
    @Transactional
    public void unlinkProperty(Long propertyId) {
        AirbnbListingMapping mapping = listingMappingRepository.findByPropertyId(propertyId)
                .orElseThrow(() -> new RuntimeException("Aucun mapping Airbnb pour la propriete: " + propertyId));

        // Nettoyer la propriete
        propertyRepository.findById(propertyId).ifPresent(property -> {
            property.setAirbnbListingId(null);
            property.setAirbnbUrl(null);
            propertyRepository.save(property);
        });

        listingMappingRepository.delete(mapping);

        auditLogService.logSync("AirbnbListingMapping", mapping.getId().toString(),
                "Propriete " + propertyId + " deliee du listing Airbnb " + mapping.getAirbnbListingId());

        log.info("Propriete {} deliee du listing Airbnb {}", propertyId, mapping.getAirbnbListingId());
    }

    /**
     * Retourne tous les mappings actifs avec sync activee.
     */
    public List<AirbnbListingMapping> getActiveListings() {
        return listingMappingRepository.findBySyncEnabled(true);
    }

    /**
     * Retourne le mapping pour une propriete.
     */
    public Optional<AirbnbListingMapping> getMappingForProperty(Long propertyId) {
        return listingMappingRepository.findByPropertyId(propertyId);
    }

    /**
     * Active/desactive la sync pour un mapping.
     */
    @Transactional
    public AirbnbListingMapping toggleSync(Long propertyId, boolean enabled) {
        AirbnbListingMapping mapping = listingMappingRepository.findByPropertyId(propertyId)
                .orElseThrow(() -> new RuntimeException("Aucun mapping Airbnb pour la propriete: " + propertyId));

        mapping.setSyncEnabled(enabled);
        return listingMappingRepository.save(mapping);
    }

    /**
     * Active/desactive la creation automatique d'interventions.
     */
    @Transactional
    public AirbnbListingMapping toggleAutoInterventions(Long propertyId, boolean enabled) {
        AirbnbListingMapping mapping = listingMappingRepository.findByPropertyId(propertyId)
                .orElseThrow(() -> new RuntimeException("Aucun mapping Airbnb pour la propriete: " + propertyId));

        mapping.setAutoCreateInterventions(enabled);
        return listingMappingRepository.save(mapping);
    }

    // ---- Handlers Kafka ----

    private void handleListingUpdated(String airbnbListingId, Map<String, Object> data) {
        listingMappingRepository.findByAirbnbListingId(airbnbListingId).ifPresent(mapping -> {
            // Mettre a jour le titre cache
            String title = (String) data.get("title");
            if (title != null) {
                mapping.setAirbnbListingTitle(title);
            }

            mapping.setLastSyncAt(LocalDateTime.now());
            listingMappingRepository.save(mapping);

            log.info("Listing Airbnb {} mis a jour (propriete {})", airbnbListingId, mapping.getPropertyId());
        });
    }

    private void handleListingDeactivated(String airbnbListingId) {
        listingMappingRepository.findByAirbnbListingId(airbnbListingId).ifPresent(mapping -> {
            mapping.setSyncEnabled(false);
            listingMappingRepository.save(mapping);

            log.warn("Listing Airbnb {} desactive — sync desactivee pour propriete {}",
                    airbnbListingId, mapping.getPropertyId());
        });
    }
}
