package com.clenzy.service;

import com.clenzy.exception.AssignmentConflictException;
import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.repository.ServiceRequestRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Réserve les ressources d'une intervention avec le même verrou que les demandes. */
@Service
public class InterventionAllocationGuard {
    private final com.clenzy.marketplace.service.ProviderDocumentaryService documentary;
    private final com.clenzy.service.catalog.ServiceCapabilityPolicy capabilities;
    private final com.clenzy.service.catalog.ServiceCatalogReference catalog;
    private final ServiceRequestRepository requests;
    private final ProviderAvailabilityService availability;
    private final ProviderPropertyEligibility propertyEligibility;

    public InterventionAllocationGuard(ServiceRequestRepository requests, ProviderAvailabilityService availability, ProviderPropertyEligibility propertyEligibility, com.clenzy.marketplace.service.ProviderDocumentaryService documentary, com.clenzy.service.catalog.ServiceCapabilityPolicy capabilities, com.clenzy.service.catalog.ServiceCatalogReference catalog) {
        this.capabilities=capabilities;
        this.catalog=catalog;
        this.documentary=documentary;
        this.propertyEligibility=propertyEligibility;
        this.requests = requests;
        this.availability = availability;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAvailable(Intervention intervention) { requireAvailable(intervention,null); }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireAvailable(Intervention intervention, String serviceScope) {
        if (intervention.getStatus() == InterventionStatus.CANCELLED
                || intervention.getStatus() == InterventionStatus.COMPLETED) return;
        if (intervention.getServiceItemCode() == null)
            intervention.setServiceItemCode(catalog.resolve(null, intervention.getType(), null, null));
        catalog.requireLocation(intervention.getServiceItemCode(), intervention.getProperty());
        capabilities.requireResourceContext(intervention.getOrganizationId(),intervention.getProperty());
        boolean reserveSlot = !isUnscheduled(intervention.getServiceItemCode());
        boolean remote = catalog.isRemote(intervention.getServiceItemCode());
        Long requestId = intervention.getServiceRequest() == null ? null : intervention.getServiceRequest().getId();
        if (intervention.getTeamId() != null) {
            check(intervention, requestId, "team", intervention.getTeamId());
            if (!remote) requirePropertyAllowed("team", intervention.getTeamId(), intervention.getProperty());
            if (reserveSlot && !isTeamDeclaredAvailable(intervention.getTeamId(), intervention.getScheduledDate(),
                    intervention.getEstimatedDurationHours())) {
                throw new AssignmentConflictException(
                        "L'équipe est indisponible sur ce créneau. Choisissez un autre créneau ou prestataire.");
            }
        }
        if (intervention.getAssignedUser() != null) {
            check(intervention, requestId, "user", intervention.getAssignedUser().getId());
            if (!remote) requirePropertyAllowed("user", intervention.getAssignedUser().getId(), intervention.getProperty());
            if (reserveSlot && !isUserDeclaredAvailable(intervention.getAssignedUser().getId(), intervention.getScheduledDate(),
                    intervention.getEstimatedDurationHours())) {
                throw new AssignmentConflictException("Le prestataire est indisponible sur ce créneau.");
            }
        }
        documentary.requireAssignment(intervention, serviceScope);
        materializeNeed(intervention);
    }

    /** Les aperçus utilisent les mêmes capacités et preuves que la commande sous verrou. */
    @Transactional(readOnly=true)
    public String previewQualification(Long teamId, String code, com.clenzy.model.Property property,
                                       java.time.LocalDateTime date, Long organizationId) {
        if (!capabilities.contextAllowed("team",teamId,code,organizationId)) return "ORGANIZATION_ACCESS_REQUIRED";
        if (!capabilities.supports("team", teamId, code)) return "CAPABILITY_REQUIRED";
        var mission = new Intervention();
        mission.setTeamId(teamId);
        mission.setServiceItemCode(code);
        mission.setProperty(property);
        mission.setScheduledDate(date);
        return documentary.assignmentEligible(mission) ? null : "DOCUMENTARY_REVIEW_REQUIRED";
    }

    @Transactional(readOnly=true)
    public boolean assignmentStillQualified(com.clenzy.model.ServiceRequest need,String kind,Long id) {
        if (!capabilities.contextAllowed(kind,id,need.getServiceItemCode(),need.getOrganizationId())
                || !capabilities.supports(kind,id,need.getServiceItemCode())) return false;
        var mission=new Intervention();
        mission.setProperty(need.getProperty()); mission.setServiceItemCode(need.getServiceItemCode());
        mission.setScheduledDate(need.getDesiredDate());
        if ("team".equals(kind)) mission.setTeamId(id);
        else { var user=new com.clenzy.model.User(); user.setId(id); mission.setAssignedUser(user); }
        return documentary.assignmentEligible(mission);
    }

    /** Une création directe utilise le même besoin que les demandes PMS, dans la même transaction. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void lockCommercialNeed(Long id, Long orgId) {
        var need=requests.findForMutation(id).orElseThrow();
        if (!java.util.Objects.equals(need.getOrganizationId(),orgId))
            throw new org.springframework.security.access.AccessDeniedException("Demande hors organisation");
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public com.clenzy.model.ServiceRequest prepareExistingNeed(Long id, Intervention mission) {
        var need=requests.findForMutation(id).orElseThrow();
        if (!java.util.Objects.equals(need.getOrganizationId(),mission.getOrganizationId())
                || !java.util.Objects.equals(need.getServiceItemCode(),mission.getServiceItemCode())
                || !java.util.Objects.equals(need.getProperty()==null?null:need.getProperty().getId(),mission.getProperty()==null?null:mission.getProperty().getId()))
            throw new org.springframework.security.access.AccessDeniedException("Accord hors demande");
        if (!"PUBLIC".equals(need.getAssignmentPhase()) || need.getConvertedInterventionId()!=null)
            throw new IllegalStateException("Cette demande n'est plus ouverte aux propositions");
        if (!catalog.doesNotReserveSlot(need.getServiceItemCode()) && !java.util.Objects.equals(need.getDesiredDate(),mission.getScheduledDate()))
            throw new IllegalStateException("Le créneau de la demande a changé");
        mission.setServiceRequest(need);
        return need;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public com.clenzy.model.ServiceRequest prepareCommercialNeed(Long quoteRequestId, Intervention mission) {
        if (quoteRequestId == null) throw new IllegalArgumentException("Sollicitation requise");
        var existing = requests.findByMarketplaceRequestId(quoteRequestId).orElse(null);
        if (existing != null) {
            if (!java.util.Objects.equals(existing.getOrganizationId(), mission.getOrganizationId())
                    || !java.util.Objects.equals(existing.getServiceItemCode(), mission.getServiceItemCode()))
                throw new IllegalStateException("Le besoin et la sollicitation ne correspondent plus");
            return existing;
        }
        catalog.requireLocation(mission.getServiceItemCode(), mission.getProperty());
        capabilities.requireResourceContext(mission.getOrganizationId(), mission.getProperty());
        if (mission.getRequestor() == null) throw new IllegalStateException("Demandeur requis pour créer le besoin");
        var need = buildNeed(mission);
        need.setMarketplaceRequestId(quoteRequestId);
        // Un devis détermine le prix et l'exécutant, sans second parcours de paiement PMS.
        need.setEstimatedCost(null);
        need.setAssignedToId(null);
        need.setAssignedToType(null);
        need.setStatus(com.clenzy.model.RequestStatus.PENDING);
        var saved = requests.save(need);
        mission.setServiceRequest(saved);
        return saved;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void closeCommercialPreparation(Long quoteRequestId) {
        requests.findByMarketplaceRequestId(quoteRequestId).ifPresent(need -> {
            if (need.getStatus() == com.clenzy.model.RequestStatus.PENDING && need.getAssignedToId() == null) {
                need.setStatus(com.clenzy.model.RequestStatus.CANCELLED);
                need.setAutoAssignStatus(null);
            }
        });
    }

    private void materializeNeed(Intervention mission) {
        if (mission.getServiceRequest() != null
                || mission.getRequestor() == null) return;
        mission.setServiceRequest(requests.save(buildNeed(mission)));
    }

    private com.clenzy.model.ServiceRequest buildNeed(Intervention mission) {
        var request = new com.clenzy.model.ServiceRequest();
        String title = mission.getTitle() == null ? "Prestation" : mission.getTitle();
        if (title.length() < 5) title = "Prestation " + title;
        request.setTitle(title.substring(0, Math.min(title.length(), 100)));
        String description = mission.getDescription();
        request.setDescription(description == null ? null : description.substring(0, Math.min(description.length(), 1000)));
        request.setOrganizationId(mission.getOrganizationId());
        request.setAutoAssignStatus("manual_hold");
        request.setProperty(mission.getProperty());
        request.setUser(mission.getRequestor());
        request.setServiceType(com.clenzy.model.ServiceType.OTHER);
        request.setServiceItemCode(mission.getServiceItemCode());
        request.setDesiredDate(mission.getScheduledDate());
        request.setEstimatedDurationHours(mission.getEstimatedDurationHours());
        request.setEstimatedCost(mission.getEstimatedCost());
        if (mission.getTeamId() != null) {
            request.setAssignedToType("team"); request.setAssignedToId(mission.getTeamId());
        } else if (mission.getAssignedUser() != null) {
            request.setAssignedToType("user"); request.setAssignedToId(mission.getAssignedUser().getId());
        }
        request.setStatus(request.getAssignedToId() == null ? com.clenzy.model.RequestStatus.PENDING
            : com.clenzy.model.RequestStatus.ASSIGNED);
        return request;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void requireDocumentaryAssignment(com.clenzy.model.ServiceRequest request, String kind, Long id) {
        var mission = new Intervention();
        mission.setProperty(request.getProperty());
        mission.setServiceItemCode(request.getServiceItemCode());
        capabilities.requireResourceContext(request.getOrganizationId(),request.getProperty());
        capabilities.requireContext(kind,id,request.getServiceItemCode(),request.getOrganizationId());
        capabilities.require(kind, id, request.getServiceItemCode());
        mission.setScheduledDate(request.getDesiredDate());
        mission.setType(request.getServiceType() == null ? "OTHER" : request.getServiceType().name());
        if ("team".equals(kind)) mission.setTeamId(id);
        else {
            var user = new com.clenzy.model.User();
            user.setId(id);
            mission.setAssignedUser(user);
        }
        try { documentary.requireAssignment(mission, null); }
        catch (IllegalStateException unavailable) { throw new AssignmentConflictException(unavailable.getMessage()); }
    }

    /** Verdict commun après verrouillage ; un refus permet à l'automatisation d'essayer une autre équipe. */
    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isTeamDeclaredAvailable(Long teamId, java.time.LocalDateTime start, Integer duration) {
        // Même durée de repli que la réservation commune des ressources.
        var finish = start.plusHours(duration != null && duration > 0 ? duration : 4);
        return availability.isAvailable(teamId, start, finish);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean isUserDeclaredAvailable(Long userId, java.time.LocalDateTime start, Integer duration) {
        return availability.isUserAvailable(userId, start, start.plusHours(duration != null && duration > 0 ? duration : 4));
    }

    public boolean isUnscheduled(String code) { return catalog.doesNotReserveSlot(code); }
    public boolean isRemote(String code) { return catalog.isRemote(code); }

    public java.util.List<Long> candidateTeamIds(String code, Long organizationId) {
        return capabilities.candidateTeamIds(code, organizationId);
    }

    public boolean supportsTeam(Long teamId, String code) {
        return capabilities.supports("team", teamId, code);
    }

    public void requireTeamCapability(Long teamId, String code, Long organizationId) {
        capabilities.requireContext("team", teamId, code, organizationId);
        capabilities.require("team", teamId, code);
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void requireUnscheduledAssignment(com.clenzy.model.ServiceRequest request, String kind, Long id) {
        catalog.requireLocation(request.getServiceItemCode(), request.getProperty());
        requests.lockAssignee(kind,id);
        if (!isRemote(request.getServiceItemCode())) requirePropertyAllowed(kind,id,request.getProperty());
        requireDocumentaryAssignment(request,kind,id);
    }

    public void requirePropertyAllowed(String kind, Long id, com.clenzy.model.Property property) {
        propertyEligibility.require(kind,id,property);
    }

    private void check(Intervention intervention, Long requestId, String type, Long targetId) {
        capabilities.requireContext(type,targetId,intervention.getServiceItemCode(),intervention.getOrganizationId());
        if (isUnscheduled(intervention.getServiceItemCode())) {
            requests.lockAssignee(type, targetId);
            capabilities.requireContext(type,targetId,intervention.getServiceItemCode(),intervention.getOrganizationId());
            capabilities.require(type, targetId, intervention.getServiceItemCode());
            return;
        }
        if (requests.interventionAssignmentConflicts(requestId, intervention.getId(), type, targetId,
                intervention.getScheduledDate(), intervention.getEstimatedDurationHours())) {
            throw new AssignmentConflictException();
        }
        capabilities.requireContext(type,targetId,intervention.getServiceItemCode(),intervention.getOrganizationId());
        capabilities.require(type, targetId, intervention.getServiceItemCode());
    }
}
