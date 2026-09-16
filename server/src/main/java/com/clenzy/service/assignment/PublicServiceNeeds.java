package com.clenzy.service.assignment;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.marketplace.service.*;
import com.clenzy.model.ServiceRequest;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;

/** Consultation publique authentifiée : aucune adresse, contact ni instruction d'accès. */
@Service
@Transactional
public class PublicServiceNeeds {
    private final ServiceAssignmentService assignments;
    private final ServiceRequestRepository needs;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceProviderZoneRepository zones;
    private final MarketplaceExposureService exposure;
    private final MarketplaceGeographicEligibility geography;
    private final MarketplaceQuoteService quotes;
    private final MarketplaceQuoteRequestRepository quoteRequests;
    private final ServiceCatalogReference catalog;
    private final JdbcTemplate db;
    private final ProviderDocumentaryService documents;
    private final com.clenzy.service.ProviderAvailabilityService availability;
    public PublicServiceNeeds(ServiceAssignmentService assignments, ServiceRequestRepository needs,
            MarketplaceProviderRepository providers, MarketplaceProviderZoneRepository zones,
            MarketplaceExposureService exposure, MarketplaceGeographicEligibility geography,
            MarketplaceQuoteService quotes, MarketplaceQuoteRequestRepository quoteRequests,
            ServiceCatalogReference catalog, JdbcTemplate db,ProviderDocumentaryService documents,com.clenzy.service.ProviderAvailabilityService availability) {
        this.assignments=assignments; this.needs=needs; this.providers=providers; this.zones=zones;
        this.exposure=exposure; this.geography=geography; this.quotes=quotes; this.quoteRequests=quoteRequests;
        this.catalog=catalog; this.db=db;
        this.documents=documents; this.availability=availability;
    }
    public record Need(Long id,String serviceItemCode,String city,String country,LocalDateTime date,Integer durationHours) {}
    public record Page(List<Need> items,Long nextCursor) {}
    public record Offer(BigDecimal amount,String currency,String message,LocalDate validUntil,Long teamId) {}

    @Transactional(readOnly=true)
    public Page list(Jwt jwt,Long cursor) {
        var provider=provider(jwt);
        List<Need> result=new ArrayList<>();
        var ids=db.queryForList("SELECT id FROM service_requests WHERE assignment_phase='PUBLIC' AND status='PENDING' AND converted_intervention_id IS NULL AND id>? ORDER BY id LIMIT 200",Long.class,cursor==null?0:cursor);
        Long last=null;
        for (Long id:ids) {
            last=id;
            var need=needs.findById(id).orElse(null);
            if (need!=null && eligible(provider,need)) {
                var property=need.getProperty();
                result.add(new Need(id,need.getServiceItemCode(),property==null?null:property.getCity(),
                    property==null?null:property.getCountryCode(),need.getDesiredDate(),need.getEstimatedDurationHours()));
                if (result.size()==20) break;
            }
        }
        boolean more=last!=null && (ids.size()==200 || !last.equals(ids.getLast()));
        return new Page(result,more?last:null);
    }

    public Long offer(Long id,Offer offer,Jwt jwt) {
        var provider=provider(jwt);
        var need=assignments.lock(id);
        if (!"PUBLIC".equals(need.getAssignmentPhase()) || !eligible(provider,need))
            throw new AccessDeniedException("Demande indisponible");
        geography.requireService(provider.getId(),need.getProperty()==null?null:need.getProperty().getId(),
            need.getOrganizationId(),null,need.getServiceItemCode(),need.getDesiredDate()==null?null:need.getDesiredDate().toLocalDate());
        var existing=db.queryForList("SELECT id FROM marketplace_quote_requests WHERE service_request_id=? AND marketplace_provider_id=? AND service_request_cycle=? AND status IN ('SENT','QUOTED','ACCEPTED') ORDER BY id",Long.class,id,provider.getId(),need.getAssignmentCycle());
        if (!existing.isEmpty()) return existing.getFirst();
        // Le message libre du client n'est pas republié : il peut contenir des accès privés.
        var request=quotes.requestForNeed(provider.getId(),need.getOrganizationId(),need.getUser().getId(),
            "Prestation : "+need.getServiceItemCode(),null,need.getProperty()==null?null:need.getProperty().getId(),
            null,need.getServiceItemCode(),need.getDesiredDate()==null?null:need.getDesiredDate().toLocalDate(),id);
        request.setRequestedStartTime(need.getDesiredDate()==null?null:need.getDesiredDate().toLocalTime());
        request.setServiceRequestCycle(need.getAssignmentCycle());
        if (need.getEstimatedDurationHours()!=null) request.setRequestedDurationMinutes(need.getEstimatedDurationHours()*60);
        quoteRequests.saveAndFlush(request);
        quotes.quote(request.getId(),provider.getId(),offer.amount(),offer.currency(),offer.message(),offer.validUntil(),offer.teamId());
        return request.getId();
    }
    private MarketplaceProvider provider(Jwt jwt) {
        return providers.findByUserId(assignments.currentUser(jwt))
            .filter(p -> p.getStatus()==ProviderStatus.ACTIVE)
            .orElseThrow(() -> new AccessDeniedException("Profil prestataire actif requis"));
    }
    private boolean eligible(MarketplaceProvider provider,ServiceRequest need) {
        if (need.getStatus()!=com.clenzy.model.RequestStatus.PENDING || need.getConvertedInterventionId()!=null) return false;
        if (Objects.equals(provider.getHomeOrganizationId(),need.getOrganizationId()) || !exposure.isVisibleTo(provider,need.getOrganizationId())) return false;
        if (provider.getUserId()==null) return false;
        var qualification=new com.clenzy.model.Intervention();
        var user=new com.clenzy.model.User(); user.setId(provider.getUserId());
        qualification.setAssignedUser(user); qualification.setProperty(need.getProperty());
        qualification.setServiceItemCode(need.getServiceItemCode()); qualification.setScheduledDate(need.getDesiredDate());
        if (!documents.assignmentEligible(qualification)) return false;
        if (!catalog.doesNotReserveSlot(need.getServiceItemCode())) {
            if (need.getDesiredDate()==null || !availability.isUserAvailable(provider.getUserId(),need.getDesiredDate(),
                    need.getDesiredDate().plusHours(need.getEstimatedDurationHours()!=null && need.getEstimatedDurationHours()>0?need.getEstimatedDurationHours():4))) return false;
            if (needs.previewAssignmentConflicts(need.getId(),null,"user",provider.getUserId(),need.getDesiredDate(),need.getEstimatedDurationHours())) return false;
        }
        try { MarketplaceOfferEligibility.requireOfferedService(provider,null,need.getServiceItemCode()); }
        catch (IllegalArgumentException unavailable) { return false; }
        if (catalog.isRemote(need.getServiceItemCode())) return true;
        var p=need.getProperty();
        return p!=null && zones.acceptsProperty(provider.getId(),p.getType()==null?null:p.getType().name())
            && p.getCountryCode()!=null
            && zones.covers(provider.getId(),p.getCountryCode(),p.getDepartment(),p.getArrondissement(),p.getCity());
    }
}
