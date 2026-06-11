package com.clenzy.service.tags;

import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

import static com.clenzy.service.tags.TagFormatting.formatDate;
import static com.clenzy.service.tags.TagFormatting.formatDateTime;
import static com.clenzy.service.tags.TagFormatting.formatMoney;
import static com.clenzy.service.tags.TagFormatting.safeStr;

/**
 * Tags d'une demande de service : demande.*, property.*, client.*.
 */
@Component
public class ServiceRequestTagResolver implements ReferenceTagResolver {

    private final ServiceRequestRepository serviceRequestRepository;
    private final EntityTagBuilders builders;

    public ServiceRequestTagResolver(ServiceRequestRepository serviceRequestRepository,
                                     EntityTagBuilders builders) {
        this.serviceRequestRepository = serviceRequestRepository;
        this.builders = builders;
    }

    @Override
    public String referenceType() {
        return "service_request";
    }

    @Override
    public void resolve(Long serviceRequestId, Map<String, Object> context) {
        if (serviceRequestId == null) return;

        serviceRequestRepository.findById(serviceRequestId).ifPresent(sr -> {
            context.put("demande", serviceRequestTags(sr));

            if (sr.getProperty() != null) {
                context.put("property", builders.propertyTags(sr.getProperty()));
            }

            if (sr.getUser() != null) {
                context.put("client", builders.clientTags(sr.getUser()));
            }
        });
    }

    private Map<String, Object> serviceRequestTags(ServiceRequest sr) {
        Map<String, Object> tags = new LinkedHashMap<>();
        tags.put("id", String.valueOf(sr.getId()));
        tags.put("titre", safeStr(sr.getTitle()));
        tags.put("description", safeStr(sr.getDescription()));
        tags.put("type_service", sr.getServiceType() != null ? sr.getServiceType().name() : "");
        tags.put("priorite", sr.getPriority() != null ? sr.getPriority().name() : "");
        tags.put("statut", sr.getStatus() != null ? sr.getStatus().name() : "");
        tags.put("date_souhaitee", formatDate(sr.getDesiredDate()));
        tags.put("creneau", safeStr(sr.getPreferredTimeSlot()));
        tags.put("cout_estime", formatMoney(sr.getEstimatedCost()));
        tags.put("cout_reel", formatMoney(sr.getActualCost()));
        tags.put("instructions", safeStr(sr.getSpecialInstructions()));
        tags.put("date_creation", formatDateTime(sr.getCreatedAt()));
        return tags;
    }
}
