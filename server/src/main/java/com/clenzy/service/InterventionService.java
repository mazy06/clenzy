package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
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

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.UserRole;
import com.clenzy.config.KafkaConfig;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.multipart.MultipartFile;

@Service
@Transactional
public class InterventionService {

    private static final Logger log = LoggerFactory.getLogger(InterventionService.class);

    private final InterventionRepository interventionRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final NotificationService notificationService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TenantContext tenantContext;
    private final InterventionPhotoService photoService;
    private final InterventionMapper interventionMapper;

    public InterventionService(InterventionRepository interventionRepository,
                               UserRepository userRepository,
                               TeamRepository teamRepository,
                               NotificationService notificationService,
                               KafkaTemplate<String, Object> kafkaTemplate,
                               TenantContext tenantContext,
                               InterventionPhotoService photoService,
                               InterventionMapper interventionMapper) {
        this.interventionRepository = interventionRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
        this.photoService = photoService;
        this.interventionMapper = interventionMapper;
    }

    public InterventionDto create(InterventionDto dto, Jwt jwt) {
        // Vérifier que l'utilisateur a le droit de créer des interventions
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(tenantContext.getRequiredOrganizationId());
        interventionMapper.apply(dto, intervention);

        // Si c'est un HOST (owner), mettre le statut en AWAITING_VALIDATION et ne pas permettre de coût estimé
        if (userRole == UserRole.HOST) {
            intervention.setStatus(InterventionStatus.AWAITING_VALIDATION);
            intervention.setEstimatedCost(null); // Le manager définira le coût lors de la validation
        } else if (userRole.isPlatformStaff()) {
            // Les admins et managers peuvent créer directement avec un statut PENDING
            if (intervention.getStatus() == null) {
                intervention.setStatus(InterventionStatus.PENDING);
            }
        } else {
            throw new UnauthorizedException("Vous n'avez pas le droit de créer des interventions");
        }

        intervention = interventionRepository.save(intervention);

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String propertyName = intervention.getProperty() != null ? intervention.getProperty().getName() : "";

            if (userRole == UserRole.HOST) {
                notificationService.notifyAdminsAndManagers(
                        NotificationKey.INTERVENTION_AWAITING_VALIDATION,
                        "Intervention en attente de validation",
                        "L'intervention '" + intervention.getTitle() + "' sur " + propertyName + " est en attente de validation.",
                        actionUrl);
            } else {
                notificationService.notifyAdminsAndManagers(
                        NotificationKey.INTERVENTION_CREATED,
                        "Nouvelle intervention creee",
                        "L'intervention '" + intervention.getTitle() + "' a ete creee sur " + propertyName + ".",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error create intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    public InterventionDto update(Long id, InterventionDto dto, Jwt jwt) {
        log.debug("update - id: {}, assignedToType: {}, assignedToId: {}", id, dto.assignedToType, dto.assignedToId);

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        log.debug("update - before: assignedTechnicianId={}, teamId={}", intervention.getAssignedTechnicianId(), intervention.getTeamId());

        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);

        interventionMapper.apply(dto, intervention);

        log.debug("update - after: assignedTechnicianId={}, teamId={}", intervention.getAssignedTechnicianId(), intervention.getTeamId());

        intervention = interventionRepository.save(intervention);

        // ─── Notifications ──────────────────────────────────────────────────
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

        return interventionMapper.convertToDto(intervention);
    }

    @Transactional(readOnly = true)
    public InterventionDto getById(Long id, Jwt jwt) {
        log.debug("getById - id: {}", id);

        try {
            Intervention intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

            log.debug("getById - found: {}, status: {}", intervention.getTitle(), intervention.getStatus());

            // Vérifier les droits d'accès
            checkAccessRights(intervention, jwt);

            return interventionMapper.convertToDto(intervention);
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
    public Page<InterventionDto> listWithRoleBasedAccess(Pageable pageable, Long propertyId,
                                                        String type, String status, String priority, Jwt jwt) {
        log.debug("listWithRoleBasedAccess - JWT present: {}", jwt != null);

        try {
            // Verifier que le contexte d'organisation est resolu
            if (tenantContext.getOrganizationId() == null) {
                log.warn("listWithRoleBasedAccess - organizationId non resolu, retour page vide");
                return Page.empty(pageable);
            }

            UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
            log.debug("listWithRoleBasedAccess - role: {}", userRole);

            // Convertir les Strings en enums si nécessaire
            InterventionStatus statusEnum = null;
            if (status != null && !status.isEmpty()) {
                try {
                    statusEnum = InterventionStatus.fromString(status);
                    log.debug("listWithRoleBasedAccess - status converted: {} -> {}", status, statusEnum);
                } catch (IllegalArgumentException e) {
                    log.warn("listWithRoleBasedAccess - invalid status: {}", status);
                    // Retourner une page vide si le statut est invalide
                    return Page.empty(pageable);
                }
            }

            Page<Intervention> interventionPage;

            // Pour TECHNICIAN, HOUSEKEEPER et SUPERVISOR, filtrer par assignation
            if (userRole == UserRole.TECHNICIAN || userRole == UserRole.HOUSEKEEPER || userRole == UserRole.SUPERVISOR || userRole == UserRole.LAUNDRY || userRole == UserRole.EXTERIOR_TECH) {
                log.debug("listWithRoleBasedAccess - filtering for operational role: {}", userRole);

                // Identifier l'utilisateur depuis le JWT
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

                log.debug("listWithRoleBasedAccess - user found: id={}, email={}", currentUser.getId(), currentUser.getEmail());

                // Filtrer les interventions assignées à cet utilisateur (individuellement ou via équipe)
                interventionPage = interventionRepository.findByAssignedUserOrTeamWithFilters(
                        currentUser.getId(), propertyId, type, statusEnum, priority, pageable, tenantContext.getRequiredOrganizationId());
            } else {
                // Pour les admins et managers, voir toutes les interventions
                log.debug("listWithRoleBasedAccess - no filter for role: {}", userRole);
                interventionPage = interventionRepository.findByFiltersWithRelations(
                        propertyId, type, statusEnum, priority, pageable, tenantContext.getRequiredOrganizationId());
            }

            log.debug("listWithRoleBasedAccess - total elements: {}", interventionPage.getTotalElements());

            // Convertir en DTOs avec pagination
            return interventionPage.map(interventionMapper::convertToDto);

        } catch (Exception e) {
            log.error("listWithRoleBasedAccess - error", e);
            throw e;
        }
    }

    public void delete(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Seuls les admins peuvent supprimer
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformAdmin()) {
            throw new UnauthorizedException("Seuls les administrateurs peuvent supprimer des interventions");
        }

        // ─── Notifications (avant suppression) ─────────────────────────────
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

    public InterventionDto updateStatus(Long id, String status, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);

        InterventionStatus newStatus = InterventionStatus.fromString(status);

        // Validate state machine transition
        InterventionStatus currentStatus = intervention.getStatus();
        if (!currentStatus.canTransitionTo(newStatus)) {
            throw new IllegalStateException(
                    "Transition invalide : " + currentStatus.name() + " → " + newStatus.name()
                    + ". Transitions autorisees depuis " + currentStatus.name() + " : "
                    + java.util.Arrays.toString(
                        java.util.stream.Stream.of(InterventionStatus.values())
                            .filter(currentStatus::canTransitionTo)
                            .map(Enum::name)
                            .toArray()));
        }

        intervention.setStatus(newStatus);
        intervention = interventionRepository.save(intervention);

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;

            if (newStatus == InterventionStatus.CANCELLED) {
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_CANCELLED,
                        "Intervention annulee",
                        "L'intervention '" + intervention.getTitle() + "' a ete annulee.",
                        actionUrl);
                notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_CANCELLED,
                        "Intervention annulee",
                        "L'intervention '" + intervention.getTitle() + "' a ete annulee.",
                        actionUrl);
            } else {
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_STATUS_CHANGED,
                        "Statut intervention modifie",
                        "L'intervention '" + intervention.getTitle() + "' est passee au statut " + newStatus.name() + ".",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error updateStatus intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    /**
     * Démarrer une intervention (changer le statut en IN_PROGRESS)
     * Accessible aux TECHNICIAN, HOUSEKEEPER et SUPERVISOR pour leurs interventions assignées
     */
    public InterventionDto startIntervention(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention peut être démarrée
        if (intervention.getStatus() == InterventionStatus.COMPLETED) {
            throw new IllegalStateException("Une intervention terminée ne peut pas être démarrée. Utilisez reopenIntervention pour la rouvrir.");
        }
        if (intervention.getStatus() == InterventionStatus.CANCELLED) {
            throw new IllegalStateException("Une intervention annulée ne peut pas être démarrée");
        }

        // Changer le statut en IN_PROGRESS
        intervention.setStatus(InterventionStatus.IN_PROGRESS);
        intervention.setStartTime(LocalDateTime.now());

        // Initialiser la progression à 0% si elle n'est pas déjà définie
        if (intervention.getProgressPercentage() == null || intervention.getProgressPercentage() == 0) {
            intervention.setProgressPercentage(0);
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Intervention started: id={}, status={}", intervention.getId(), intervention.getStatus());

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_STARTED,
                    "Intervention demarree",
                    "L'intervention '" + intervention.getTitle() + "' a ete demarree.",
                    actionUrl);
            notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_STARTED,
                    "Intervention demarree",
                    "L'intervention '" + intervention.getTitle() + "' a ete demarree.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error startIntervention: {}", e.getMessage());
        }

        // ─── Génération automatique du BON_INTERVENTION ──────────────────────
        try {
            // Destinataire : le technicien assigné (ou le propriétaire si pas de technicien)
            String emailTo = "";
            if (intervention.getAssignedUser() != null && intervention.getAssignedUser().getEmail() != null) {
                emailTo = intervention.getAssignedUser().getEmail();
            } else if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
                emailTo = intervention.getProperty().getOwner().getEmail();
            }

            kafkaTemplate.send(
                KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                "bon-intervention-" + intervention.getId(),
                Map.of(
                    "documentType", "BON_INTERVENTION",
                    "referenceId", intervention.getId(),
                    "referenceType", "intervention",
                    "emailTo", emailTo != null ? emailTo : ""
                )
            );
            log.debug("Kafka BON_INTERVENTION event published for intervention: {}", intervention.getId());
        } catch (Exception e) {
            log.warn("Kafka publish error BON_INTERVENTION: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    /**
     * Rouvrir une intervention terminée pour permettre des modifications
     * Accessible aux TECHNICIAN, HOUSEKEEPER, SUPERVISOR, MANAGER et ADMIN
     */
    public InterventionDto reopenIntervention(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention est terminée
        if (intervention.getStatus() != InterventionStatus.COMPLETED) {
            throw new IllegalStateException("Seules les interventions terminées peuvent être rouvertes");
        }

        // Changer le statut en IN_PROGRESS pour permettre les modifications
        intervention.setStatus(InterventionStatus.IN_PROGRESS);
        // Ne pas réinitialiser completedAt pour garder l'historique

        // Recalculer la progression en fonction des étapes complétées
        // Si l'étape "after_photos" n'est pas dans completedSteps, la progression ne devrait pas être à 100%
        try {
            String completedStepsJson = intervention.getCompletedSteps();
            if (completedStepsJson != null && !completedStepsJson.isEmpty()) {
                // Vérifier simplement si "after_photos" est dans la chaîne JSON
                // (plus simple que de parser complètement le JSON)
                boolean hasAfterPhotos = completedStepsJson.contains("\"after_photos\"") ||
                                         completedStepsJson.contains("'after_photos'");

                // Si "after_photos" n'est pas dans les étapes complétées, recalculer la progression
                if (!hasAfterPhotos) {
                    // La progression ne peut pas être à 100% si l'étape finale n'est pas complétée
                    // On va la mettre à environ 89% (étape 1 + étape 2 complétées, étape 3 manquante)
                    // Le frontend recalculera plus précisément
                    if (intervention.getProgressPercentage() != null && intervention.getProgressPercentage() >= 100) {
                        intervention.setProgressPercentage(89);
                        log.debug("Progress recalculated on reopen: 89% (final step not completed)");
                    }
                }
            } else {
                // Si aucune étape complétée n'est définie, réinitialiser la progression
                if (intervention.getProgressPercentage() != null && intervention.getProgressPercentage() >= 100) {
                    intervention.setProgressPercentage(0);
                    log.debug("Progress reset on reopen: 0%");
                }
            }
        } catch (Exception e) {
            log.warn("Error recalculating progress on reopen: {}", e.getMessage());
            // En cas d'erreur, garder la progression actuelle mais la forcer à moins de 100%
            if (intervention.getProgressPercentage() != null && intervention.getProgressPercentage() >= 100) {
                intervention.setProgressPercentage(89);
            }
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Intervention reopened: id={}, status={}, progress={}%", intervention.getId(), intervention.getStatus(), intervention.getProgressPercentage());

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_REOPENED,
                    "Intervention rouverte",
                    "L'intervention '" + intervention.getTitle() + "' a ete rouverte pour modifications.",
                    actionUrl);
            notificationService.notifyAdminsAndManagers(NotificationKey.INTERVENTION_REOPENED,
                    "Intervention rouverte",
                    "L'intervention '" + intervention.getTitle() + "' a ete rouverte.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error reopenIntervention: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    /**
     * Mettre à jour la progression d'une intervention
     * Accessible aux TECHNICIAN, HOUSEKEEPER et SUPERVISOR pour leurs interventions assignées
     */
    public InterventionDto updateProgress(Long id, Integer progressPercentage, Jwt jwt) {
        if (progressPercentage < 0 || progressPercentage > 100) {
            throw new IllegalArgumentException("La progression doit être entre 0 et 100");
        }

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Mettre à jour la progression
        intervention.setProgressPercentage(progressPercentage);

        // Si la progression atteint 100%, marquer comme terminée
        if (progressPercentage == 100 && intervention.getStatus() != InterventionStatus.COMPLETED) {
            intervention.setStatus(InterventionStatus.COMPLETED);
            intervention.setCompletedAt(LocalDateTime.now());
            if (intervention.getEndTime() == null) {
                intervention.setEndTime(LocalDateTime.now());
            }

            // Notifier les parties concernées (managers, admins, hosts)
            notifyInterventionCompleted(intervention);

            // ─── Génération automatique VALIDATION_FIN_MISSION ───────────────
            try {
                String emailToHost = (intervention.getProperty() != null && intervention.getProperty().getOwner() != null)
                        ? intervention.getProperty().getOwner().getEmail() : "";
                String emailToTech = (intervention.getAssignedUser() != null)
                        ? intervention.getAssignedUser().getEmail() : "";

                // Envoyer au Host
                kafkaTemplate.send(
                    KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                    "validation-fin-mission-host-" + intervention.getId(),
                    Map.of(
                        "documentType", "VALIDATION_FIN_MISSION",
                        "referenceId", intervention.getId(),
                        "referenceType", "intervention",
                        "emailTo", emailToHost != null ? emailToHost : ""
                    )
                );

                // Envoyer au Technicien (si différent du Host)
                if (emailToTech != null && !emailToTech.isEmpty() && !emailToTech.equals(emailToHost)) {
                    kafkaTemplate.send(
                        KafkaConfig.TOPIC_DOCUMENT_GENERATE,
                        "validation-fin-mission-tech-" + intervention.getId(),
                        Map.of(
                            "documentType", "VALIDATION_FIN_MISSION",
                            "referenceId", intervention.getId(),
                            "referenceType", "intervention",
                            "emailTo", emailToTech
                        )
                    );
                }
                log.debug("Kafka VALIDATION_FIN_MISSION event(s) published for intervention: {}", intervention.getId());
            } catch (Exception e) {
                log.warn("Kafka publish error VALIDATION_FIN_MISSION: {}", e.getMessage());
            }
        }

        intervention = interventionRepository.save(intervention);
        log.debug("Progress updated: id={}, progress={}%", intervention.getId(), progressPercentage);

        return interventionMapper.convertToDto(intervention);
    }

    public InterventionDto addPhotos(Long id, List<MultipartFile> photos, String photoType, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention est en cours
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent recevoir des photos");
        }

        // Valider le photoType
        if (!"before".equals(photoType) && !"after".equals(photoType)) {
            throw new IllegalArgumentException("photoType doit être 'before' ou 'after'");
        }

        try {
            photoService.savePhotos(intervention, photos, photoType);

            // Reload to include the newly saved photos in the DTO
            intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvee"));

            return interventionMapper.convertToDto(intervention);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'ajout des photos: " + e.getMessage(), e);
        }
    }

    public InterventionDto updateNotes(Long id, String notes, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention est en cours
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent être commentées");
        }

        intervention.setNotes(notes);
        intervention = interventionRepository.save(intervention);

        log.debug("Notes updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToDto(intervention);
    }

    public InterventionDto updateValidatedRooms(Long id, String validatedRooms, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention est en cours
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs pièces validées");
        }

        intervention.setValidatedRooms(validatedRooms);
        intervention = interventionRepository.save(intervention);

        log.debug("Validated rooms updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToDto(intervention);
    }

    public InterventionDto updateCompletedSteps(Long id, String completedSteps, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier les droits d'accès (doit être assigné à l'utilisateur)
        checkAccessRights(intervention, jwt);

        // Vérifier que l'intervention est en cours
        if (intervention.getStatus() != InterventionStatus.IN_PROGRESS) {
            throw new IllegalArgumentException("Seules les interventions en cours peuvent avoir leurs étapes complétées mises à jour");
        }

        intervention.setCompletedSteps(completedSteps);
        intervention = interventionRepository.save(intervention);

        log.debug("Completed steps updated for intervention: {}", intervention.getId());

        return interventionMapper.convertToDto(intervention);
    }

    public InterventionDto assign(Long id, Long userId, Long teamId, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Seuls les managers et admins peuvent assigner
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformStaff()) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent assigner des interventions");
        }

        if (userId != null) {
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé"));
            intervention.setAssignedUser(user);
            intervention.setTeamId(null);
        } else if (teamId != null) {
            Team team = teamRepository.findById(teamId)
                    .orElseThrow(() -> new NotFoundException("Équipe non trouvée"));
            intervention.setTeamId(team.getId());
            intervention.setAssignedUser(null);
        }

        intervention = interventionRepository.save(intervention);

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            if (userId != null && intervention.getAssignedUser() != null) {
                String assignedKeycloakId = intervention.getAssignedUser().getKeycloakId();
                notificationService.notify(assignedKeycloakId, NotificationKey.INTERVENTION_ASSIGNED_TO_USER,
                        "Intervention assignee",
                        "Vous etes assigne a l'intervention '" + intervention.getTitle() + "'.",
                        actionUrl);
            } else if (teamId != null) {
                Team team = teamRepository.findById(teamId).orElse(null);
                if (team != null && team.getMembers() != null) {
                    List<String> memberIds = team.getMembers().stream()
                            .map(m -> m.getUser() != null ? m.getUser().getKeycloakId() : null)
                            .filter(java.util.Objects::nonNull)
                            .toList();
                    notificationService.notifyUsers(memberIds, NotificationKey.INTERVENTION_ASSIGNED_TO_TEAM,
                            "Intervention assignee a votre equipe",
                            "Votre equipe est assignee a l'intervention '" + intervention.getTitle() + "'.",
                            actionUrl);
                }
            }
        } catch (Exception e) {
            log.warn("Notification error assign intervention: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    /**
     * Valider une intervention et définir le coût estimé (Manager uniquement)
     * Change le statut de AWAITING_VALIDATION à AWAITING_PAYMENT
     */
    public InterventionDto validateIntervention(Long id, java.math.BigDecimal estimatedCost, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier que seul un manager peut valider
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);
        if (!userRole.isPlatformStaff()) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent valider des interventions");
        }

        // Vérifier que l'intervention est en attente de validation
        if (intervention.getStatus() != InterventionStatus.AWAITING_VALIDATION) {
            throw new RuntimeException("Cette intervention n'est pas en attente de validation");
        }

        // Définir le coût estimé et changer le statut
        intervention.setEstimatedCost(estimatedCost);
        intervention.setStatus(InterventionStatus.AWAITING_PAYMENT);
        intervention = interventionRepository.save(intervention);

        // ─── Notifications ──────────────────────────────────────────────────
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String ownerKeycloakId = intervention.getProperty() != null && intervention.getProperty().getOwner() != null
                    ? intervention.getProperty().getOwner().getKeycloakId() : null;
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_VALIDATED,
                    "Intervention validee",
                    "L'intervention '" + intervention.getTitle() + "' a ete validee. Cout estime: " + estimatedCost + " EUR.",
                    actionUrl);
            notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_AWAITING_PAYMENT,
                    "Paiement requis",
                    "Un paiement est requis pour l'intervention '" + intervention.getTitle() + "'. Montant: " + estimatedCost + " EUR.",
                    actionUrl);
        } catch (Exception e) {
            log.warn("Notification error validateIntervention: {}", e.getMessage());
        }

        return interventionMapper.convertToDto(intervention);
    }

    private void checkAccessRights(Intervention intervention, Jwt jwt) {
        UserRole userRole = JwtRoleExtractor.extractUserRole(jwt);

        // Tenant isolation: always verify the intervention belongs to the caller's organization
        Long callerOrgId = tenantContext.getRequiredOrganizationId();
        if (intervention.getOrganizationId() != null
                && !intervention.getOrganizationId().equals(callerOrgId)) {
            log.warn("Cross-tenant access attempt: intervention orgId={} vs caller orgId={}",
                    intervention.getOrganizationId(), callerOrgId);
            throw new UnauthorizedException("Acces refuse : intervention hors de votre organisation");
        }

        // Pour les admins et managers, acces complet au sein de leur organisation
        if (userRole.isPlatformStaff()) {
            return;
        }

        // Pour les autres roles, identifier l'utilisateur depuis le JWT
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
            throw new UnauthorizedException("Impossible d'identifier l'utilisateur depuis le JWT");
        }

        Long userId = currentUser.getId();

        if (userRole == UserRole.HOST) {
            if (intervention.getProperty().getOwner().getId().equals(userId)) {
                return;
            }
        } else {
            if (intervention.getAssignedUser() != null
                    && intervention.getAssignedUser().getId().equals(userId)) {
                return;
            }
            if (intervention.getTeamId() != null) {
                Team team = teamRepository.findById(intervention.getTeamId())
                        .orElse(null);
                if (team != null) {
                    boolean isTeamMember = team.getMembers().stream()
                            .anyMatch(member -> member.getUser().getId().equals(userId));
                    if (isTeamMember) {
                        return;
                    }
                }
            }
        }

        throw new UnauthorizedException("Acces non autorise a cette intervention");
    }

    /**
     * Notifier les parties concernees qu'une intervention est terminee.
     */
    private void notifyInterventionCompleted(Intervention intervention) {
        try {
            String actionUrl = "/interventions/" + intervention.getId();
            String propertyName = intervention.getProperty() != null ? intervention.getProperty().getName() : "";

            // Notifier les admins/managers
            notificationService.notifyAdminsAndManagers(
                    NotificationKey.INTERVENTION_COMPLETED,
                    "Intervention terminee",
                    "L'intervention '" + intervention.getTitle() + "' sur " + propertyName + " est terminee.",
                    actionUrl);

            // Notifier le proprietaire (HOST)
            if (intervention.getProperty() != null && intervention.getProperty().getOwner() != null) {
                String ownerKeycloakId = intervention.getProperty().getOwner().getKeycloakId();
                notificationService.notify(ownerKeycloakId, NotificationKey.INTERVENTION_COMPLETED,
                        "Intervention terminee",
                        "L'intervention '" + intervention.getTitle() + "' sur votre propriete " + propertyName + " est terminee.",
                        actionUrl);
            }
        } catch (Exception e) {
            log.warn("Notification error interventionCompleted: {}", e.getMessage());
        }
    }

}
