package com.clenzy.service.assignment;

import com.clenzy.dto.*;
import com.clenzy.model.*;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.JwtRoleExtractor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Les anciennes entrées « créer une intervention » expriment désormais un besoin. */
@Service
@Transactional
public class InterventionRequestIntake {
    private final InterventionMapper mapper;
    private final ServiceRequestMapper requestMapper;
    private final ServiceRequestRepository requests;
    private final ServiceAssignmentService assignments;
    private final com.clenzy.repository.InterventionRepository interventions;
    private final TenantContext tenant;
    private final com.clenzy.service.catalog.ServiceCatalogReference catalog;
    public InterventionRequestIntake(InterventionMapper mapper, ServiceRequestMapper requestMapper,
            ServiceRequestRepository requests,ServiceAssignmentService assignments,TenantContext tenant,com.clenzy.service.catalog.ServiceCatalogReference catalog,com.clenzy.repository.InterventionRepository interventions) {
        this.mapper=mapper; this.requestMapper=requestMapper; this.requests=requests; this.assignments=assignments; this.tenant=tenant;
        this.catalog=catalog; this.interventions=interventions;
    }
    public ServiceRequestDto create(CreateInterventionRequest request,Jwt jwt) {
        var role=JwtRoleExtractor.extractUserRole(jwt);
        if (role!=UserRole.HOST && !role.isPlatformStaff()) throw new AccessDeniedException("Création non autorisée");
        var draft=new Intervention(); draft.setOrganizationId(tenant.getRequiredOrganizationId()); mapper.apply(request,draft);
        if (draft.getProperty()!=null && (!draft.getOrganizationId().equals(draft.getProperty().getOrganizationId())
                || role==UserRole.HOST && (draft.getProperty().getOwner()==null
                || !assignments.currentUser(jwt).equals(draft.getProperty().getOwner().getId()))))
            throw new AccessDeniedException("Logement non autorisé");
        if (role==UserRole.HOST && (draft.getRequestor()==null || !assignments.currentUser(jwt).equals(draft.getRequestor().getId())))
            throw new AccessDeniedException("Demandeur incorrect");
        return requestMapper.toDto(createDraft(draft,null));
    }
    /** Une nouvelle occurrence est autorisée après la clôture effective du travail précédent. */
    public ServiceRequest createRecurringDraft(Intervention draft,String flowKey) {
        requests.acquireAutoFlowKeyLock(flowKey);
        var previous=requests.findByAutoFlowKey(flowKey,draft.getOrganizationId()).orElse(null);
        if (previous!=null) {
            boolean ended=previous.getStatus()==RequestStatus.CANCELLED || previous.getStatus()==RequestStatus.REJECTED
                    || previous.getStatus()==RequestStatus.COMPLETED;
            if (previous.getConvertedInterventionId()!=null)
                ended=interventions.findById(previous.getConvertedInterventionId()).map(i ->
                        i.getStatus()==InterventionStatus.COMPLETED || i.getStatus()==InterventionStatus.CANCELLED).orElse(false);
            if (!ended) return previous;
            previous.setAutoFlowKey(null);
            requests.saveAndFlush(previous);
        }
        return createDraft(draft,flowKey);
    }

    /** Synchronisation d'un besoin non accepté ; un accord existant exige une décision séparée. */
    public boolean synchronize(String flowKey,Long org,java.time.LocalDateTime date,boolean cancel) {
        requests.acquireAutoFlowKeyLock(flowKey);
        var found=requests.findByAutoFlowKey(flowKey,org);
        if (found.isEmpty()) return false;
        var need=assignments.lock(found.get().getId());
        if (need.getConvertedInterventionId()!=null || interventions.existsByServiceRequestId(need.getId())) return false;
        if (need.getStatus()==RequestStatus.CANCELLED || need.getStatus()==RequestStatus.COMPLETED
                || need.getStatus()==RequestStatus.REJECTED) return true;
        if (!cancel && java.util.Objects.equals(date,need.getDesiredDate())) return true;
        assignments.withdraw(need.getId(),org,cancel?"Réservation annulée":"Réservation replanifiée");
        need.setAssignmentCycle(need.getAssignmentCycle()+1);
        if (cancel) {
            need.setStatus(RequestStatus.CANCELLED); need.setAssignmentPhase("CANCELLED");
        } else {
            need.setDesiredDate(date);
            requests.saveAndFlush(need);
            assignments.resume(need.getId(),org);
        }
        return true;
    }

    public ServiceRequest createDraft(Intervention draft,String flowKey) {
        draft.setServiceItemCode(catalog.resolve(draft.getServiceItemCode(),draft.getType(),null,null));
        catalog.requireLocation(draft.getServiceItemCode(),draft.getProperty());
        if (flowKey!=null) {
            requests.acquireAutoFlowKeyLock(flowKey);
            var previous=requests.findByAutoFlowKey(flowKey,draft.getOrganizationId());
            if (previous.isPresent()) return previous.get();
        }
        var need=new ServiceRequest();
        need.setOrganizationId(draft.getOrganizationId()); need.setUser(draft.getRequestor()); need.setProperty(draft.getProperty());
        need.setTitle(draft.getTitle().substring(0,Math.min(100,draft.getTitle().length())));
        need.setDescription(draft.getDescription()); need.setServiceType(ServiceType.OTHER); need.setServiceItemCode(draft.getServiceItemCode());
        need.setDesiredDate(draft.getScheduledDate()); need.setEstimatedDurationHours(draft.getEstimatedDurationHours());
        need.setEstimatedCost(draft.getEstimatedCost()); need.setSpecialInstructions(draft.getSpecialInstructions());
        String priority=draft.getPriority();
        need.setPriority("URGENT".equals(priority)?Priority.CRITICAL:"MEDIUM".equals(priority)||priority==null?Priority.NORMAL:Priority.valueOf(priority));
        need.setAutoFlowKey(flowKey); requests.saveAndFlush(need);
        if (draft.getTeamId()!=null) assignments.propose(need.getId(),need.getOrganizationId(),"team",draft.getTeamId());
        else if (draft.getAssignedUser()!=null) assignments.propose(need.getId(),need.getOrganizationId(),"user",draft.getAssignedUser().getId());
        else assignments.initialize(need);
        return need;
    }
}
