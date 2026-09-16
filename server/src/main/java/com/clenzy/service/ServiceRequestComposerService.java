package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.model.*;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.catalog.ServiceCatalogReference;
import com.clenzy.service.pricing.CleaningPricingEngine;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/** Baitly: one catalogue selection produces one ordinary PMS request. */
@Service
public class ServiceRequestComposerService {
    private final ServiceCatalogReference catalog;
    private final PropertyService properties;
    private final CleaningPricingEngine cleaning;
    private final ServiceRequestService requests;
    private final UserRepository users;

    public ServiceRequestComposerService(ServiceCatalogReference catalog, PropertyService properties,
            CleaningPricingEngine cleaning, ServiceRequestService requests, UserRepository users) {
        this.catalog = catalog; this.properties = properties; this.cleaning = cleaning;
        this.requests = requests; this.users = users;
    }

    public record Selection(String serviceItemCode, String instructions, Integer durationHours) {}
    public record Draft(UUID submissionId, Long propertyId, LocalDateTime desiredDate, Priority priority,
                        String instructions, List<Selection> selections) {}
    public record Estimate(String serviceItemCode, String source, String currency,
                           BigDecimal min, BigDecimal max, Integer durationMinutes) {}

    private List<ServiceCatalogReference.Item> validate(Draft draft) {
        if (draft == null || draft.selections() == null || draft.selections().isEmpty()
                || draft.selections().size() > 20)
            throw new IllegalArgumentException("Sélectionnez entre 1 et 20 prestations");
        if (draft.instructions() != null && draft.instructions().length() > 2000)
            throw new IllegalArgumentException("Consignes trop longues");
        var available = catalog.items();
        var seen = new HashSet<String>();
        var selected = new ArrayList<ServiceCatalogReference.Item>();
        for (var selection : draft.selections()) {
            if (selection == null || !seen.add(selection.serviceItemCode()))
                throw new IllegalArgumentException("Prestation dupliquée ou invalide");
            var item = available.stream().filter(i -> i.code().equals(selection.serviceItemCode()))
                    .findFirst().orElseThrow(() -> new IllegalArgumentException("Prestation inconnue ou inactive"));
            if (selection.durationHours() != null && (selection.durationHours() < 1 || selection.durationHours() > 168))
                throw new IllegalArgumentException("Durée prévue invalide");
            if (selection.instructions() != null && selection.instructions().length() > 2000)
                throw new IllegalArgumentException("Consignes trop longues");
            selected.add(item);
        }
        return selected;
    }

    private Property property(Draft draft, List<ServiceCatalogReference.Item> items) {
        Property property = draft.propertyId() == null ? null : properties.getSecuredPropertyEntity(draft.propertyId());
        if (property == null && items.stream().anyMatch(ServiceCatalogReference.Item::propertyRequired))
            throw new IllegalArgumentException("Logement requis pour les prestations sélectionnées");
        return property;
    }

    @Transactional(readOnly = true)
    public List<Estimate> estimate(Draft draft) {
        var items = validate(draft);
        var property = property(draft, items);
        return items.stream().map(item -> estimate(item, property, draft.desiredDate())).toList();
    }

    private Estimate estimate(ServiceCatalogReference.Item item, Property property, LocalDateTime date) {
        // Only the three services covered by the existing engine have a platform price guide.
        // Neither this guide nor a property's cleaning override is a provider's published tariff.
        if (property != null && Set.of("CLEANING", "EXPRESS_CLEANING", "DEEP_CLEANING").contains(item.legacyType())) {
            var quote = cleaning.quote(property, item.legacyType(), date == null ? null : date.toLocalDate());
            return new Estimate(item.code(), "PLATFORM_GUIDE", "EUR", quote.min(), quote.max(), quote.durationMinutes());
        }
        return new Estimate(item.code(), "ON_QUOTE", null, null, null, null);
    }

    @Transactional
    public List<ServiceRequestDto> create(Draft draft, String subject) {
        var items = validate(draft);
        if (draft.submissionId() == null || draft.desiredDate() == null || draft.priority() == null)
            throw new IllegalArgumentException("Date et priorité requises");
        var property = property(draft, items);
        var user = users.findByKeycloakId(subject).orElseThrow(() -> new AccessDeniedException("Utilisateur inconnu"));
        // Validate every selection before any write. All requests use the existing workflow,
        // in the same transaction: no partial batch if one creation fails.
        var result = new ArrayList<ServiceRequestDto>();
        for (int i = 0; i < items.size(); i++) {
            var item = items.get(i);
            var selection = draft.selections().get(i);
            var estimate = estimate(item, property, draft.desiredDate());
            var dto = new ServiceRequestDto();
            String title = item.labelFr() + (property == null ? "" : " · " + property.getName());
            dto.title = title.substring(0, Math.min(title.length(), 100));
            dto.description = java.util.stream.Stream.of(draft.instructions(), selection.instructions())
                    .filter(s -> s != null && !s.isBlank()).collect(java.util.stream.Collectors.joining("\n\n"));
            dto.serviceItemCode = item.code();
            dto.serviceType = ServiceType.valueOf(item.legacyType());
            dto.propertyId = property == null ? null : property.getId();
            dto.userId = user.getId();
            dto.priority = draft.priority();
            dto.status = RequestStatus.PENDING;
            dto.desiredDate = draft.desiredDate();
            dto.estimatedDurationHours = selection.durationHours() != null ? selection.durationHours()
                    : estimate.durationMinutes() == null ? 1 : Math.max(1, (int) Math.ceil(estimate.durationMinutes() / 60.0));
            // Guidance is not an agreed price. The ordinary attribution/quote workflow
            // resolves the provider's canonical tariff and records the financial agreement.
            result.add(requests.createComposedRequest(dto, draft.submissionId()));
        }
        return result;
    }
}
