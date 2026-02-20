package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InterventionPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.InterventionPhoto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.NotificationKey;
import com.clenzy.model.UserRole;
import com.clenzy.config.KafkaConfig;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import java.util.Arrays;
import org.springframework.web.multipart.MultipartFile;
import java.util.Base64;

@Service
@Transactional
public class InterventionService {

    private static final Logger log = LoggerFactory.getLogger(InterventionService.class);

    private final InterventionRepository interventionRepository;
    private final InterventionPhotoRepository interventionPhotoRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final NotificationService notificationService;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final TenantContext tenantContext;

    public InterventionService(InterventionRepository interventionRepository,
                              InterventionPhotoRepository interventionPhotoRepository,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             TeamRepository teamRepository,
                             NotificationService notificationService,
                             KafkaTemplate<String, Object> kafkaTemplate,
                             TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.interventionPhotoRepository = interventionPhotoRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.notificationService = notificationService;
        this.kafkaTemplate = kafkaTemplate;
        this.tenantContext = tenantContext;
    }

    public InterventionDto create(InterventionDto dto, Jwt jwt) {
        // Vérifier que l'utilisateur a le droit de créer des interventions
        UserRole userRole = extractUserRole(jwt);

        Intervention intervention = new Intervention();
        intervention.setOrganizationId(tenantContext.getRequiredOrganizationId());
        apply(dto, intervention);

        // Si c'est un HOST (owner), mettre le statut en AWAITING_VALIDATION et ne pas permettre de coût estimé
        if (userRole == UserRole.HOST) {
            intervention.setStatus(InterventionStatus.AWAITING_VALIDATION);
            intervention.setEstimatedCost(null); // Le manager définira le coût lors de la validation
        } else if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
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

        return convertToDto(intervention);
    }

    public InterventionDto update(Long id, InterventionDto dto, Jwt jwt) {
        log.debug("update - id: {}, assignedToType: {}, assignedToId: {}", id, dto.assignedToType, dto.assignedToId);

        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        log.debug("update - before: assignedTechnicianId={}, teamId={}", intervention.getAssignedTechnicianId(), intervention.getTeamId());

        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);

        apply(dto, intervention);

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

        return convertToDto(intervention);
    }

    public InterventionDto getById(Long id, Jwt jwt) {
        log.debug("getById - id: {}", id);

        try {
            Intervention intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

            log.debug("getById - found: {}, status: {}", intervention.getTitle(), intervention.getStatus());

            // Vérifier les droits d'accès
            checkAccessRights(intervention, jwt);

            return convertToDto(intervention);
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

    public Page<InterventionDto> listWithRoleBasedAccess(Pageable pageable, Long propertyId,
                                                        String type, String status, String priority, Jwt jwt) {
        log.debug("listWithRoleBasedAccess - JWT present: {}", jwt != null);

        try {
            UserRole userRole = extractUserRole(jwt);
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
            if (userRole == UserRole.TECHNICIAN || userRole == UserRole.HOUSEKEEPER || userRole == UserRole.SUPERVISOR) {
                log.debug("listWithRoleBasedAccess - filtering for operational role: {}", userRole);

                // Identifier l'utilisateur depuis le JWT
                String keycloakId = jwt.getSubject();
                String email = jwt.getClaimAsString("email");
                User currentUser = null;
                if (keycloakId != null) {
                    currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
                }
                if (currentUser == null && email != null) {
                    currentUser = userRepository.findByEmailHash(computeEmailHash(email)).orElse(null);
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
            return interventionPage.map(this::convertToDto);

        } catch (Exception e) {
            log.error("listWithRoleBasedAccess - error", e);
            throw e;
        }
    }

    public void delete(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Seuls les admins peuvent supprimer
        UserRole userRole = extractUserRole(jwt);
        if (userRole != UserRole.ADMIN) {
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

        return convertToDto(intervention);
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

        return convertToDto(intervention);
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

        return convertToDto(intervention);
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

        return convertToDto(intervention);
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
            // Convertir le photoType en majuscules pour la base de données
            String photoTypeUpper = "before".equals(photoType) ? "BEFORE" : "AFTER";

            // Stocker les photos directement en BYTEA dans la table intervention_photos avec le type
            for (MultipartFile photo : photos) {
                if (!photo.isEmpty()) {
                    byte[] photoData = photo.getBytes();
                    String contentType = photo.getContentType();
                    if (contentType == null) {
                        contentType = "image/jpeg"; // Par défaut
                    }

                    InterventionPhoto interventionPhoto = new InterventionPhoto();
                    interventionPhoto.setIntervention(intervention);
                    interventionPhoto.setPhotoData(photoData);
                    interventionPhoto.setContentType(contentType);
                    interventionPhoto.setFileName(photo.getOriginalFilename());
                    interventionPhoto.setPhotoType(photoTypeUpper); // Stocker le type de photo

                    interventionPhotoRepository.save(interventionPhoto);
                }
            }

            // Ne plus stocker les URLs base64 dans before_photos_urls/after_photos_urls
            // Les photos sont maintenant uniquement dans intervention_photos avec le type

            log.debug("Photos {} added to intervention: id={}, count={}", photoType, intervention.getId(), photos.size());

            // Recharger l'intervention pour avoir les photos dans le DTO
            intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

            return convertToDto(intervention);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de l'ajout des photos: " + e.getMessage(), e);
        }
    }

    /**
     * Convertit les photos BYTEA en base64 data URLs pour le DTO (compatibilité frontend)
     * Récupère toutes les photos (avant et après)
     */
    private String convertPhotosToBase64Urls(Intervention intervention) {
        List<InterventionPhoto> photos = interventionPhotoRepository.findAllByInterventionId(intervention.getId(), tenantContext.getRequiredOrganizationId());

        if (photos.isEmpty()) {
            // Si pas de photos dans la nouvelle table, vérifier l'ancien champ (compatibilité)
            return intervention.getPhotos();
        }

        List<String> base64Urls = new ArrayList<>();
        for (InterventionPhoto photo : photos) {
            byte[] photoData = photo.getPhotoData();
            String contentType = photo.getContentType() != null ? photo.getContentType() : "image/jpeg";
            String base64 = Base64.getEncoder().encodeToString(photoData);
            String dataUrl = "data:" + contentType + ";base64," + base64;
            base64Urls.add(dataUrl);
        }

        // Retourner comme JSON array pour compatibilité avec le frontend
        return "[" + base64Urls.stream()
                .map(url -> "\"" + url.replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",")) + "]";
    }

    /**
     * Convertit les photos BYTEA en base64 data URLs pour un type spécifique (BEFORE ou AFTER)
     */
    private String convertPhotosToBase64UrlsByType(Intervention intervention, String photoType) {
        String photoTypeUpper = "before".equals(photoType) ? "BEFORE" : "AFTER";
        List<InterventionPhoto> photos = interventionPhotoRepository.findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
            intervention.getId(),
            photoTypeUpper,
            tenantContext.getRequiredOrganizationId()
        );

        if (photos.isEmpty()) {
            // Si pas de photos dans la nouvelle table, vérifier l'ancien champ (compatibilité)
            String legacyUrls = "before".equals(photoType)
                ? intervention.getBeforePhotosUrls()
                : intervention.getAfterPhotosUrls();
            return legacyUrls;
        }

        List<String> base64Urls = new ArrayList<>();
        for (InterventionPhoto photo : photos) {
            byte[] photoData = photo.getPhotoData();
            String contentType = photo.getContentType() != null ? photo.getContentType() : "image/jpeg";
            String base64 = Base64.getEncoder().encodeToString(photoData);
            String dataUrl = "data:" + contentType + ";base64," + base64;
            base64Urls.add(dataUrl);
        }

        // Retourner comme JSON array pour compatibilité avec le frontend
        return "[" + base64Urls.stream()
                .map(url -> "\"" + url.replace("\"", "\\\"") + "\"")
                .collect(Collectors.joining(",")) + "]";
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

        return convertToDto(intervention);
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

        return convertToDto(intervention);
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

        return convertToDto(intervention);
    }

    public InterventionDto assign(Long id, Long userId, Long teamId, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Seuls les managers et admins peuvent assigner
        UserRole userRole = extractUserRole(jwt);
        if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
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

        return convertToDto(intervention);
    }

    /**
     * Valider une intervention et définir le coût estimé (Manager uniquement)
     * Change le statut de AWAITING_VALIDATION à AWAITING_PAYMENT
     */
    public InterventionDto validateIntervention(Long id, java.math.BigDecimal estimatedCost, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));

        // Vérifier que seul un manager peut valider
        UserRole userRole = extractUserRole(jwt);
        if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
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

        return convertToDto(intervention);
    }

    private void checkAccessRights(Intervention intervention, Jwt jwt) {
        UserRole userRole = extractUserRole(jwt);

        // Tenant isolation: always verify the intervention belongs to the caller's organization
        Long callerOrgId = tenantContext.getRequiredOrganizationId();
        if (intervention.getOrganizationId() != null
                && !intervention.getOrganizationId().equals(callerOrgId)) {
            log.warn("Cross-tenant access attempt: intervention orgId={} vs caller orgId={}",
                    intervention.getOrganizationId(), callerOrgId);
            throw new UnauthorizedException("Acces refuse : intervention hors de votre organisation");
        }

        // Pour les admins et managers, acces complet au sein de leur organisation
        if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
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
            currentUser = userRepository.findByEmailHash(computeEmailHash(email)).orElse(null);
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

    private void apply(InterventionDto dto, Intervention intervention) {
        if (dto.title != null) intervention.setTitle(dto.title);
        if (dto.description != null) intervention.setDescription(dto.description);
        if (dto.type != null) intervention.setType(dto.type);
        if (dto.status != null) {
            try {
                InterventionStatus status = InterventionStatus.fromString(dto.status);
                intervention.setStatus(status);
                log.debug("apply - status updated: {}", status);
            } catch (IllegalArgumentException e) {
                log.warn("apply - invalid status: {}", dto.status);
                throw new IllegalArgumentException("Statut invalide: " + dto.status + ". Valeurs autorisées: " +
                    Arrays.stream(InterventionStatus.values()).map(InterventionStatus::name).collect(Collectors.joining(", ")));
            }
        }
        if (dto.priority != null) intervention.setPriority(dto.priority);
        if (dto.estimatedDurationHours != null) intervention.setEstimatedDurationHours(dto.estimatedDurationHours);
        if (dto.estimatedCost != null) intervention.setEstimatedCost(dto.estimatedCost);
        if (dto.notes != null) intervention.setNotes(dto.notes);
        // Ne plus mettre à jour le champ photos (déprécié, utiliser intervention_photos)
        // if (dto.photos != null) intervention.setPhotos(dto.photos);
        if (dto.progressPercentage != null) intervention.setProgressPercentage(dto.progressPercentage);

        // Gestion de l'assignation
        if (dto.assignedToType != null && dto.assignedToId != null) {
            if ("user".equals(dto.assignedToType)) {
                // Assigner à un utilisateur
                intervention.setAssignedTechnicianId(dto.assignedToId);
                intervention.setTeamId(null); // Réinitialiser l'équipe

                // Mettre à jour l'utilisateur assigné
                User assignedUser = userRepository.findById(dto.assignedToId)
                        .orElse(null);
                if (assignedUser != null) {
                    intervention.setAssignedUser(assignedUser);
                    log.debug("apply - user assigned: {}", assignedUser.getFullName());
                }
            } else if ("team".equals(dto.assignedToType)) {
                // Assigner à une équipe
                intervention.setTeamId(dto.assignedToId);
                intervention.setAssignedTechnicianId(null); // Réinitialiser l'utilisateur
                intervention.setAssignedUser(null); // Réinitialiser l'utilisateur assigné

                // Vérifier que l'équipe existe
                Team assignedTeam = teamRepository.findById(dto.assignedToId).orElse(null);
                if (assignedTeam != null) {
                    log.debug("apply - team assigned: {}", assignedTeam.getName());
                } else {
                    log.warn("apply - team not found for id: {}", dto.assignedToId);
                }
            }
        }

        if (dto.propertyId != null) {
            Property property = propertyRepository.findById(dto.propertyId)
                    .orElseThrow(() -> new NotFoundException("Propriété non trouvée"));
            intervention.setProperty(property);
        }

        if (dto.requestorId != null) {
            User requestor = userRepository.findById(dto.requestorId)
                    .orElseThrow(() -> new NotFoundException("Demandeur non trouvé"));
            intervention.setRequestor(requestor);
        }

        if (dto.scheduledDate != null) {
            LocalDateTime scheduledDate = LocalDateTime.parse(dto.scheduledDate,
                    DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            intervention.setScheduledDate(scheduledDate);
        }
    }

    private InterventionDto convertToDto(Intervention intervention) {
        try {
            InterventionDto dto = new InterventionDto();

            // Propriétés de base
            dto.id = intervention.getId();
            dto.title = intervention.getTitle();
            dto.description = intervention.getDescription();
            dto.type = intervention.getType();
            dto.status = intervention.getStatus().name(); // Convertir l'énumération en String
            dto.priority = intervention.getPriority();
            dto.estimatedDurationHours = intervention.getEstimatedDurationHours();
            dto.actualDurationMinutes = intervention.getActualDurationMinutes();
            dto.estimatedCost = intervention.getEstimatedCost();
            dto.actualCost = intervention.getActualCost();
            dto.notes = intervention.getNotes();
            // Pour compatibilité avec l'ancien système, convertir les photos BYTEA en base64 data URLs
            dto.photos = convertPhotosToBase64Urls(intervention);
            // Récupérer les photos par type depuis intervention_photos
            dto.beforePhotosUrls = convertPhotosToBase64UrlsByType(intervention, "before");
            dto.afterPhotosUrls = convertPhotosToBase64UrlsByType(intervention, "after");
            dto.validatedRooms = intervention.getValidatedRooms();
            dto.completedSteps = intervention.getCompletedSteps();
            dto.progressPercentage = intervention.getProgressPercentage();

            // Dates
            if (intervention.getScheduledDate() != null) {
                dto.scheduledDate = intervention.getScheduledDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            } else {
                dto.scheduledDate = null;
            }

            dto.createdAt = intervention.getCreatedAt();
            dto.updatedAt = intervention.getUpdatedAt();
            dto.completedAt = intervention.getCompletedAt();
            dto.startTime = intervention.getStartTime();
            dto.endTime = intervention.getEndTime();

            // Relations
            if (intervention.getProperty() != null) {
                dto.propertyId = intervention.getProperty().getId();
                dto.propertyName = intervention.getProperty().getName();
                dto.propertyAddress = intervention.getProperty().getAddress();
                if (intervention.getProperty().getType() != null) {
                    // Expose a stable machine value for the frontend (ex: apartment, guest_room, cottage)
                    dto.propertyType = intervention.getProperty().getType().name().toLowerCase();
                }
            }

            if (intervention.getRequestor() != null) {
                dto.requestorId = intervention.getRequestor().getId();
                dto.requestorName = intervention.getRequestor().getFullName();
            }

            // Gestion de l'assignation
            if (intervention.getAssignedToType() != null) {
                dto.assignedToType = intervention.getAssignedToType();
                dto.assignedToId = intervention.getAssignedToId();

                if ("user".equals(intervention.getAssignedToType()) && intervention.getAssignedUser() != null) {
                    dto.assignedToName = intervention.getAssignedUser().getFullName();
                } else if ("team".equals(intervention.getAssignedToType()) && intervention.getTeamId() != null) {
                    // Récupérer le vrai nom de l'équipe depuis la base
                    Team assignedTeam = teamRepository.findById(intervention.getTeamId()).orElse(null);
                    if (assignedTeam != null) {
                        dto.assignedToName = assignedTeam.getName();
                    } else {
                        dto.assignedToName = "Équipe inconnue";
                        log.warn("convertToDto - team not found for id: {}", intervention.getTeamId());
                    }
                } else {
                    dto.assignedToName = null;
                }
            } else {
                dto.assignedToType = null;
                dto.assignedToId = null;
                dto.assignedToName = null;
            }

            // Champs de paiement
            if (intervention.getPaymentStatus() != null) {
                dto.paymentStatus = intervention.getPaymentStatus().name();
            }
            dto.stripePaymentIntentId = intervention.getStripePaymentIntentId();
            dto.stripeSessionId = intervention.getStripeSessionId();
            dto.paidAt = intervention.getPaidAt();
            dto.preferredTimeSlot = intervention.getPreferredTimeSlot();

            return dto;
        } catch (Exception e) {
            log.error("convertToDto - error converting intervention id={}", intervention.getId(), e);
            throw e;
        }
    }

    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     * Les rôles sont stockés dans realm_access.roles et préfixés avec "ROLE_"
     */
    private UserRole extractUserRole(Jwt jwt) {
        try {
            // Essayer d'abord realm_access.roles (format Keycloak)
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            log.debug("extractUserRole - realm_access: {}", realmAccess);

            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                log.debug("extractUserRole - roles: {}", roles);

                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;

                    // D'abord, chercher les rôles métier prioritaires (ADMIN, MANAGER)
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") ||
                                roleStr.equals("uma_authorization") ||
                                roleStr.equals("default-roles-clenzy")) {
                                continue;
                            }

                            // Mapper "realm-admin" vers ADMIN
                            if (roleStr.equalsIgnoreCase("realm-admin")) {
                                return UserRole.ADMIN;
                            }

                            // Chercher les rôles métier directs (ADMIN, MANAGER, etc.)
                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                // Prioriser ADMIN et MANAGER
                                if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
                                    return userRole;
                                }
                            } catch (IllegalArgumentException e) {
                                // Continuer à chercher
                            }
                        }
                    }

                    // Si ADMIN ou MANAGER non trouvé, retourner le premier rôle métier valide
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") ||
                                roleStr.equals("uma_authorization") ||
                                roleStr.equals("default-roles-clenzy") ||
                                roleStr.equalsIgnoreCase("realm-admin")) {
                                continue;
                            }

                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                log.debug("extractUserRole - returning business role: {}", userRole);
                                return userRole;
                            } catch (IllegalArgumentException e) {
                                // Continuer à chercher
                            }
                        }
                    }
                }
            }

            // Fallback: essayer le claim "role" direct
            String directRole = jwt.getClaimAsString("role");
            log.debug("extractUserRole - direct role claim: {}", directRole);

            if (directRole != null) {
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    log.warn("extractUserRole - unknown direct role: {}, falling back to HOST", directRole);
                    return UserRole.HOST;
                }
            }

            // Si aucun rôle trouvé, retourner HOST par défaut
            log.debug("extractUserRole - no role found, returning HOST default");
            return UserRole.HOST;
        } catch (Exception e) {
            log.error("extractUserRole - error during extraction", e);
            return UserRole.HOST; // Fallback en cas d'erreur
        }
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

    private static String computeEmailHash(String email) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hashBytes = digest.digest(email.toLowerCase().trim().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hashBytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 non disponible", e);
        }
    }
}
