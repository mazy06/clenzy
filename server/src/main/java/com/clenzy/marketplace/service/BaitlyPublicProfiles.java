package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.BaitlyPublicProfile;
import com.clenzy.marketplace.repository.*;
import com.clenzy.model.OrganizationType;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.time.*;
import java.util.*;

@Service @Transactional
public class BaitlyPublicProfiles {
    private static final Set<String> SERVICES=Set.of("LISTINGS","PRICING","GUESTS","CLEANING","MAINTENANCE","OWNER_REPORTING");
    private final BaitlyPublicProfileRepository profiles;
    private final ProviderAccountResolver accounts;
    private final OrganizationService organizations;
    private final OrganizationRepository orgs;
    private final TenantContext tenant;
    private final JdbcTemplate db;
    private final PhotoStorageService storage;
    private final BaitlyConciergePerformance performance;
    private final Clock clock;
    private final BaitlyPublicFinancialPerformance financial;
    public BaitlyPublicProfiles(BaitlyPublicProfileRepository profiles, ProviderAccountResolver accounts,
        OrganizationService organizations, OrganizationRepository orgs, TenantContext tenant, JdbcTemplate db,
        PhotoStorageService storage, BaitlyConciergePerformance performance, Clock clock, BaitlyPublicFinancialPerformance financial) {
        this.profiles=profiles; this.accounts=accounts; this.organizations=organizations; this.orgs=orgs;
        this.tenant=tenant; this.db=db; this.storage=storage; this.performance=performance; this.clock=clock;
        this.financial=financial;
    }
    public record Publish(boolean published, @NotBlank @Size(max=150) String name, @Size(max=150) String city,
        @Size(max=1000) String bio, @Size(max=2048) String bookingUrl, @Size(max=2048) String avatarUrl,
        @NotNull @Size(max=30) List<@NotNull Long> propertyIds, @NotNull @Size(max=6) List<@NotNull String> managementServices,
        boolean seekingManagement, boolean hideLastName, boolean publishFinancialPerformance,
        @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) java.math.BigDecimal managementFeePct) {}
    public record ReviewIdentity(@Size(max=100) String name,@Size(max=2048) String avatarUrl,boolean authorConsent,boolean published){}
    public Map<String,Object> ownReviewIdentity(Long reviewId,String subject) {
        Long org=authorizedReview(reviewId,subject);
        return db.queryForMap("SELECT baitly_public_author_name AS name,baitly_public_author_avatar AS \"avatarUrl\",is_public AS published FROM guest_reviews WHERE id=? AND organization_id=?",reviewId,org);
    }
    /** Publication metadata is scoped to a selected home owned or managed by the caller. */
    public void reviewIdentity(Long reviewId,ReviewIdentity command,String subject) {
        Long org=authorizedReview(reviewId,subject);
        boolean named=command.name()!=null&&!command.name().isBlank() || command.avatarUrl()!=null&&!command.avatarUrl().isBlank();
        if(named&&!command.authorConsent())throw new IllegalArgumentException("Accord de l’auteur requis pour publier son identité.");
        String name=command.name()==null||command.name().isBlank()?null:command.name().trim();
        db.update("UPDATE guest_reviews SET baitly_public_author_name=?,baitly_public_author_avatar=?,is_public=? WHERE id=? AND organization_id=?",name,publicUrl(command.avatarUrl()),command.published(),reviewId,org);
    }
    private Long authorizedReview(Long reviewId,String subject) {
        Long org=tenant.getRequiredOrganizationId(),author=accounts.userIdOf(subject);
        if(author==null)throw new AccessDeniedException("Compte indisponible");
        var organization=orgs.findById(org).orElseThrow();
        boolean concierge=organization.getType()==OrganizationType.CONCIERGE;
        if(concierge)organizations.validateOrgManagement(subject,org);
        // A non-manager keeps the owner scope: asked as yes/no, a refusal must not doom the transaction.
        boolean manager=concierge || organizations.canManageOrg(subject,org);
        Boolean allowed=db.queryForObject("SELECT EXISTS(SELECT 1 FROM guest_reviews r JOIN properties p ON p.id=r.property_id AND p.organization_id=r.organization_id WHERE r.id=? AND r.organization_id=? AND (? OR p.owner_id=?))",Boolean.class,reviewId,org,manager,author);
        if(!Boolean.TRUE.equals(allowed))throw new AccessDeniedException("Avis non autorisé");
        return org;
    }
    @Transactional(readOnly=true)
    public Optional<Map<String,Object>> own(String subject) {
        Long author=accounts.userIdOf(subject);
        if(author==null) throw new AccessDeniedException("Compte indisponible");
        return profiles.findByOrganizationIdAndAuthorUserId(tenant.getRequiredOrganizationId(),author).map(p -> {
            var response=new LinkedHashMap<String,Object>(view(p)); response.put("propertyIds",p.propertyIds);
            response.put("name",p.name); response.put("hideLastName",p.hideLastName); return response;
        });
    }
    public void withdraw(String subject) {
        Long author=accounts.userIdOf(subject);
        if(author==null) throw new AccessDeniedException("Compte indisponible");
        profiles.findByOrganizationIdAndAuthorUserId(tenant.getRequiredOrganizationId(),author).ifPresent(p -> {
            p.published=false; p.updatedAt=clock.instant(); profiles.save(p);
        });
    }

    /** Only explicit public fields; ownership is checked on every publication update. */
    public Map<String,Object> publish(Publish command, String subject) {
        Long org=tenant.getRequiredOrganizationId(), author=accounts.userIdOf(subject);
        if(author==null) throw new AccessDeniedException("Compte indisponible");
        var organization=orgs.findById(org).orElseThrow();
        boolean concierge=BaitlyCrmOrganizationRules.concierge(organization.getType().name(),tenant.isSuperAdmin());
        if(concierge) organizations.validateOrgManagement(subject,org);
        var ids=command.propertyIds().stream().distinct().toList();
        for(Long id:ids) {
            Boolean owns=db.queryForObject("SELECT EXISTS(SELECT 1 FROM properties WHERE id=? AND organization_id=? AND (? OR owner_id=?))",
                Boolean.class,id,org,concierge,author);
            if(!Boolean.TRUE.equals(owns)) throw new AccessDeniedException("Logement non autorisé");
        }
        if(!SERVICES.containsAll(command.managementServices()) || (!concierge && !command.managementServices().isEmpty()))
            throw new IllegalArgumentException("Services de gestion invalides");
        var p=profiles.findByOrganizationIdAndAuthorUserId(org,author).orElseGet(BaitlyPublicProfile::new);
        if(p.id==null) p.id=UUID.randomUUID();
        p.organizationId=org; p.authorUserId=author; p.published=command.published(); p.role=concierge?"CONCIERGE":"OWNER";
        p.name=command.name().trim(); p.city=command.city(); p.bio=command.bio();
        p.hideLastName=command.hideLastName();
        p.publishFinancialPerformance=command.publishFinancialPerformance();
        p.organization=concierge?organization.getName():null;
        p.bookingUrl=publicUrl(command.bookingUrl()); p.avatarUrl=publicUrl(command.avatarUrl());
        p.propertyIds=ids; p.managementServices=command.managementServices().stream().distinct().toList();
        p.managementFeePct=concierge?command.managementFeePct():null;
        p.seekingManagement=!concierge && command.seekingManagement(); p.updatedAt=clock.instant();
        profiles.saveAndFlush(p);
        return view(p);
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> list(String role, String query) {
        if(!Set.of("OWNER","CONCIERGE").contains(role)) throw new IllegalArgumentException("Type de profil invalide");
        String needle=query.toLowerCase(Locale.ROOT);
        return profiles.findTop100ByPublishedTrueAndRoleOrderByUpdatedAtDesc(role).stream()
            .filter(p -> !role.equals("OWNER") || p.seekingManagement)
            .filter(p -> (BaitlyPublicNames.display(p.name,p.hideLastName)+" "+Objects.toString(p.organization,"")+" "+Objects.toString(p.city,"")).toLowerCase(Locale.ROOT).contains(needle))
            .map(p -> view(p,false)).toList();
    }
    @Transactional(readOnly=true)
    public Optional<Map<String,Object>> detail(UUID id) { return profiles.findById(id).filter(p -> p.published).map(this::view); }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> reviews(Long providerId) {
        return db.query("""
            SELECT r.quote_request_id,r.rating,r.feedback,r.created_at,p.id,p.name,p.hide_last_name,p.role,p.organization,p.avatar_url,i.label_fr
            FROM marketplace_reviews r LEFT JOIN baitly_public_profiles p ON p.author_user_id=r.author_user_id
                AND p.organization_id=r.organization_id AND p.published=true
            LEFT JOIN marketplace_quote_requests q ON q.id=r.quote_request_id AND q.requester_organization_id=r.organization_id
            LEFT JOIN marketplace_service_items i ON i.code=q.service_item_code
            WHERE r.provider_id=? ORDER BY r.created_at DESC LIMIT 50
            """,(rs,index) -> {
                var r=new LinkedHashMap<String,Object>(); r.put("id",String.valueOf(rs.getLong("quote_request_id")));
                r.put("providerId",providerId); r.put("clientName",rs.getObject("id")==null?"Client":BaitlyPublicNames.display(rs.getString("name"),rs.getBoolean("hide_last_name"))); r.put("clientRole",Objects.toString(rs.getString("role"),"CLIENT"));
                r.put("clientOrganization",rs.getString("organization")); r.put("avatarUrl",rs.getString("avatar_url"));
                r.put("clientProfileId",rs.getObject("id")==null?null:rs.getObject("id").toString()); r.put("rating",rs.getInt("rating"));
                r.put("feedback",rs.getString("feedback")); r.put("reviewedOn",rs.getTimestamp("created_at").toLocalDateTime().toLocalDate().toString());
                r.put("serviceLabel",rs.getString("label_fr")); r.put("demo",false); return r;
            },providerId);
    }
    private Map<String,Object> view(BaitlyPublicProfile p) {
        return view(p,true);
    }
    private Map<String,Object> view(BaitlyPublicProfile p, boolean includeFinancial) {
        var result=new LinkedHashMap<String,Object>();
        result.put("id",p.id.toString()); result.put("demo",false); result.put("name",BaitlyPublicNames.display(p.name,p.hideLastName)); result.put("role",p.role);
        result.put("organization",p.organization); result.put("city",p.city); result.put("bio",p.bio);
        result.put("bookingDomain",p.bookingUrl); result.put("avatarUrl",p.avatarUrl);
        result.put("networkPublished",p.published); result.put("seekingManagement",p.seekingManagement);
        result.put("publishFinancialPerformance",p.publishFinancialPerformance);
        result.put("managementServices",p.managementServices); result.put("managementFeePct",p.managementFeePct);
        var properties=p.propertyIds.stream().map(id -> property(p,id)).filter(Objects::nonNull).toList();
        result.put("properties",properties);
        result.put("financialPerformance",p.publishFinancialPerformance && includeFinancial ? financial.compute(p.organizationId,
            properties.stream().map(property -> Long.valueOf(property.get("id").toString())).toList(),p.role.equals("CONCIERGE")) : List.of());
        result.put("coverUrl",properties.stream().flatMap(property -> ((List<String>)property.get("photos")).stream()).findFirst().orElse(null));
        // Public annual aggregates are already consented and computed by Baitly, never editable claims.
        var providerIds=p.role.equals("CONCIERGE") ? db.queryForList("SELECT id FROM marketplace_providers WHERE home_organization_id=?",Long.class,p.organizationId) : List.<Long>of();
        var indicators=(providerIds.isEmpty() ? List.<BaitlyConciergePerformance.Performance>of() : performance.publicList()).stream().filter(i -> providerIds.contains(i.provider().id())).toList();
        result.put("annualPerformance",indicators.stream().filter(i -> i.occupancyPct()!=null)
            .map(i -> Map.of("year",i.periodStart().getYear(),"occupancyPct",i.occupancyPct())).toList());
        return result;
    }
    private Map<String,Object> property(BaitlyPublicProfile profile, Long id) {
        var rows=db.queryForList("SELECT id,name,type,city,country_code,department,description,amenities,max_guests,bedroom_count,bathroom_count,square_meters FROM properties WHERE id=? AND organization_id=? AND status='ACTIVE' AND (? OR owner_id=?)",
            id,profile.organizationId,profile.role.equals("CONCIERGE"),profile.authorUserId);
        if(rows.isEmpty()) return null;
        var row=rows.getFirst(); var p=new LinkedHashMap<String,Object>();
        p.put("id",String.valueOf(id)); p.put("name",row.get("name")); p.put("type",row.get("type")); p.put("city",row.get("city"));
        p.put("guests",row.get("max_guests")); p.put("bedrooms",row.get("bedroom_count")); p.put("bathrooms",row.get("bathroom_count"));
        p.put("countryCode",row.get("country_code"));p.put("department",row.get("department"));
        p.put("areaM2",row.get("square_meters")); p.put("description",row.get("description")); p.put("amenities",amenities(row.get("amenities"))); p.put("performance",propertyPerformance(profile.organizationId,id));
        var photos=db.queryForList("SELECT id,external_url FROM property_photos WHERE property_id=? AND organization_id=? ORDER BY sort_order,id LIMIT 12",id,profile.organizationId);
        p.put("photos",photos.stream().map(photo -> {
            String external=Objects.toString(photo.get("external_url"),"");
            return external.startsWith("https://")?external:external.isBlank()?"/api/public/baitly-catalog/profiles/"+profile.id+"/photos/"+photo.get("id"):null;
        }).filter(Objects::nonNull).toList());
        var ratings=db.queryForMap("SELECT count(*) AS count,avg(rating) AS average FROM guest_reviews WHERE property_id=? AND organization_id=? AND is_public=true AND rating BETWEEN 1 AND 5",id,profile.organizationId);
        p.put("guestRatingAvg",ratings.get("average"));p.put("guestRatingCount",ratings.get("count"));
        // Public imported comments retain neither guest identity nor reservation identifiers.
        p.put("guestReviews",db.query("SELECT id,rating,review_date,review_text,baitly_public_author_name,baitly_public_author_avatar FROM guest_reviews WHERE property_id=? AND organization_id=? AND is_public=true AND rating BETWEEN 1 AND 5 ORDER BY review_date DESC LIMIT 20",
            (rs,index) -> {var review=new LinkedHashMap<String,Object>();review.put("id",String.valueOf(rs.getLong("id")));review.put("name",Objects.toString(rs.getString("baitly_public_author_name"),"Voyageur"));review.put("avatarUrl",rs.getString("baitly_public_author_avatar"));review.put("rating",rs.getInt("rating"));review.put("date",rs.getDate("review_date")==null?null:rs.getDate("review_date").toString());review.put("comment",Objects.toString(rs.getString("review_text"),""));return review;},id,profile.organizationId));
        return p;
    }
    private List<String> amenities(Object raw) {
        if(raw==null)return List.of();
        try{return new com.fasterxml.jackson.databind.ObjectMapper().readValue(raw.toString(),new com.fasterxml.jackson.core.type.TypeReference<List<String>>(){}).stream().filter(Objects::nonNull).toList();}
        catch(Exception invalid){return List.of();}
    }
    /** Calendar ratios only, for explicitly selected public homes; no address or reservation data. */
    private List<Map<String,Object>> propertyPerformance(Long org,Long id) {
        int year=LocalDate.now(clock).getYear()-1;
        return db.queryForList("""
            WITH periods AS (SELECT y,make_date(y,1,1) AS since,make_date(y+1,1,1) AS until
                FROM generate_series(CAST(? AS int)-1,CAST(? AS int)) y),
            portfolio AS (SELECT id,created_at::date AS created FROM properties WHERE id=? AND organization_id=?),
            nights AS (SELECT DISTINCT y,d.night FROM periods CROSS JOIN portfolio p
                JOIN reservations r ON r.property_id=p.id AND r.organization_id=?
                CROSS JOIN LATERAL generate_series(greatest(r.check_in,p.created,since)::timestamp,
                    (least(r.check_out,until)-1)::timestamp,interval '1 day') d(night)
                WHERE lower(r.status) IN ('confirmed','checked_in','checked_out','completed')
                    AND r.check_out>r.check_in AND r.check_in<until AND r.check_out>greatest(p.created,since))
            SELECT y AS year,greatest(0,until-greatest(created,since)) AS "calendarNights",
                (SELECT count(*) FROM nights n WHERE n.y=periods.y) AS "bookedNights"
            FROM periods CROSS JOIN portfolio WHERE created<until ORDER BY y
            """,year,year,id,org,org);
    }
    public record Photo(byte[] data, String contentType) {}
    @Transactional(readOnly=true)
    public Optional<Photo> photo(UUID profileId, Long photoId) {
        var profile=profiles.findById(profileId).filter(p -> p.published).orElse(null);
        if(profile==null) return Optional.empty();
        var rows=db.queryForList("SELECT ph.property_id,ph.storage_key,ph.data,ph.content_type FROM property_photos ph JOIN properties p ON p.id=ph.property_id WHERE ph.id=? AND ph.organization_id=? AND p.organization_id=? AND p.status='ACTIVE' AND (? OR p.owner_id=?)",
            photoId,profile.organizationId,profile.organizationId,profile.role.equals("CONCIERGE"),profile.authorUserId);
        if(rows.isEmpty() || !profile.propertyIds.contains(((Number)rows.getFirst().get("property_id")).longValue())) return Optional.empty();
        var row=rows.getFirst(); String type=Objects.toString(row.get("content_type"),"");
        if(!Set.of("image/jpeg","image/png","image/webp").contains(type)) return Optional.empty();
        byte[] data=row.get("storage_key")!=null?storage.retrieve(row.get("storage_key").toString()):(byte[])row.get("data");
        return data==null?Optional.empty():Optional.of(new Photo(data,type));
    }
    static String publicUrl(String raw) {
        if(raw==null || raw.isBlank()) return null;
        var uri=URI.create(raw.trim());
        if(uri.getUserInfo()!=null || uri.getQuery()!=null || uri.getFragment()!=null) throw new IllegalArgumentException("URL publique sans identifiants ni paramètres requise");
        ICalUrlValidator.validateAndResolve(raw);
        return uri.toString();
    }
}
