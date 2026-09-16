package com.clenzy.marketplace.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceRecurrenceRepository;
import com.clenzy.model.ServiceType;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.ServiceRequestService;
import com.clenzy.tenant.TenantContext;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Objects;

@Service
@Transactional
public class MarketplaceRecurrenceService {
    private final MarketplaceQuoteMissionFactory access;
    private final MarketplaceRecurrenceRepository plans;
    private final PropertyRepository properties;
    private final ServiceRequestService requests;
    private final TenantContext tenant;
    private final Clock clock;
    private final com.clenzy.repository.InterventionRepository interventions;
    private final com.clenzy.marketplace.repository.MarketplaceServiceItemRepository items;

    public MarketplaceRecurrenceService(MarketplaceQuoteMissionFactory access, MarketplaceRecurrenceRepository plans,
            PropertyRepository properties, ServiceRequestService requests, TenantContext tenant, Clock clock,
            com.clenzy.repository.InterventionRepository interventions,
            com.clenzy.marketplace.repository.MarketplaceServiceItemRepository items) {
        this.access = access; this.plans = plans; this.properties = properties;
        this.requests = requests; this.tenant = tenant; this.clock = clock;
        this.interventions = interventions;
        this.items = items;
    }

    public record Command(Long version, boolean enabled, LocalDate firstDate, String intervalUnit,
                          int intervalCount, int leadDays) {}
    public record View(long version, boolean enabled, LocalDate firstDate, String intervalUnit,
                       int intervalCount, int leadDays, LocalDate nextDate, Long lastRequestId) {}

    public View get(Long id, Jwt jwt) {
        var quote = access.lock(id, tenant.getRequiredOrganizationId());
        access.assertCanDecide(quote, tenant.getRequiredOrganizationId(), jwt);
        return plans.findById(id).map(this::view).orElse(null);
    }

    public View configure(Long id, Command command, Jwt jwt) {
        var quote = access.lock(id, tenant.getRequiredOrganizationId());
        access.assertCanDecide(quote, tenant.getRequiredOrganizationId(), jwt);
        if (quote.getStatus() != QuoteRequestStatus.ACCEPTED || quote.getInterventionId() == null)
            throw new IllegalStateException("Un devis accepté avec une intervention est requis");
        var plan = plans.findById(id).orElse(null);
        if ((plan == null && command.version() != null)
                || (plan != null && !Objects.equals(command.version(), plan.getVersion())))
            throw new IllegalStateException("L’échéancier a changé ; rechargez-le avant de modifier");
        // Une suspension conserve l'ancre et l'historique, même si l'échéance est passée.
        if (plan != null && !command.enabled()) {
            plan.setEnabled(false);
            return view(plans.saveAndFlush(plan));
        }
        if (quote.getServiceItemCode() != null && items.findByCode(quote.getServiceItemCode())
                .map(item -> item.getRecurrence() == ServiceRecurrence.PER_STAY).orElse(false))
            throw new IllegalArgumentException("Cette prestation dépend des séjours ; utilisez l’automatisation des réservations");
        var property = properties.findByIdWithOwner(quote.getPropertyId(), tenant.getRequiredOrganizationId())
                .orElseThrow(() -> new AccessDeniedException("Logement indisponible"));
        if (property.getOwner() == null) throw new IllegalStateException("Propriétaire introuvable");
        if (command.firstDate() == null || !command.firstDate().isAfter(today(property))
                || !("DAYS".equals(command.intervalUnit()) || "MONTHS".equals(command.intervalUnit()))
                || command.intervalCount() < 1 || command.intervalCount() > 3650
                || ("MONTHS".equals(command.intervalUnit()) && command.intervalCount() > 120)
                || command.leadDays() < 0 || command.leadDays() > 90)
            throw new IllegalArgumentException("Indiquez une date future et un intervalle valide");
        if (plan == null) {
            plan = new MarketplaceRecurrence(); plan.setQuoteRequestId(id);
            plan.setOrganizationId(tenant.getRequiredOrganizationId());
        }
        plan.setConsentOwnerId(property.getOwner().getId());
        plan.configure(command.firstDate(), command.intervalUnit(), command.intervalCount(), command.leadDays());
        plan.setEnabled(command.enabled());
        return view(plans.saveAndFlush(plan));
    }

    /** Verrou commun configuration/génération ; demande et avancement commitent ensemble. */
    public void generate(Long id) {
        Long org = tenant.getRequiredOrganizationId();
        var quote = access.lock(id, org);
        var plan = plans.findById(id).orElse(null);
        if (plan == null || !plan.isEnabled()) return;
        if (!org.equals(plan.getOrganizationId())) throw new AccessDeniedException("Organisation incorrecte");
        if (quote.getStatus() != QuoteRequestStatus.ACCEPTED) {
            plan.setEnabled(false); return;
        }
        var property = properties.findByIdWithOwner(quote.getPropertyId(), org).orElse(null);
        if (property == null || property.getOwner() == null
                || !Objects.equals(property.getOwner().getId(), plan.getConsentOwnerId())) {
            plan.setEnabled(false); return;
        }
        if (plan.getNextDate().minusDays(plan.getLeadDays()).isAfter(today(property))) return;
        var source = interventions.findById(quote.getInterventionId()).orElse(null);
        if (source == null || !org.equals(source.getOrganizationId())
                || source.getStatus() == com.clenzy.model.InterventionStatus.CANCELLED) {
            plan.setEnabled(false); return;
        }
        var dto = new ServiceRequestDto();
        String title = quote.getTitle();
        dto.title = title.length() < 5 ? "Prestation " + title : title.substring(0, Math.min(title.length(), 100));
        String description = quote.getMessage() == null ? "" : quote.getMessage();
        dto.description = "Échéance du " + plan.getNextDate() + " issue du devis n° " + id
                + ". Nouveau chiffrage et nouvelle attribution à valider.\n"
                + description.substring(0, Math.min(description.length(), 800));
        dto.propertyId = property.getId();
        dto.userId = property.getOwner().getId();
        dto.desiredDate = plan.getNextDate().atTime(9, 0);
        try { dto.serviceType = ServiceType.valueOf(source.getType()); }
        catch (IllegalArgumentException | NullPointerException unsupportedType) { dto.serviceType = ServiceType.OTHER; }
        plan.generated(requests.createRecurringRequest(dto, id));
    }

    private View view(MarketplaceRecurrence plan) {
        return new View(plan.getVersion(), plan.isEnabled(), plan.getAnchorDate(), plan.getIntervalUnit(),
                plan.getIntervalCount(), plan.getLeadDays(), plan.getNextDate(), plan.getLastRequestId());
    }
    private LocalDate today(com.clenzy.model.Property property) {
        // Les logements historiques sans fuseau utilisent le défaut PMS Europe/Paris.
        String zone = property.getTimezone();
        return LocalDate.now(clock.withZone(java.time.ZoneId.of(zone == null || zone.isBlank() ? "Europe/Paris" : zone)));
    }
}
