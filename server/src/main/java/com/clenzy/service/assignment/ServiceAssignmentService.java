package com.clenzy.service.assignment;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.InterventionAllocationGuard;
import com.clenzy.service.catalog.ServiceCapabilityPolicy;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Source unique des décisions avant l'accord. Les écrans et agents appellent les mêmes commandes. */
@Service
@Transactional
public class ServiceAssignmentService {
    private final ServiceRequestRepository requests;
    private final InterventionRepository interventions;
    private final UserRepository users;
    private final TeamRepository teams;
    private final WorkflowSettingsRepository workflows;
    private final InterventionAllocationGuard allocation;
    private final ServiceCapabilityPolicy capabilities;
    private final AssignmentProposalStore proposals;
    private final AssignmentPolicyStore policies;
    private final AcceptedServiceRequestConverter converter;
    private final JdbcTemplate db;
    private final Clock clock;
    private final com.clenzy.service.PropertyTeamService propertyTeams;
    private final AssignmentCommercialTerms commercial;
    private final AssignmentCandidateRanking ranking;
    private final AssignmentContactPreferences contactPreferences;

    public ServiceAssignmentService(ServiceRequestRepository requests, InterventionRepository interventions,
            UserRepository users, TeamRepository teams, WorkflowSettingsRepository workflows,
            InterventionAllocationGuard allocation, ServiceCapabilityPolicy capabilities,
            AssignmentProposalStore proposals, AssignmentPolicyStore policies,
            AcceptedServiceRequestConverter converter, JdbcTemplate db, Clock clock, com.clenzy.service.PropertyTeamService propertyTeams, AssignmentCommercialTerms commercial, AssignmentCandidateRanking ranking, AssignmentContactPreferences contactPreferences) {
        this.requests=requests; this.interventions=interventions; this.users=users; this.teams=teams;
        this.workflows=workflows; this.allocation=allocation; this.capabilities=capabilities;
        this.proposals=proposals; this.policies=policies; this.converter=converter; this.db=db; this.clock=clock;
        this.propertyTeams=propertyTeams;
        this.commercial=commercial; this.ranking=ranking; this.contactPreferences=contactPreferences;
    }

    public ServiceRequest lock(Long id) {
        return requests.findForMutation(id).orElseThrow(() -> new IllegalArgumentException("Demande introuvable"));
    }

    public void initialize(ServiceRequest need) {
        if (need.getAssignmentPhase()!=null) return;
        need.setAssignmentPhase("INTERNAL");
        need.setAutoAssignStatus("searching");
        requests.saveAndFlush(need);
        search(need.getId(),need.getOrganizationId());
    }

    /** Recherche exclusivement interne ; un échec technique remonte et ne publie jamais le besoin. */
    public boolean search(Long id, Long organizationId) {
        ServiceRequest need=lock(id);
        requireOrganization(need,organizationId);
        if (!"INTERNAL".equals(need.getAssignmentPhase()) || need.getStatus()!=RequestStatus.PENDING
                || need.getMarketplaceRequestId()!=null || interventions.existsByServiceRequestId(id)
                || proposals.active(id).isPresent()) return false;
        var policy=policies.get(organizationId);
        need.setLastAutoAssignAttempt(LocalDateTime.now(clock));
        if (!policy.enabled() || !workflows.findByOrganizationId(organizationId)
                .map(WorkflowSettings::isAutoAssignInterventions).orElse(true)) {
            manual(need,"AUTOMATION_DISABLED"); return false;
        }
        if (need.getServiceItemCode()==null || need.getDesiredDate()==null && !allocation.isUnscheduled(need.getServiceItemCode())) { manual(need,"NEEDS_QUALIFICATION"); return false; }
        Instant now=clock.instant();
        Instant deadline=deadline(need,policy,now);
        if (need.getPriority()==Priority.CRITICAL)
            proposals.event(id,null,"ESCALATION","URGENT-SEARCH:"+id+":"+need.getAssignmentCycle());
        if (!deadline.isAfter(now)) { manual(need,"TOO_LATE"); return false; }
        Set<Long> excluded=proposals.excludedTeams(id,need.getAssignmentCycle());
        List<Long> candidates=db.queryForList("""
            SELECT t.id FROM teams t WHERE
              (t.organization_id=? OR EXISTS (SELECT 1 FROM organization_members m
                 WHERE m.organization_id=? AND m.user_id=t.personal_user_id))
              AND (t.personal_user_id IS NULL OR EXISTS(SELECT 1 FROM personal_capability_owners own WHERE own.team_id=t.id))
              AND EXISTS (SELECT 1 FROM team_members reachable JOIN users account ON account.id=reachable.user_id
                  WHERE reachable.team_id=t.id AND account.keycloak_id IS NOT NULL AND account.status='ACTIVE')
            ORDER BY (SELECT min(pt.priority) FROM property_teams pt WHERE pt.team_id=t.id
                AND pt.property_id=? AND pt.service_item_code=? AND pt.active=true) NULLS LAST,t.id
            """,Long.class,organizationId,organizationId,need.getProperty()==null?null:need.getProperty().getId(),need.getServiceItemCode());
        List<Long> eligible=new ArrayList<>();
        boolean deferredForContact=false;
        Instant nextContact=null;
        for (Long team : candidates) {
            if (excluded.contains(team) || !capabilities.supports("team",team,need.getServiceItemCode())) continue;
            if (!propertyTeams.coversNeed(team,need.getProperty(),need.getServiceItemCode(),organizationId)) continue;
            if (allocation.previewQualification(team,need.getServiceItemCode(),need.getProperty(),need.getDesiredDate(),organizationId)!=null) continue;
            requests.lockAssignee("team",team);
            if (!allocation.isUnscheduled(need.getServiceItemCode()) &&
                    (requests.assignmentConflicts(id,"team",team,need.getDesiredDate(),need.getEstimatedDurationHours())
                     || !allocation.isTeamDeclaredAvailable(team,need.getDesiredDate(),need.getEstimatedDurationHours()))) continue;
            if (!allocation.isRemote(need.getServiceItemCode()) && !Boolean.TRUE.equals(db.queryForObject(
                    "SELECT baitly_assignee_accepts_property('team',?,?)",Boolean.class,team,
                    need.getProperty().getType()==null?null:need.getProperty().getType().name()))) continue;
            if (!contactPreferences.allowed("team",team,policy,need.getPriority()==Priority.CRITICAL,now)) {
                var next=contactPreferences.nextAllowed("team",team,policy,need.getPriority()==Priority.CRITICAL,now);
                if (next.isPresent() && (nextContact==null || next.get().isBefore(nextContact))) nextContact=next.get();
                deferredForContact=true; continue;
            }
            eligible.add(team);
        }
        for (Long team:ranking.rank(need,eligible)) {
            if (!stillAvailable(need,"team",team)) continue;
            requireEligible(need,"team",team);
            proposeLocked(need,"team",team,"AUTOMATIC",policy,now,deadline);
            return true;
        }
        if (deferredForContact) {
            need.setAutoAssignStatus("waiting_contact");
            proposals.event(id,null,"SEARCHING","CONTACT:"+id+":"+need.getAssignmentCycle());
            if (nextContact!=null) proposals.deferContact(id,nextContact);
            else manual(need,"CONTACT_WINDOW_UNAVAILABLE");
            return false;
        }
        if (policy.publicSearch() && (need.getUser()==null || need.getUser().getId()==null
                || !allocation.isRemote(need.getServiceItemCode()) && (need.getProperty()==null
                    || need.getProperty().getCountryCode()==null || need.getProperty().getCity()==null))) {
            manual(need,"PUBLIC_DETAILS_REQUIRED"); return false;
        }
        need.setAssignmentPhase(policy.publicSearch()?"PUBLIC":"MANUAL");
        need.setAutoAssignStatus(policy.publicSearch()?"public_search":"manual_hold");
        proposals.event(id,null,policy.publicSearch()?"PUBLIC":"MANUAL",need.getAssignmentPhase()+":"+id+":"+need.getAssignmentCycle());
        return false;
    }

    public AssignmentProposalStore.Proposal propose(Long id, Long org, String kind, Long target) {
        if (kind==null || !Set.of("team","user").contains(kind) || target==null || target<=0)
            throw new IllegalArgumentException("Prestataire invalide");
        var need=lock(id); requireOrganization(need,org); requireOpen(need);
        var policy=policies.get(org); Instant now=clock.instant();
        Instant deadline=deadline(need,policy,now);
        if (!deadline.isAfter(now)) throw new IllegalStateException("Créneau trop proche : replanifiez la demande");
        if (!contactPreferences.allowed(kind,target,policy,need.getPriority()==Priority.CRITICAL,now)) throw new IllegalStateException("Le prestataire est hors de la plage de sollicitation");
        requireEligible(need,kind,target);
        withdrawLocked(need,"Nouvelle proposition");
        return proposeLocked(need,kind,target,"MANUAL",policy,now,deadline);
    }

    private AssignmentProposalStore.Proposal proposeLocked(ServiceRequest need, String kind, Long target,
            String origin, AssignmentPolicyStore.Policy policy, Instant now, Instant deadline) {
        var proposal=proposals.create(need.getId(),need.getOrganizationId(),need.getAssignmentCycle(),kind,target,origin,now,deadline,policies.snapshot(policy));
        commercial.snapshot(proposal.id(),commercial.offered(need,kind,target));
        need.setAssignedToId(target); need.setAssignedToType(kind);
        need.setAssignmentPhase("PROPOSED"); need.setStatus(RequestStatus.ASSIGNED); need.setAutoAssignStatus("awaiting_response");
        proposals.event(need.getId(),proposal.id(),"PROPOSED","PROPOSED:"+proposal.id());
        if (need.getPriority()==Priority.CRITICAL || Duration.between(now,deadline).compareTo(Duration.ofMinutes(policy.deadlines().imminentMinutes()))<=0)
            proposals.event(need.getId(),proposal.id(),"ESCALATION","URGENT:"+proposal.id());
        return proposal;
    }

    public record Decision(String status, Long interventionId) {}
    public record InboxItem(AssignmentProposalStore.Proposal proposal,String title,String serviceItemCode,
            String city,LocalDateTime scheduledAt,Integer durationHours,AssignmentCommercialTerms.Terms terms,
            AssignmentCommercialTerms.Terms providerTerms) {}
    @Transactional(readOnly=true)
    public List<InboxItem> inbox(Jwt jwt,int page) {
        return proposals.inbox(currentUser(jwt),page).stream().map(p -> {
            var need=requests.findById(p.requestId()).orElseThrow();
            return new InboxItem(p,need.getTitle(),need.getServiceItemCode(),need.getProperty()==null?null:need.getProperty().getCity(),
                need.getDesiredDate(),need.getEstimatedDurationHours(),commercial.snapshot(p.id()),commercial.preview(need,p.targetType(),p.targetId()));
        }).toList();
    }

    public Decision respond(Long id, Long proposalId, boolean accept, String reason, Jwt jwt) {
        var need=lock(id);
        var proposal=proposals.get(proposalId).orElseThrow(() -> new IllegalArgumentException("Proposition introuvable"));
        if (!id.equals(proposal.requestId())) throw new AccessDeniedException("Proposition hors demande");
        requireRecipient(proposal,jwt);
        if ("ACCEPTED".equals(proposal.status()) && accept) return new Decision("ACCEPTED",need.getConvertedInterventionId());
        requireOpen(need);
        if (!"PENDING".equals(proposal.status()) || proposal.cycle()!=need.getAssignmentCycle())
            throw new IllegalStateException("Cette proposition n'est plus active");
        Instant now=clock.instant();
        if (!AssignmentDeadlinePolicy.canRespond(now,proposal.expiresAt())) {
            finish(need,proposal,"EXPIRED",null); return new Decision("EXPIRED",null);
        }
        if (!accept) {
            if (reason!=null && reason.length()>1000) throw new IllegalArgumentException("Motif trop long");
            finish(need,proposal,"DECLINED",reason); return new Decision("DECLINED",null);
        }
        requests.lockAssignee(proposal.targetType(),proposal.targetId());
        if (!stillAvailable(need,proposal.targetType(),proposal.targetId())) {
            finish(need,proposal,"WITHDRAWN","Disponibilité devenue incompatible");
            return new Decision("WITHDRAWN",null);
        }
        if (!coversNeed(need,proposal.targetType(),proposal.targetId())
                || !allocation.assignmentStillQualified(need,proposal.targetType(),proposal.targetId())) {
            finish(need,proposal,"WITHDRAWN","Zone, compétences ou justificatifs devenus incompatibles");
            return new Decision("WITHDRAWN",null);
        }
        requireEligible(need,proposal.targetType(),proposal.targetId());
        var terms=commercial.snapshot(proposal.id());
        if (terms==null) throw new IllegalStateException("Cette prestation nécessite un devis approuvé par le gestionnaire");
        // Une estimation acceptée est un prix négocié pour cette mission, pas une modification du tarif publié.
        if (terms.tariffId()!=null && !commercial.same(terms,commercial.resolve(need,proposal.targetType(),proposal.targetId()))) {
            finish(need,proposal,"WITHDRAWN","Tarif modifié depuis la proposition");
            return new Decision("WITHDRAWN",null);
        }
        need.setEstimatedCost(terms.amount());
        proposals.close(proposal,"ACCEPTED",now,null);
        var mission=converter.convert(need);
        mission.setCurrency(terms.currency());
        proposals.event(id,proposal.id(),"ACCEPTED","ACCEPTED:"+proposal.id());
        return new Decision("ACCEPTED",mission.getId());
    }

    public void tick(Long id) {
        var need=lock(id);
        if (need.getAssignmentPhase()==null && need.getStatus()==RequestStatus.PENDING
                && need.getMarketplaceRequestId()==null && !interventions.existsByServiceRequestId(id)) {
            initialize(need);
            return;
        }
        var active=proposals.active(id);
        if (active.isEmpty()) {
            if ("QUOTED".equals(need.getAssignmentPhase())) endQuote(need);
            else search(id,need.getOrganizationId());
            return;
        }
        var proposal=active.get();
        if (need.getConvertedInterventionId()!=null || interventions.existsByServiceRequestId(id)) return;
        if (need.getStatus()==RequestStatus.CANCELLED) { withdrawLocked(need,"Demande annulée"); return; }
        Instant now=clock.instant();
        if (!AssignmentDeadlinePolicy.canRespond(now,proposal.expiresAt())) finish(need,proposal,"EXPIRED",null);
        else if (!now.isBefore(proposal.createdAt().plusMillis(Duration.between(proposal.createdAt(),proposal.expiresAt()).toMillis()*3/4)))
            proposals.remind(proposal,now);
    }

    private void finish(ServiceRequest need, AssignmentProposalStore.Proposal proposal, String status, String reason) {
        proposals.close(proposal,status,clock.instant(),reason);
        continueAfterDecision(need,proposal,status);
    }

    private void continueAfterDecision(ServiceRequest need, AssignmentProposalStore.Proposal proposal, String status) {
        proposals.event(need.getId(),proposal.id(),status,status+":"+proposal.id());
        need.setAssignedToId(null); need.setAssignedToType(null); need.setStatus(RequestStatus.PENDING);
        boolean automatic=policies.get(need.getOrganizationId()).enabled();
        need.setAssignmentPhase(automatic?"INTERNAL":"MANUAL");
        need.setAutoAssignStatus(automatic?"searching":"manual_hold");
        if (proposals.excludedTeams(need.getId(),need.getAssignmentCycle()).size()>=3)
            proposals.event(need.getId(),null,"ESCALATION","ESCALATION:"+need.getId()+":"+need.getAssignmentCycle());
        requests.saveAndFlush(need);
        if (automatic) search(need.getId(),need.getOrganizationId());
    }

    private void endQuote(ServiceRequest need) {
        if (need.getConvertedInterventionId()!=null || interventions.existsByServiceRequestId(need.getId())) return;
        var rows=db.queryForList("""
            SELECT q.id,q.assignment_proposal_id,q.status FROM service_quotes q
            JOIN service_assignment_proposals p ON p.id=q.assignment_proposal_id
            WHERE q.service_request_id=? AND p.status='QUOTED' AND p.cycle=?
              AND (q.status IN ('REJECTED','EXPIRED') OR (q.status='RECEIVED' AND q.valid_until<?))
            FOR UPDATE OF q
            """,need.getId(),need.getAssignmentCycle(),java.sql.Date.valueOf(LocalDate.now(clock)));
        if (rows.isEmpty()) return;
        var row=rows.getFirst();
        var proposal=proposals.get(((Number)row.get("assignment_proposal_id")).longValue()).orElseThrow();
        String state="REJECTED".equals(row.get("status"))?"DECLINED":"EXPIRED";
        db.update("UPDATE service_quotes SET status='EXPIRED' WHERE id=? AND status='RECEIVED'",row.get("id"));
        if (db.update("UPDATE service_assignment_proposals SET status=?,responded_at=? WHERE id=? AND status='QUOTED'",
                state,java.sql.Timestamp.from(clock.instant()),proposal.id())==1) continueAfterDecision(need,proposal,state);
    }

    public void withdraw(Long id, Long org, String reason) {
        var need=lock(id); requireOrganization(need,org); requireOpen(need); withdrawLocked(need,reason);
        need.setAssignmentPhase("MANUAL"); need.setAutoAssignStatus("manual_hold");
    }
    private void withdrawLocked(ServiceRequest need, String reason) {
        if ("PUBLIC".equals(need.getAssignmentPhase())) {
            db.update("""
                UPDATE marketplace_quote_requests SET status='WITHDRAWN',updated_at=?,decided_at=?,decision_reason=?
                WHERE service_request_id=? AND status IN ('SENT','QUOTED')
                """,java.sql.Timestamp.from(clock.instant()),java.sql.Timestamp.from(clock.instant()),
                reason==null?null:reason.substring(0,Math.min(reason.length(),500)),need.getId());
            db.update("UPDATE service_quotes SET status='REJECTED' WHERE service_request_id=? AND status='RECEIVED'",need.getId());
        }
        if ("QUOTED".equals(need.getAssignmentPhase())) {
            db.update("UPDATE service_quotes SET status='REJECTED' WHERE service_request_id=? AND status='RECEIVED'",need.getId());
            db.update("UPDATE service_assignment_proposals SET status='WITHDRAWN',responded_at=?,reason=? WHERE request_id=? AND status='QUOTED'",java.sql.Timestamp.from(clock.instant()),reason,need.getId());
            need.setAssignmentCycle(need.getAssignmentCycle()+1);
        }
        proposals.active(need.getId()).ifPresent(p -> {
            proposals.close(p,"WITHDRAWN",clock.instant(),reason);
            proposals.event(need.getId(),p.id(),"WITHDRAWN","WITHDRAWN:"+p.id());
        });
        need.setAssignedToId(null); need.setAssignedToType(null);
        if (need.getStatus()!=RequestStatus.CANCELLED) need.setStatus(RequestStatus.PENDING);
    }
    public void resume(Long id, Long org) {
        var need=lock(id); requireOrganization(need,org); requireOpen(need);
        if (proposals.active(id).isPresent()) throw new IllegalStateException("Une proposition attend une réponse");
        withdrawLocked(need,"Reprise de la recherche par le gestionnaire");
        need.setAssignmentPhase("INTERNAL"); need.setStatus(RequestStatus.PENDING); need.setAutoAssignStatus("searching");
        requests.saveAndFlush(need); search(id,org);
    }
    public void requireTimelyAgreement(ServiceRequest need) {
        if (!deadline(need,policies.get(need.getOrganizationId()),clock.instant()).isAfter(clock.instant()))
            throw new IllegalStateException("Le créneau est trop proche ou passé : replanifiez la demande");
    }
    public void requireEligible(ServiceRequest need, String kind, Long id) {
        if (!Set.of("team","user").contains(kind) || id==null) throw new IllegalArgumentException("Prestataire invalide");
        requests.lockAssignee(kind,id);
        if (!coversNeed(need,kind,id)) throw new IllegalArgumentException("Prestataire hors zone du logement");
        if (allocation.isUnscheduled(need.getServiceItemCode())) { allocation.requireUnscheduledAssignment(need,kind,id); return; }
        if (requests.assignmentConflicts(need.getId(),kind,id,need.getDesiredDate(),need.getEstimatedDurationHours()))
            throw new com.clenzy.exception.AssignmentConflictException();
        if (!allocation.isRemote(need.getServiceItemCode())) allocation.requirePropertyAllowed(kind,id,need.getProperty());
        boolean available="team".equals(kind)
            ? allocation.isTeamDeclaredAvailable(id,need.getDesiredDate(),need.getEstimatedDurationHours())
            : allocation.isUserDeclaredAvailable(id,need.getDesiredDate(),need.getEstimatedDurationHours());
        if (!available) throw new com.clenzy.exception.AssignmentConflictException("Prestataire indisponible");
        allocation.requireDocumentaryAssignment(need,kind,id);
    }

    private boolean coversNeed(ServiceRequest need, String kind, Long id) {
        if (allocation.isRemote(need.getServiceItemCode())) return true;
        Long teamId="team".equals(kind)?id:teams.findCanonicalPersonalTeam(id).map(Team::getId).orElse(null);
        return teamId!=null && propertyTeams.coversNeed(teamId,need.getProperty(),need.getServiceItemCode(),need.getOrganizationId());
    }

    private boolean stillAvailable(ServiceRequest need,String kind,Long id) {
        if (allocation.isUnscheduled(need.getServiceItemCode())) return true;
        if (need.getDesiredDate()==null || requests.assignmentConflicts(need.getId(),kind,id,need.getDesiredDate(),need.getEstimatedDurationHours())) return false;
        return "team".equals(kind)
            ? allocation.isTeamDeclaredAvailable(id,need.getDesiredDate(),need.getEstimatedDurationHours())
            : allocation.isUserDeclaredAvailable(id,need.getDesiredDate(),need.getEstimatedDurationHours());
    }
    public Long currentUser(Jwt jwt) {
        return users.findByKeycloakId(jwt.getSubject()).orElseThrow(() -> new AccessDeniedException("Utilisateur introuvable")).getId();
    }
    public void requireRecipient(AssignmentProposalStore.Proposal p, Jwt jwt) {
        Long user=currentUser(jwt);
        boolean allowed="user".equals(p.targetType())?user.equals(p.targetId()):teams.findById(p.targetId())
            .map(t -> t.getMembers().stream().anyMatch(m -> user.equals(m.getUser().getId()))).orElse(false);
        if (!allowed) throw new AccessDeniedException("Vous n'êtes pas destinataire de cette proposition");
    }
    public void requireOrganization(ServiceRequest need, Long org) {
        if (!Objects.equals(org,need.getOrganizationId())) throw new AccessDeniedException("Demande hors organisation");
    }
    public void requireManager(Long id, Long org, Jwt jwt) {
        var need=requests.findById(id).orElseThrow(() -> new IllegalArgumentException("Demande introuvable"));
        requireOrganization(need,org);
        if (com.clenzy.util.JwtRoleExtractor.extractUserRole(jwt).isPlatformStaff()) return;
        Long user=currentUser(jwt);
        if (need.getUser()!=null && user.equals(need.getUser().getId())) return;
        if (need.getProperty()!=null && need.getProperty().getOwner()!=null && user.equals(need.getProperty().getOwner().getId())) return;
        throw new AccessDeniedException("Vous ne gérez pas cette demande");
    }
    private void requireOpen(ServiceRequest need) {
        if (need.getStatus()!=RequestStatus.PENDING && need.getStatus()!=RequestStatus.ASSIGNED
                || need.getPaidAt()!=null || need.getConvertedInterventionId()!=null || interventions.existsByServiceRequestId(need.getId())
                || need.getMarketplaceRequestId()!=null)
            throw new IllegalStateException("Utilisez le parcours de l'accord ou de l'intervention existante");
    }
    private Instant deadline(ServiceRequest need, AssignmentPolicyStore.Policy policy, Instant now) {
        ZoneId zone=ZoneId.of(need.getProperty()!=null && need.getProperty().getTimezone()!=null?need.getProperty().getTimezone():policy.timezone());
        Instant start=allocation.isUnscheduled(need.getServiceItemCode()) || need.getDesiredDate()==null?null:need.getDesiredDate().atZone(zone).toInstant();
        return AssignmentDeadlinePolicy.expiresAt(now,start,need.getPriority()==Priority.CRITICAL,policy.deadlines());
    }
    private void manual(ServiceRequest need, String reason) {
        need.setAssignmentPhase("MANUAL");
        need.setAutoAssignStatus(switch (reason) {
            case "PUBLIC_DETAILS_REQUIRED" -> "public_details";
            case "CONTACT_WINDOW_UNAVAILABLE" -> "contact_unavailable";
            default -> reason.toLowerCase(java.util.Locale.ROOT);
        });
        proposals.event(need.getId(),null,"MANUAL",reason+":"+need.getId()+":"+need.getAssignmentCycle());
    }

    @Transactional(readOnly=true)
    public Map<Long,Instant> activeDeadlines(List<Long> ids) {
        return proposals.activeDeadlines(ids);
    }
}
