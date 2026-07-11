package com.clenzy.service;

import com.clenzy.dto.CreateInterventionRequest;
import com.clenzy.dto.InterventionResponse;
import com.clenzy.dto.UpdateInterventionRequest;
import com.clenzy.model.Intervention;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.exception.NotFoundException;
import com.clenzy.util.JwtRoleExtractor;
import com.clenzy.util.StringUtils;
import com.clenzy.exception.UnauthorizedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.InterventionType;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.UserRole;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class InterventionService {

    private static final Logger log = LoggerFactory.getLogger(InterventionService.class);
    private static final int MAX_PHOTOS_PER_INTERVENTION = 20;

    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;
    private final InterventionPhotoService photoService;
    private final InterventionMapper interventionMapper;
    private final InterventionAccessPolicy accessPolicy;
    private final com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine;
    private final com.clenzy.service.email.MissionAssignmentEmailComposer missionAssignmentEmailComposer;

    public InterventionService(InterventionRepository interventionRepository,
                               UserRepository userRepository,
                               TeamRepository teamRepository,
                               NotificationService notificationService,
                               TenantContext tenantContext,
                               InterventionPhotoService photoService,
                               InterventionMapper interventionMapper,
                               InterventionAccessPolicy accessPolicy,
                               com.clenzy.service.pricing.CleaningPricingEngine cleaningPricingEngine,
                               com.clenzy.service.email.MissionAssignmentEmailComposer missionAssignmentEmailComposer) {
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
        this.photoService = photoService;
        this.interventionMapper = interventionMapper;
        this.accessPolicy = accessPolicy;
        this.cleaningPricingEngine = cleaningPricingEngine;
        this.missionAssignmentEmailComposer = missionAssignmentEmailComposer;
    }

    public InterventionResponse create(CreateInterventionRequest request, Jwt jwt) {
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(tenantContext.getRequiredOrganizationId());
        interventionMapper.apply(request, intervention);

        if (userRole == UserRole.HOST) {
            intervention.setStatus(InterventionStatus.AWAITING_VALIDATION);
            intervention.setEstimatedCost(null);
        } else if (userRole.isPlatformStaff()) {
            if (intervention.getStatus() == null) {
                intervention.setStatus(InterventionStatus.PENDING);
            }
        } else {
            throw new UnauthorizedException("Vous n'avez pas le droit de creer des interventions");
        }

        intervention = interventionRepository.save(intervention);

        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String propertyName = intervention.getProperty() != null ? intervention.getProperty().getName() : "";

            // P2 : les admins voient le montant estimé (prix facturé côté org).
            String montant = intervention.getEstimatedCost() != null
                    ? " Cout estime: " + intervention.getEstimatedCost().stripTrailingZeros().toPlainString() + " EUR."
                    : "";
            if (userRole == UserRole.HOST) {
                notificationService.notifyAdminsAndManagers(
                        NotificationKey.INTERVENTION_AWAITING_VALIDATION,
                        "Intervention en attente de validation",
                        "L'intervention '" + intervention.getTitle() + "' sur " + propertyName + " est en attente de validation." + montant,
                        actionUrl);
            } else {
                notificationService.notifyAdminsAndManagers(
                        NotificationKey.INTERVENTION_CREATED,
                        "Nouvelle intervention creee",
                        "L'intervention '" + intervention.getTitle() + "' a ete creee sur " + propertyName + "." + montant,
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error create intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    public InterventionResponse update(Long id, UpdateInterventionRequest request, Jwt jwt) {
        log.debug("update - id: {}, assignedToType: {}, assignedToId: {}", id, request.assignedToType(), request.assignedToId());

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        log.debug("update - before: assignedTechnicianId={}, teamId={}", intervention.getAssignedTechnicianId(), intervention.getTeamId());

        accessPolicy.assertCanAccess(intervention, jwt);

        interventionMapper.applyUpdate(request, intervention);

        log.debug("update - after: assignedTechnicianId={}, teamId={}", intervention.getAssignedTechnicianId(), intervention.getTeamId());

        intervention = interventionRepository.save(intervention);

        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_UPDATED,
                    "Intervention mise a jour",
                    "L'intervention '" + intervention.getTitle() + "' a ete modifiee.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error update intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    @Transactional(readOnly = true)
    public InterventionResponse getById(Long id, Jwt jwt) {
        log.debug("getById - id: {}", id);

        try {
            Intervention intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

            log.debug("getById - found: {}, status: {}", intervention.getTitle(), intervention.getStatus());

            accessPolicy.assertCanAccess(intervention, jwt);

            return interventionMapper.convertToResponse(intervention);
        } catch (NotFoundException e) {
            log.error("getById - not found: {}", e.getMessage());
            throw e;
        } catch (UnauthorizedException e) {
            log.error("getById - unauthorized: {}", e.getMessage());
            throw e;
        } catch (Exception e) {
            log.error("getById - unexpected error for id={}", id, e);
            throw e;
        }
    }

    @Transactional(readOnly = true)
    public Page<InterventionResponse> listWithRoleBasedAccess(Pageable pageable, Long propertyId,
                                                        String type, String status, String priority,
                                                        String startDate, String endDate, Jwt jwt) {
        log.debug("listWithRoleBasedAccess - JWT present: {}, startDate={}, endDate={}", jwt != null, startDate, endDate);

        try {
            if (tenantContext.getOrganizationId() == null) {
                log.warn("listWithRoleBasedAccess - organizationId non resolu, retour page vide");
                return Page.empty(pageable);
            }

            UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
            log.debug("listWithRoleBasedAccess - role: {}", userRole);

            InterventionStatus statusEnum = null;
            if (status != null && !status.isEmpty()) {
                try {
                    statusEnum = InterventionStatus.fromString(status);
                    log.debug("listWithRoleBasedAccess - status converted: {} -> {}", status, statusEnum);
                } catch (IllegalArgumentException e) {
                    log.warn("listWithRoleBasedAccess - invalid status: {}", status);
                    return Page.empty(pageable);
                }
            }

            LocalDateTime startDateTime = null;
            LocalDateTime endDateTime = null;
            if (startDate != null && !startDate.isEmpty()) {
                try {
                    startDateTime = LocalDate.parse(startDate).atStartOfDay();
                } catch (Exception e) {
                    log.warn("listWithRoleBasedAccess - invalid startDate: {}", startDate);
                }
            }
            if (endDate != null && !endDate.isEmpty()) {
                try {
                    endDateTime = LocalDate.parse(endDate).plusDays(1).atStartOfDay();
                } catch (Exception e) {
                    log.warn("listWithRoleBasedAccess - invalid endDate: {}", endDate);
                }
            }

            Page<Intervention> interventionPage;

            if (userRole == UserRole.TECHNICIAN || userRole == UserRole.HOUSEKEEPER || userRole == UserRole.SUPERVISOR || userRole == UserRole.LAUNDRY || userRole == UserRole.EXTERIOR_TECH) {
                log.debug("listWithRoleBasedAccess - filtering for operational role: {}", userRole);

                String keycloakId = jwt.getSubject();
                String email = jwt.getClaimAsString("email");
                User currentUser = null;
                if (keycloakId != null) {
                    currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
                }
                if (currentUser == null && email != null) {
                    currentUser = userRepository.findByEmailHash(StringUtils.computeEmailHash(email)).orElse(null);
                }

                if (currentUser == null) {
                    log.debug("listWithRoleBasedAccess - user not found, returning empty page");
                    return Page.empty(pageable);
                }

                Long orgIdForQuery = tenantContext.isSystemOrg() ? null : tenantContext.getRequiredOrganizationId();

                interventionPage = interventionRepository.findByAssignedUserOrTeamWithFilters(
                        currentUser.getId(), propertyId, type, statusEnum, priority, pageable, orgIdForQuery,
                        startDateTime, endDateTime);
            } else {
                interventionPage = interventionRepository.findByFiltersWithRelations(
                        propertyId, type, statusEnum, priority, pageable, tenantContext.getRequiredOrganizationId(),
                        startDateTime, endDateTime);
            }

            log.debug("listWithRoleBasedAccess - total elements: {}", interventionPage.getTotalElements());

            return interventionPage.map(interventionMapper::convertToResponse);

        } catch (Exception e) {
            log.error("listWithRoleBasedAccess - error", e);
            throw e;
        }
    }

    public void delete(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformAdmin()) {
            throw new UnauthorizedException("Seuls les administrateurs peuvent supprimer des interventions");
        }

        try {
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_DELETED,
                    "Intervention supprimee",
                    "L'intervention '" + intervention.getTitle() + "' a ete supprimee.",
                    "/interventions");
        } catch (Exception e) {
            log.warn("Notification error delete intervention: {}", e.getMessage());
        }

        interventionRepository.deleteById(id);
    }

    public InterventionResponse assign(Long id, Long userId, Long teamId, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformStaff()) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent assigner des interventions");
        }

        Team assignedTeam = null;
        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new NotFoundException("Utilisateur non trouve"));
            intervention.setAssignedUser(user);
            intervention.setTeamId(null);
            applyHousekeeperRateIfSafe(intervention, userId);
        } else if (teamId != null) {
            assignedTeam = teamRepository.findById(teamId)
                    .orElseThrow(() -> new NotFoundException("Equipe non trouvee"));
            intervention.setTeamId(assignedTeam.getId());
            intervention.setAssignedUser(null);
        }

        intervention = interventionRepository.save(intervention);

        try {
            String actionUrl = "/interventions/" + intervention.getId();
            if (userId != null && intervention.getAssignedUser() != null) {
                String assignedKeycloakId = intervention.getAssignedUser().getKeycloakId();
                // P2 : le pro voit SA rémunération (estimatedCost résolu, tarif pro inclus).
                String remuneration = intervention.getEstimatedCost() != null
                        ? " Remuneration: " + intervention.getEstimatedCost().stripTrailingZeros().toPlainString() + " EUR."
                        : "";
                notificationService.notify(assignedKeycloakId, NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                        "Intervention assignee",
                        "Vous etes assigne a l'intervention '" + intervention.getTitle() + "'." + remuneration,
                        actionUrl);
                // P5 : email « mission assignée » POST-COMMIT (jamais d'effet externe en
                // transaction). Hors transaction active → envoi immédiat (best-effort).
                final Intervention assigned = intervention;
                final User assignedUser = intervention.getAssignedUser();
                Runnable sendEmail = () -> missionAssignmentEmailComposer.sendMissionAssignedEmail(assigned, assignedUser);
                if (org.springframework.transaction.support.TransactionSynchronizationManager.isSynchronizationActive()) {
                    org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                            new org.springframework.transaction.support.TransactionSynchronization() {
                                @Override
                                public void afterCommit() {
                                    sendEmail.run();
                                }
                            });
                } else {
                    sendEmail.run();
                }
            } else if (assignedTeam != null && assignedTeam.getMembers() != null) {
                List<String> memberIds = assignedTeam.getMembers().stream()
                        .map(m -> m.getUser() != null ? m.getUser().getKeycloakId() : null)
                        .filter(java.util.Objects::nonNull)
                        .toList();
                notificationService.notifyUsers(memberIds, NotificationKey.INTERVENTION_ASSIGNED_TO_TEAM,
                        "Intervention assignee a votre equipe",
                        "Votre equipe est assignee a l'intervention '" + intervention.getTitle() + "'.",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error assign intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToResponse(intervention);
    }

    /**
     * Moteur Ménage 2A : à l'assignation d'un PRO sur une intervention ménage,
     * réévalue le prix pratiqué (estimatedCost) avec son tarif (forfait logement
     * prioritaire, sinon taux horaire × durée normée). PRUDENCE : uniquement si
     * l'intervention n'est PAS engagée financièrement — statut PENDING, jamais
     * payée (paymentStatus PAID/PARTIALLY_PAID/REFUNDED exclus, paidAt null).
     * Le snapshot conseil (recommendedCost) reste INCHANGÉ.
     */
    private void applyHousekeeperRateIfSafe(Intervention intervention, Long userId) {
        if (intervention.getProperty() == null) return;
        if (intervention.getStatus() != InterventionStatus.PENDING) return;
        if (intervention.getPaidAt() != null) return;
        com.clenzy.model.PaymentStatus ps = intervention.getPaymentStatus();
        if (ps == com.clenzy.model.PaymentStatus.PAID
                || ps == com.clenzy.model.PaymentStatus.PARTIALLY_PAID
                || ps == com.clenzy.model.PaymentStatus.REFUNDED) {
            return;
        }
        String type = intervention.getType();
        boolean isCleaning = type != null && (type.equals(InterventionType.CLEANING.name())
                || type.equals(InterventionType.EXPRESS_CLEANING.name())
                || type.equals(InterventionType.DEEP_CLEANING.name()));
        if (!isCleaning) return;

        var resolved = cleaningPricingEngine.resolveCleaningPrice(
                intervention.getProperty(),
                type.equals(InterventionType.CLEANING.name())
                        ? com.clenzy.service.pricing.CleaningPricingEngine.STANDARD_CLEANING : type,
                userId);
        if (resolved.source() == com.clenzy.service.pricing.CleaningPricingEngine.CleaningPriceSource.HOUSEKEEPER_RATE) {
            intervention.setEstimatedCost(resolved.amount());
            log.info("Intervention {} : cout reevalue au tarif du pro {} → {}",
                    intervention.getId(), userId, resolved.amount());
        }
    }

    public InterventionResponse addPhotos(Long id, List<MultipartFile> photos, String photoType, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent recevoir des photos");
        }

        if (!"before".equals(photoType) && !"after".equals(photoType) && !"issue".equals(photoType)) {
            throw new IllegalArgumentException("photoType doit etre 'before', 'after' ou 'issue'");
        }

        long currentCount = photoService.getPhotoCount(intervention);
        if (currentCount + photos.size() > MAX_PHOTOS_PER_INTERVENTION) {
            throw new IllegalArgumentException(
                    "Nombre maximum de photos atteint (" + MAX_PHOTOS_PER_INTERVENTION
                    + "). Actuellement " + currentCount + ", tentative d'ajout de " + photos.size() + ".");
        }

        try {
            photoService.savePhotos(intervention, photos, photoType);

            intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

            return interventionMapper.convertToResponse(intervention);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'ajout des photos: " + e.getMessage(), e);
        }
    }

    public InterventionResponse deletePhoto(Long id, Long photoId, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        accessPolicy.assertCanAccess(intervention, jwt);

        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir des photos supprimees");
        }

        photoService.deletePhoto(photoId, id);

        intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

        return interventionMapper.convertToResponse(intervention);
    }
}
