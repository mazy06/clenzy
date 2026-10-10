package com.clenzy.service;

import com.clenzy.marketplace.dto.*;
import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceServiceItemRepository;
import com.clenzy.marketplace.service.*;
import com.clenzy.model.UpsellOffer;
import com.clenzy.repository.UpsellOfferRepository;
import com.clenzy.repository.UpsellTypeDefRepository;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/** Pont Baitly : un besoin précis, un catalogue autorisé, une préférence manuelle durable. */
@Service
@Transactional(readOnly = true)
public class UpsellFulfillmentService {
    private final UpsellOfferRepository offers;
    private final UpsellTypeDefRepository types;
    private final MarketplaceServiceItemRepository items;
    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final MarketplacePropertyContext properties;
    private final JdbcTemplate db;
    private final MarketplaceGeographicEligibility geography;

    public UpsellFulfillmentService(UpsellOfferRepository offers, UpsellTypeDefRepository types,
            MarketplaceServiceItemRepository items, MarketplaceCatalogService catalog,
            MarketplaceExposureService exposure, MarketplacePropertyContext properties, JdbcTemplate db,
            MarketplaceGeographicEligibility geography) {
        this.offers=offers; this.types=types; this.items=items; this.catalog=catalog;
        this.exposure=exposure; this.properties=properties; this.db=db;
        this.geography=geography;
    }

    public record Configuration(String serviceItemCode, String overrideCode, Long preferredProviderId,
                                CatalogProviderDto preferredProvider, String selectionMode) {}
    public record Candidates(CatalogPageDto page, Map<Long, String> availability, List<String> serviceCodes) {
        public Candidates(CatalogPageDto page, Map<Long,String> availability) { this(page,availability,List.of()); }
    }

    private UpsellOffer require(Long id, Long org, Jwt jwt) {
        var offer=offers.findByIdAndOrganizationId(id, org)
                .orElseThrow(() -> new IllegalArgumentException("Service introuvable"));
        properties.require(offer.getPropertyId(),org,jwt);
        return offer;
    }

    private String code(UpsellOffer offer) {
        if (offer.getFulfillmentServiceCode()!=null) return offer.getFulfillmentServiceCode();
        return types.findByCodeInScope(offer.getType(),offer.getOrganizationId()).stream()
                .findFirst().map(com.clenzy.model.UpsellTypeDef::getServiceItemCode).orElse(null);
    }

    public Configuration configuration(Long id, Long org, Jwt jwt) {
        var offer=require(id,org,jwt);
        var preferred=offer.getPreferredProviderId()==null ? null : catalog.getProvider(offer.getPreferredProviderId())
                .filter(p -> exposure.isVisibleTo(p,org)).flatMap(p -> catalog.getCatalogEntry(p.getId(),org)).orElse(null);
        return new Configuration(code(offer),offer.getFulfillmentServiceCode(),offer.getPreferredProviderId(),preferred,"MANUAL");
    }

    public Candidates candidates(Long id, Long org, Jwt jwt, Long propertyId, LocalDateTime start,
            int durationMinutes, boolean availableOnly, boolean verifiedOnly, boolean urgent, String language,
            String sort, int page) {
        return candidates(id,org,jwt,propertyId,start,durationMinutes,availableOnly,verifiedOnly,urgent,language,sort,page,false);
    }

    public Candidates candidates(Long id, Long org, Jwt jwt, Long propertyId, LocalDateTime start,
            int durationMinutes, boolean availableOnly, boolean verifiedOnly, boolean urgent, String language,
            String sort, int page, boolean related) {
        var offer=require(id,org,jwt);
        String code=code(offer);
        if (code==null) return new Candidates(new CatalogPageDto(List.of(),0,12,0,0),Map.of());
        var item=items.findByCode(code).filter(i -> i.isActive() && i.getCategory().isActive())
                .orElseThrow(() -> new IllegalArgumentException("Prestation du catalogue inactive"));
        var serviceCodes=related ? items.findAllActiveWithCategory().stream()
                .filter(i -> i.getCategory().getCode().equals(item.getCategory().getCode()))
                .filter(i -> Objects.equals(i.getExecutionMode(),item.getExecutionMode()))
                .map(com.clenzy.marketplace.model.MarketplaceServiceItem::getCode)
                .filter(c -> !c.equals(code)).toList() : List.of(code);
        if (serviceCodes.isEmpty()) return new Candidates(new CatalogPageDto(List.of(),page,12,0,0),Map.of());
        Long location=offer.getPropertyId()!=null ? offer.getPropertyId() : propertyId;
        if (offer.getPropertyId()!=null && propertyId!=null && !offer.getPropertyId().equals(propertyId))
            throw new IllegalArgumentException("Ce service concerne un autre logement");
        var property=properties.require(location,org,jwt);
        if (durationMinutes<15 || durationMinutes>1440) throw new IllegalArgumentException("Durée invalide");
        var finish=start==null ? null : start.plusMinutes(durationMinutes);
        if (availableOnly && start==null) throw new IllegalArgumentException("Choisissez un créneau");
        Specification<MarketplaceProvider> execution=(root,cq,cb) -> {
            var predicates=new ArrayList<jakarta.persistence.criteria.Predicate>();
            // Les profils internes restent consultables pour préparer une préférence.
            // Les contrôles documentaires d'attribution et d'exécution restent obligatoires.
            var country=property!=null && property.getCountryCode()!=null
                    ? cb.literal(property.getCountryCode()) : cb.coalesce(root.<String>get("baseCountryCode"),"FR");
            // Vérifier les pièces pour la prestation effectivement vendue, y compris une alternative.
            var eligible=cq.subquery(Long.class);
            var sold=eligible.from(com.clenzy.marketplace.model.MarketplaceProviderOffer.class);
            var soldItem=sold.join("serviceItem");
            var tariff=sold.join("tariff",jakarta.persistence.criteria.JoinType.LEFT);
            eligible.select(cb.literal(1L)).where(cb.equal(sold.get("provider"),root),
                    cb.isTrue(sold.get("active")),
                    cb.or(cb.isNull(tariff.get("id")),cb.isTrue(tariff.get("enabled"))),
                    soldItem.get("code").in(serviceCodes),
                    cb.or(cb.equal(root.get("homeOrganizationId"),org),
                    cb.isTrue(cb.function("public.baitly_provider_document_eligible",Boolean.class,
                            root.get("id"),country,cb.concat(cb.literal("ITEM:"),soldItem.get("code")),
                            cb.literal(start==null ? java.time.LocalDate.now() : start.toLocalDate())))));
            predicates.add(cb.exists(eligible));
            if (availableOnly) predicates.add(cb.isTrue(cb.function("public.baitly_provider_slot_available",
                    Boolean.class,root.get("id"),cb.literal(start),cb.literal(finish))));
            if (language!=null && !language.isBlank()) {
                if (!language.matches("[a-z]{2}")) throw new IllegalArgumentException("Langue invalide");
                predicates.add(cb.like(cb.concat(cb.concat(",",cb.lower(cb.coalesce(root.get("languages"),""))),","),"%,"+language+",%"));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var criteria=new ProviderSearchCriteria(null,null,null,null,serviceCodes,null,null,null,null,
                verifiedOnly,null,urgent,null,null,null,sort,page,12);
        // Les prestations à distance ne dépendent pas de la zone du logement.
        var result=catalog.searchCatalog(criteria,org,exposure.hiddenProviderIdsFor(org),
                "REMOTE".equals(item.getExecutionMode()) ? null : property,execution);
        Map<Long,String> availability=new HashMap<>();
        if (start!=null && !result.items().isEmpty()) {
            var ids=result.items().stream().map(CatalogProviderDto::id).toList();
            var args=new ArrayList<Object>(); args.add(start); args.add(finish); args.addAll(ids);
            db.query("SELECT id, public.baitly_provider_slot_available(id,?,?) AS available FROM marketplace_providers WHERE id IN ("
                    +String.join(",",Collections.nCopies(ids.size(),"?"))+")",rs -> {
                Boolean free=(Boolean)rs.getObject("available");
                availability.put(rs.getLong("id"),free==null?"UNKNOWN":free?"AVAILABLE":"UNAVAILABLE");
            },args.toArray());
        }
        return new Candidates(result,availability,serviceCodes);
    }

    @Transactional
    public Configuration configure(Long id, Long org, Jwt jwt, String serviceItemCode, Long providerId, Long propertyId) {
        var offer=require(id,org,jwt);
        String value=serviceItemCode==null || serviceItemCode.isBlank() ? null : serviceItemCode.trim();
        if (value!=null && items.findByCode(value).filter(i -> i.isActive() && i.getCategory().isActive()).isEmpty())
            throw new IllegalArgumentException("Prestation du catalogue introuvable");
        offer.setFulfillmentServiceCode(value);
        if (providerId!=null) {
            String effective=code(offer);
            if (effective==null) throw new IllegalArgumentException("Reliez d'abord la prestation au catalogue");
            var provider=catalog.getProvider(providerId).filter(p -> exposure.isVisibleTo(p,org))
                    .orElseThrow(() -> new IllegalArgumentException("Prestataire introuvable"));
            var visible=catalog.getCatalogEntry(providerId,org).orElseThrow();
            if (visible.offers().stream().noneMatch(o -> effective.equals(o.serviceItemCode())))
                throw new IllegalArgumentException("Cette prestation n'est pas proposée par le prestataire");
            properties.require(offer.getPropertyId()!=null?offer.getPropertyId():propertyId,org,jwt);
            if (offer.getPropertyId()!=null && propertyId!=null && !offer.getPropertyId().equals(propertyId))
                throw new IllegalArgumentException("Ce service concerne un autre logement");
            geography.requireServiceCoverage(providerId,offer.getPropertyId()!=null?offer.getPropertyId():propertyId,org,effective);
            MarketplaceOfferEligibility.requireOfferedService(provider,null,effective);
        }
        offer.setPreferredProviderId(providerId);
        offers.save(offer);
        return configuration(id,org,jwt);
    }
}
