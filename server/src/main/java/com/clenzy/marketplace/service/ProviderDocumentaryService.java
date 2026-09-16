package com.clenzy.marketplace.service;

import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.ProviderDocument;
import com.clenzy.repository.ProviderDocumentRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/** Revue manuelle tracée ; le document approuvé reste l'unique preuve et peut expirer ou être refusé. */
@Service
@Transactional
public class ProviderDocumentaryService {
    private final JdbcTemplate db;
    private final MarketplaceProviderRepository providers;
    private final ProviderDocumentRepository documents;
    private final MarketplaceDecisionJournal journal;
    private final Clock clock;
    public ProviderDocumentaryService(JdbcTemplate db, MarketplaceProviderRepository providers,
            ProviderDocumentRepository documents, MarketplaceDecisionJournal journal, Clock clock) {
        this.db=db; this.providers=providers; this.documents=documents; this.journal=journal; this.clock=clock;
    }
    public record Evidence(Long id, String name, String type, String status, LocalDate expiresAt) {}
    public record View(String professionalStatus, String baseCountry, List<String> serviceScopes,
                       List<Evidence> documents, List<Map<String,Object>> reviews, List<Map<String,Object>> rules) {}
    public record Review(String country, String professionalStatus, String serviceScope, List<Long> documentIds,
                         boolean regulated, Long licenseDocumentId, LocalDate validUntil, String note, boolean manualAssessment) {}
    @Transactional(readOnly=true)
    public View view(Long id) {
        var p=providers.findById(id).orElseThrow();
        var docs=new ArrayList<>(documents.findByMarketplaceProviderIdOrderByCreatedAtDesc(id));
        if(p.getUserId()!=null) docs.addAll(documents.findByUserIdOrderByCreatedAtDesc(p.getUserId()));
        var scopes=new TreeSet<String>(); scopes.add("*");
        for (var type : com.clenzy.model.InterventionType.values()) scopes.add("TYPE:"+type.name());
        p.getOffers().forEach(o -> { if(o.getServiceItem()!=null) scopes.add("ITEM:"+o.getServiceItem().getCode());
            else if(o.getCategory()!=null) scopes.add("CATEGORY:"+o.getCategory().getCode()); });
        scopes.addAll(db.queryForList("SELECT 'ITEM:'||code FROM marketplace_service_items WHERE active",String.class));
        String status=db.queryForObject("SELECT professional_status FROM marketplace_providers WHERE id=?",String.class,id);
        return new View(status,p.getBaseCountryCode(),List.copyOf(scopes),docs.stream().map(d -> new Evidence(d.getId(),d.getFileName(),d.getDocumentType().name(),d.getStatus().name(),d.getExpiresAt())).toList(),
            db.queryForList("SELECT v.*,(v.id=(SELECT max(x.id) FROM provider_documentary_reviews x WHERE x.provider_id=v.provider_id AND x.country=v.country AND x.service_scope=v.service_scope) AND baitly_provider_document_eligible(v.provider_id,v.country,v.service_scope,CAST(? AS date))) AS currently_valid FROM provider_documentary_reviews v WHERE provider_id=? ORDER BY id DESC",LocalDate.now(clock),id),
            db.queryForList("SELECT * FROM provider_documentary_rules ORDER BY country,professional_status,service_scope"));
    }
    public void review(Long id, Review command, String actor) {
        var provider=providers.findForErasure(id).orElseThrow();
        MarketplaceReviewPolicy.requireConfirmedEmail(provider);
        String country=country(command.country()), status=professionalStatus(command.professionalStatus()), scope=scope(command.serviceScope());
        if(!command.manualAssessment()) throw new IllegalArgumentException("Confirmez le contrôle du pays, du statut et de l'activité");
        if(command.validUntil()==null || command.validUntil().isBefore(LocalDate.now(clock))) throw new IllegalArgumentException("Échéance de réexamen requise");
        if(command.documentIds()==null || command.documentIds().isEmpty() || command.documentIds().size()>30) throw new IllegalArgumentException("Sélectionnez les preuves vérifiées");
        if(command.documentIds().stream().anyMatch(Objects::isNull)) throw new IllegalArgumentException("Justificatif incorrect");
        var selected=new TreeSet<>(command.documentIds());
        if(selected.stream().anyMatch(n -> n==null || n<=0)) throw new IllegalArgumentException("Justificatif incorrect");
        for(Long documentId:selected) {
            var d=documents.findById(documentId).orElseThrow();
            if(!Objects.equals(id,d.getMarketplaceProviderId()) && (provider.getUserId()==null || !Objects.equals(provider.getUserId(),d.getUserId())))
                throw new org.springframework.security.access.AccessDeniedException("Justificatif d'un autre prestataire");
            if(d.getStatus()!=ProviderDocument.Status.APPROVED || (d.getExpiresAt()!=null && d.getExpiresAt().isBefore(command.validUntil())))
                throw new IllegalArgumentException("Les preuves doivent rester approuvées et valides jusqu'à l'échéance choisie");
        }
        if(command.regulated() && (command.licenseDocumentId()==null || !selected.contains(command.licenseDocumentId())))
            throw new IllegalArgumentException("Sélectionnez la qualification ou licence vérifiée pour l'activité réglementée");
        db.update("UPDATE marketplace_providers SET professional_status=? WHERE id=?",status,id);
        Long version=db.queryForObject("SELECT coalesce((SELECT version FROM provider_documentary_rules WHERE country=? AND professional_status=? AND service_scope=?),0)",Long.class,country,status,scope);
        db.update("""
            INSERT INTO provider_documentary_reviews(provider_id,country,professional_status,service_scope,rule_version,document_ids,regulated,license_document_id,valid_until,note,actor)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """,id,country,status,scope,version,selected.stream().map(String::valueOf).collect(Collectors.joining(",")),command.regulated(),command.licenseDocumentId(),command.validUntil(),note(command.note()),actor);
        require(id,country,scope,LocalDate.now(clock));
        journal.record(id,"DOCUMENTARY_REVIEW",null,country+":"+status+":"+scope,actor);
    }
    public void revoke(Long providerId, Long reviewId, String reason, String actor) {
        providers.findForErasure(providerId).orElseThrow();
        if(db.update("UPDATE provider_documentary_reviews SET revoked_at=now() WHERE id=? AND provider_id=?",reviewId,providerId)!=1)
            throw new IllegalArgumentException("Revue introuvable");
        journal.record(providerId,"DOCUMENTARY_REVOKED",String.valueOf(reviewId),note(reason),actor);
    }
    public void rule(String country, String status, String scope, List<String> types, boolean regulated, String reason, String actor) {
        var checked=types==null ? List.<String>of() : types.stream().map(t -> ProviderDocument.DocumentType.valueOf(t).name()).distinct().sorted().toList();
        if(checked.contains("IDENTITY")) throw new IllegalArgumentException("La vérification d'identité de paiement appartient au PSP");
        db.update("""
            INSERT INTO provider_documentary_rules(country,professional_status,service_scope,required_types,regulated,reason,actor)
            VALUES (?,?,?,?,?,?,?) ON CONFLICT(country,professional_status,service_scope) DO UPDATE
            SET required_types=excluded.required_types,regulated=excluded.regulated,reason=excluded.reason,actor=excluded.actor,version=provider_documentary_rules.version+1
            """,country(country),professionalStatus(status),scope(scope),String.join(",",checked),regulated,note(reason),actor);
    }
    @Transactional(readOnly=true)
    public boolean eligible(Long id,String country,String scope,LocalDate date) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT baitly_provider_document_eligible(?,?,?,CAST(? AS date))",Boolean.class,id,country,scope,date));
    }
    public void require(Long id,String country,String scope,LocalDate date) {
        if(!eligible(id,country,scope,date)) throw new IllegalStateException("Revue documentaire requise pour ce pays, ce statut et cette prestation");
    }
    public void requireRemoteService(Long id, String item, LocalDate date) {
        var provider=providers.findForErasure(id).orElseThrow();
        require(id,provider.getBaseCountryCode(),"ITEM:"+item,date==null ? LocalDate.now(clock) : date);
    }
    public void requirePublication(Long id) {
        var p=providers.findForErasure(id).orElseThrow();
        require(id,p.getBaseCountryCode(),"*",LocalDate.now(clock));
    }
    @Transactional(readOnly=true)
    public boolean hasReviewedScope(Long id, String scope) {
        return Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM provider_documentary_reviews v WHERE provider_id=? AND service_scope=? AND baitly_provider_document_eligible(provider_id,country,service_scope,CAST(? AS date)))",
                Boolean.class,id,scope,LocalDate.now(clock)));
    }
    /** Même contrôle documentaire que la réservation, sans verrou ni mutation pour l'aperçu. */
    @Transactional(readOnly=true)
    public boolean assignmentEligible(com.clenzy.model.Intervention mission) {
        if (mission.getServiceItemCode() == null) return false;
        var ids = assignmentProviders(mission);
        LocalDate date = mission.getScheduledDate() == null ? LocalDate.now(clock) : mission.getScheduledDate().toLocalDate();
        return ids.stream().allMatch(id -> eligible(id, assignmentCountry(mission,id),
            "ITEM:" + mission.getServiceItemCode(), date));
    }

    private String assignmentCountry(com.clenzy.model.Intervention mission, Long providerId) {
        return mission.getProperty() != null ? mission.getProperty().getCountryCode()
            : providers.findById(providerId).orElseThrow().getBaseCountryCode();
    }

    private SortedSet<Long> assignmentProviders(com.clenzy.model.Intervention mission) {
        var ids = new TreeSet<Long>();
        if (mission.getAssignedUser() != null) providers.findByUserId(mission.getAssignedUser().getId()).ifPresent(p -> ids.add(p.getId()));
        if (mission.getTeamId() != null) ids.addAll(db.queryForList("SELECT DISTINCT p.id FROM marketplace_providers p JOIN team_members m ON m.user_id=p.user_id WHERE m.team_id=?", Long.class, mission.getTeamId()));
        return ids;
    }

    public void requireAssignment(com.clenzy.model.Intervention mission, String explicitScope) {
        var ids=assignmentProviders(mission);
        String service=mission.getServiceItemCode()!=null ? "ITEM:"+mission.getServiceItemCode() : explicitScope;
        if(service==null && mission.getId()!=null) {
            var scopes=db.queryForList("SELECT CASE WHEN service_item_code IS NOT NULL THEN 'ITEM:'||service_item_code ELSE 'CATEGORY:'||category_code END FROM marketplace_quote_requests WHERE intervention_id=?",String.class,mission.getId());
            if(!scopes.isEmpty()) service=scopes.getFirst();
        }
        if(service==null && mission.getServiceRequest()!=null && mission.getServiceRequest().getServiceType()!=null)
            service="TYPE:"+mission.getServiceRequest().getServiceType().name();
        if(service==null) service="TYPE:"+(mission.getType()==null ? "OTHER" : mission.getType());
        for(Long id:ids) {
            providers.findForErasure(id).orElseThrow();
            require(id,assignmentCountry(mission,id),service,mission.getScheduledDate()==null ? LocalDate.now(clock) : mission.getScheduledDate().toLocalDate());
        }
    }
    @Transactional(readOnly=true)
    public List<Long> unpublishableIds() {
        return db.queryForList("SELECT id FROM marketplace_providers WHERE NOT baitly_provider_document_eligible(id,base_country_code,'*',CAST(? AS date))",Long.class,LocalDate.now(clock));
    }
    @Transactional(readOnly=true)
    public boolean completeForUser(Long userId) {
        return providers.findByUserId(userId).map(p -> eligible(p.getId(),p.getBaseCountryCode(),"*",LocalDate.now(clock))).orElse(false);
    }
    public static String scope(String value) {
        if(value==null || !value.matches("\\*|(?:ITEM|CATEGORY|TYPE):[A-Za-z0-9_-]{1,120}")) throw new IllegalArgumentException("Prestation requise");
        return value;
    }
    static String country(String value) {
        String code=value==null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if(!Set.of(Locale.getISOCountries()).contains(code)) throw new IllegalArgumentException("Pays ISO requis");
        return code;
    }
    static String professionalStatus(String value) {
        if(!Set.of("SOLE_TRADER","COMPANY","EMPLOYEE","OTHER").contains(String.valueOf(value))) throw new IllegalArgumentException("Statut professionnel requis");
        return value;
    }
    static String note(String value) {
        if(value==null || value.isBlank() || value.trim().length()>1000) throw new IllegalArgumentException("Motif requis, limité à 1000 caractères");
        return value.trim();
    }
}
