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
        var screening=new Screening(provider);
        // Les besoins de l'organisation porteuse ne sont jamais proposés à sa propre fiche :
        // les écarter en SQL évite de les charger pour les rejeter ensuite.
        var ids=db.queryForList("""
            SELECT id FROM service_requests
             WHERE assignment_phase='PUBLIC' AND status='PENDING' AND converted_intervention_id IS NULL
               AND organization_id IS DISTINCT FROM ? AND id>? ORDER BY id LIMIT 200
            """,Long.class,provider.getHomeOrganizationId(),cursor==null?0:cursor);
        if (ids.isEmpty()) return new Page(List.of(),null);
        // Une seule lecture pour tout le lot : les fiches ne sont plus relues une par une.
        Map<Long,ServiceRequest> batch=new HashMap<>();
        needs.findAllById(ids).forEach(need -> batch.put(need.getId(),need));
        List<Need> result=new ArrayList<>();
        Long last=null;
        for (Long id:ids) {
            last=id;
            var need=batch.get(id);
            if (need!=null && screening.eligible(need)) {
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
        if (!"PUBLIC".equals(need.getAssignmentPhase()) || !new Screening(provider).eligible(need))
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
    /**
     * Dépistage d'une fiche sur un lot de besoins.
     *
     * <p>Les vérifications qui ne dépendent pas du besoin — exposition, offre,
     * mode d'exécution, zone, preuves documentaires — sont partagées par tout le
     * lot. Seules la disponibilité et les conflits de créneau restent propres à
     * chaque besoin. L'ordre va du moins cher au plus cher : une fiche écartée
     * en mémoire ne coûte aucune requête.</p>
     */
    private final class Screening {
        private final MarketplaceProvider provider;
        private final MarketplaceExposureService.Visibility visibility;
        private final Map<String,Boolean> offers=new HashMap<>();
        private final Map<String,Boolean> remotes=new HashMap<>();
        private final Map<String,Boolean> slotFree=new HashMap<>();
        private final Map<String,Boolean> acceptedTypes=new HashMap<>();
        private final Map<String,Boolean> covered=new HashMap<>();
        private final Map<String,Boolean> documented=new HashMap<>();

        Screening(MarketplaceProvider provider) {
            this.provider=provider;
            this.visibility=exposure.visibilityOf(provider);
        }

        boolean eligible(ServiceRequest need) {
            if (need.getStatus()!=com.clenzy.model.RequestStatus.PENDING || need.getConvertedInterventionId()!=null) return false;
            if (provider.getUserId()==null) return false;
            if (Objects.equals(provider.getHomeOrganizationId(),need.getOrganizationId())) return false;
            if (!visibility.allows(need.getOrganizationId())) return false;
            String code=need.getServiceItemCode();
            if (code==null || !offered(code)) return false;
            var property=need.getProperty();
            if (!remote(code) && (property==null || property.getCountryCode()==null
                    || !acceptsType(property) || !covers(property))) return false;
            if (!documented(need)) return false;
            return slotFree(code) || free(need);
        }

        private boolean free(ServiceRequest need) {
            if (need.getDesiredDate()==null) return false;
            Integer hours=need.getEstimatedDurationHours();
            return availability.isUserAvailable(provider.getUserId(),need.getDesiredDate(),
                    need.getDesiredDate().plusHours(hours!=null && hours>0?hours:4))
                && !needs.previewAssignmentConflicts(need.getId(),null,"user",provider.getUserId(),
                    need.getDesiredDate(),hours);
        }

        private boolean offered(String code) {
            return offers.computeIfAbsent(code,item -> {
                try { MarketplaceOfferEligibility.requireOfferedService(provider,null,item); return true; }
                catch (IllegalArgumentException unavailable) { return false; }
            });
        }
        private boolean remote(String code) { return remotes.computeIfAbsent(code,catalog::isRemote); }
        private boolean slotFree(String code) { return slotFree.computeIfAbsent(code,catalog::doesNotReserveSlot); }

        private boolean acceptsType(com.clenzy.model.Property property) {
            String type=property.getType()==null?null:property.getType().name();
            return acceptedTypes.computeIfAbsent(String.valueOf(type),
                ignored -> zones.acceptsProperty(provider.getId(),type));
        }

        private boolean covers(com.clenzy.model.Property property) {
            String key=key(property.getCountryCode(),property.getDepartment(),
                property.getArrondissement(),property.getCity());
            return covered.computeIfAbsent(key,ignored -> zones.covers(provider.getId(),property.getCountryCode(),
                property.getDepartment(),property.getArrondissement(),property.getCity()));
        }

        /**
         * La preuve documentaire ne dépend que du pays, de la prestation et de la date :
         * deux besoins qui les partagent donnent le même verdict.
         */
        private boolean documented(ServiceRequest need) {
            var property=need.getProperty();
            String country=property!=null?property.getCountryCode():provider.getBaseCountryCode();
            String key=key(country,need.getServiceItemCode(),
                need.getDesiredDate()==null?null:need.getDesiredDate().toLocalDate().toString(),null);
            return documented.computeIfAbsent(key,ignored -> {
                var qualification=new com.clenzy.model.Intervention();
                var user=new com.clenzy.model.User(); user.setId(provider.getUserId());
                qualification.setAssignedUser(user); qualification.setProperty(property);
                qualification.setServiceItemCode(need.getServiceItemCode());
                qualification.setScheduledDate(need.getDesiredDate());
                return documents.assignmentEligible(qualification);
            });
        }

        private String key(String... parts) {
            var joined=new StringBuilder();
            for (String part:parts) joined.append(part==null?"\u0000":part).append('\u0001');
            return joined.toString();
        }
    }
}
