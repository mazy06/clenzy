package com.clenzy.service;

import com.clenzy.config.KafkaConfig;
import com.clenzy.dto.CreateBookingRestrictionRequest;
import com.clenzy.model.BookingRestriction;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.PropertyRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Service CRUD pour les restrictions de reservation.
 * Publie un event outbox a chaque mutation pour declencher
 * la synchronisation vers les channels connectes.
 */
@Service
@Transactional(readOnly = true)
public class BookingRestrictionService {

    private static final Logger log = LoggerFactory.getLogger(BookingRestrictionService.class);

    private final BookingRestrictionRepository restrictionRepository;
    private final PropertyRepository propertyRepository;
    private final OutboxPublisher outboxPublisher;
    private final ObjectMapper objectMapper;

    public BookingRestrictionService(BookingRestrictionRepository restrictionRepository,
                                      PropertyRepository propertyRepository,
                                      OutboxPublisher outboxPublisher,
                                      ObjectMapper objectMapper) {
        this.restrictionRepository = restrictionRepository;
        this.propertyRepository = propertyRepository;
        this.outboxPublisher = outboxPublisher;
        this.objectMapper = objectMapper;
    }

    public List<BookingRestriction> getByProperty(Long propertyId, Long orgId) {
        return restrictionRepository.findByPropertyId(propertyId, orgId);
    }

    public BookingRestriction getById(Long id, Long orgId) {
        return restrictionRepository.findById(id)
            .filter(r -> r.getOrganizationId().equals(orgId))
            .orElseThrow(() -> new IllegalArgumentException("Restriction not found: " + id));
    }

    @Transactional
    public BookingRestriction create(CreateBookingRestrictionRequest request, Long orgId) {
        Property property = propertyRepository.findById(request.propertyId())
            .orElseThrow(() -> new IllegalArgumentException("Property not found: " + request.propertyId()));

        BookingRestriction restriction = new BookingRestriction(property, request.startDate(), request.endDate(), orgId);
        applyFields(restriction, request);

        BookingRestriction saved = restrictionRepository.save(restriction);
        publishRestrictionEvent("RESTRICTION_CREATED", saved);
        log.info("Restriction {} created for property {}", saved.getId(), request.propertyId());
        return saved;
    }

    @Transactional
    public BookingRestriction update(Long id, Long orgId, CreateBookingRestrictionRequest request) {
        BookingRestriction restriction = getById(id, orgId);
        restriction.setStartDate(request.startDate());
        restriction.setEndDate(request.endDate());
        applyFields(restriction, request);

        BookingRestriction saved = restrictionRepository.save(restriction);
        publishRestrictionEvent("RESTRICTION_UPDATED", saved);
        log.info("Restriction {} updated for property {}", saved.getId(), request.propertyId());
        return saved;
    }

    @Transactional
    public void delete(Long id, Long orgId) {
        BookingRestriction restriction = getById(id, orgId);
        Long propertyId = restriction.getProperty().getId();
        restrictionRepository.delete(restriction);
        // Publish event so channels clear their restrictions for this range
        publishRestrictionEvent("RESTRICTION_DELETED", restriction);
        log.info("Restriction {} deleted for property {}", id, propertyId);
    }

    // ---- Helpers ----

    private void applyFields(BookingRestriction r, CreateBookingRestrictionRequest req) {
        r.setMinStay(req.minStay());
        r.setMaxStay(req.maxStay());
        r.setClosedToArrival(req.closedToArrival() != null ? req.closedToArrival() : false);
        r.setClosedToDeparture(req.closedToDeparture() != null ? req.closedToDeparture() : false);
        r.setGapDays(req.gapDays() != null ? req.gapDays() : 0);
        r.setAdvanceNoticeDays(req.advanceNoticeDays());
        r.setDaysOfWeek(req.daysOfWeek());
        r.setPriority(req.priority() != null ? req.priority() : 0);
    }

    private void publishRestrictionEvent(String eventType, BookingRestriction restriction) {
        try {
            String payload = objectMapper.writeValueAsString(Map.of(
                "action", "RESTRICTION_UPDATED",
                "propertyId", restriction.getProperty().getId(),
                "orgId", restriction.getOrganizationId(),
                "from", restriction.getStartDate().toString(),
                "to", restriction.getEndDate().toString(),
                "restrictionId", restriction.getId()
            ));
            outboxPublisher.publishCalendarEvent(
                eventType,
                restriction.getProperty().getId(),
                restriction.getOrganizationId(),
                payload
            );
        } catch (Exception e) {
            log.error("Failed to publish restriction event: {}", e.getMessage());
        }
    }
}
