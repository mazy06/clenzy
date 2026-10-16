package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.OrganizationType;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.math.BigDecimal;
import java.util.*;

@Service
@Transactional
public class BaitlyConciergePerformance {
    private final BaitlyConciergePublicationRepository publications;
    private final MarketplaceProviderRepository providers;
    private final MarketplaceCatalogService catalog;
    private final MarketplaceExposureService exposure;
    private final ProviderAccountResolver accounts;
    private final OrganizationService organizations;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenant;
    private final JdbcTemplate db;
    private final Clock clock;
    public BaitlyConciergePerformance(BaitlyConciergePublicationRepository publications,
        MarketplaceProviderRepository providers, MarketplaceCatalogService catalog, MarketplaceExposureService exposure,
        ProviderAccountResolver accounts, OrganizationService organizations, OrganizationRepository organizationRepository,
        TenantContext tenant, JdbcTemplate db, Clock clock) {
        this.publications=publications; this.providers=providers; this.catalog=catalog; this.exposure=exposure;
        this.accounts=accounts; this.organizations=organizations; this.organizationRepository=organizationRepository;
        this.tenant=tenant; this.db=db; this.clock=clock;
    }
    public record Company(Long id, String displayName, String avatarUrl, String baseCity, List<String> coverageCities) {}
    public record Performance(Company provider, LocalDate periodStart, LocalDate periodEnd,
        int managedProperties, BigDecimal occupancyPct, BigDecimal ratingAvg, int ratingCount, Instant updatedAt) {}
    public record Settings(boolean published, boolean eligible, Performance preview) {}

    /** Tous les résultats ont la même année terminée ; ni coordonnées ni données individuelles. */
    @Transactional(readOnly=true)
    public List<Performance> publicList() {
        return publications.findByPublishedTrueOrderByProviderId().stream()
            .filter(p -> providers.findById(p.providerId).map(provider -> {
                var v=exposure.visibilityOf(provider);
                return provider.getHomeOrganizationId()!=null && v.exposable() && v.global()!=ExposureEffect.DENY
                    && organizationRepository.findById(provider.getHomeOrganizationId())
                        .map(o -> o.getType()==OrganizationType.CONCIERGE).orElse(false);
            }).orElse(false))
            .map(p->compute(p.providerId)).filter(p->p.managedProperties>=5)
            .map(this::dto).filter(Objects::nonNull).toList();
    }

    @Transactional(readOnly=true)
    public Settings settings(String subject) {
        Long id=ownProvider(subject);
        var snapshot=compute(id);
        return new Settings(publications.findById(id).map(p -> p.published).orElse(false),
            snapshot.managedProperties>=5, dto(snapshot));
    }
    public Settings publish(boolean enabled, String subject) {
        Long id=ownProvider(subject);
        // Same provider lock as erasure/ratings serializes competing changes.
        providers.findForRating(id).orElseThrow();
        var snapshot=compute(id);
        if(enabled && snapshot.managedProperties<5)
            throw new IllegalArgumentException("Au moins cinq logements sont nécessaires pour publier un agrégat.");
        snapshot.published=enabled;
        snapshot.consentedBy=subject;
        publications.saveAndFlush(snapshot);
        return new Settings(enabled,snapshot.managedProperties>=5,dto(snapshot));
    }
    private Long ownProvider(String subject) {
        Long org=tenant.getRequiredOrganizationId();
        organizations.validateOrgManagement(subject,org);
        Long id=accounts.requireProviderId(subject);
        var provider=providers.findById(id).orElseThrow();
        if(!org.equals(provider.getHomeOrganizationId()) || organizationRepository.findById(org)
            .map(o -> o.getType()!=OrganizationType.CONCIERGE).orElse(true))
            throw new AccessDeniedException("Seul le gestionnaire de la conciergerie peut publier ses indicateurs.");
        return id;
    }
    private LocalDate periodStart() { return LocalDate.now(clock).minusYears(1).withDayOfYear(1); }

    /** Nuits calendaires du portefeuille actif actuel, limitées par sa date de création. */
    private BaitlyConciergePublication compute(Long id) {
        var provider=providers.findById(id).orElseThrow();
        LocalDate start=periodStart(), end=start.plusYears(1);
        var result=db.queryForMap("""
            WITH portfolio AS (
                SELECT id, greatest(created_at::date, CAST(? AS date)) AS since
                FROM properties WHERE organization_id=? AND status='ACTIVE' AND created_at::date < CAST(? AS date)
            ), occupied AS (
                SELECT DISTINCT p.id, d.night
                FROM portfolio p JOIN reservations r ON r.property_id=p.id AND r.organization_id=?
                CROSS JOIN LATERAL generate_series(
                    greatest(r.check_in,p.since)::timestamp,
                    (least(r.check_out,CAST(? AS date))-1)::timestamp, interval '1 day') d(night)
                WHERE lower(r.status) IN ('confirmed','checked_in','checked_out','completed')
                    AND r.check_out > p.since AND r.check_in < CAST(? AS date)
            )
            SELECT (SELECT count(*) FROM portfolio) AS properties,
                round(100.0*(SELECT count(*) FROM occupied)/nullif(sum(CAST(? AS date)-since),0),1) AS occupancy
            FROM portfolio
            """,start,provider.getHomeOrganizationId(),end,provider.getHomeOrganizationId(),end,end,end);
        var p=new BaitlyConciergePublication();
        p.providerId=id; p.periodStart=start; p.periodEnd=end.minusDays(1);
        p.managedProperties=((Number)result.get("properties")).intValue();
        p.occupancyPct=(BigDecimal)result.get("occupancy"); p.updatedAt=clock.instant();
        return p;
    }
    private Performance dto(BaitlyConciergePublication p) {
        return catalog.getCatalogEntry(p.providerId,null).map(entry -> new Performance(
            new Company(entry.id(),entry.displayName(),entry.avatarUrl(),entry.baseCity(),entry.coverageCities()),p.periodStart,p.periodEnd,
            p.managedProperties,p.occupancyPct,entry.ratingCount()>=5 ? entry.ratingAvg() : null,
            entry.ratingCount(),p.updatedAt)).orElse(null);
    }
}
