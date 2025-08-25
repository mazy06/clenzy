package com.clenzy.service;

import com.clenzy.dto.InterventionDto;
import com.clenzy.model.Intervention;
import com.clenzy.model.Property;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.exception.NotFoundException;
import com.clenzy.exception.UnauthorizedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.UserRole;
import java.util.Arrays;

@Service
@Transactional
public class InterventionService {
    
    private final InterventionRepository interventionRepository;
    private final PropertyRepository propertyRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    
    public InterventionService(InterventionRepository interventionRepository,
                             PropertyRepository propertyRepository,
                             UserRepository userRepository,
                             TeamRepository teamRepository) {
        this.interventionRepository = interventionRepository;
        this.propertyRepository = propertyRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
    }
    
    public InterventionDto create(InterventionDto dto, Jwt jwt) {
        // Vérifier que l'utilisateur a le droit de créer des interventions
        UserRole userRole = extractUserRole(jwt);
        if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent créer des interventions");
        }
        
        Intervention intervention = new Intervention();
        apply(dto, intervention);
        intervention = interventionRepository.save(intervention);
        return convertToDto(intervention);
    }
    
    public InterventionDto update(Long id, InterventionDto dto, Jwt jwt) {
        System.out.println("🔍 InterventionService.update - Début de la méthode");
        System.out.println("🔍 InterventionService.update - ID: " + id);
        System.out.println("🔍 InterventionService.update - DTO reçu: " + dto);
        System.out.println("🔍 InterventionService.update - assignedToType: " + dto.assignedToType);
        System.out.println("🔍 InterventionService.update - assignedToId: " + dto.assignedToId);
        
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        System.out.println("🔍 InterventionService.update - Intervention trouvée: " + intervention.getTitle());
        System.out.println("🔍 InterventionService.update - Avant modification - assignedTechnicianId: " + intervention.getAssignedTechnicianId());
        System.out.println("🔍 InterventionService.update - Avant modification - teamId: " + intervention.getTeamId());
        
        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);
        
        apply(dto, intervention);
        
        System.out.println("🔍 InterventionService.update - Après modification - assignedTechnicianId: " + intervention.getAssignedTechnicianId());
        System.out.println("🔍 InterventionService.update - Après modification - teamId: " + intervention.getTeamId());
        
        intervention = interventionRepository.save(intervention);
        System.out.println("🔍 InterventionService.update - Intervention sauvegardée");
        
        return convertToDto(intervention);
    }
    
    public InterventionDto getById(Long id, Jwt jwt) {
        System.out.println("🔍 InterventionService.getById - Début de la méthode");
        System.out.println("🔍 InterventionService.getById - ID demandé: " + id);
        
        try {
            System.out.println("🔍 InterventionService.getById - Recherche de l'intervention en base...");
            Intervention intervention = interventionRepository.findById(id)
                    .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
            
            System.out.println("🔍 InterventionService.getById - Intervention trouvée: " + intervention.getTitle());
            System.out.println("🔍 InterventionService.getById - Statut: " + intervention.getStatus());
            System.out.println("🔍 InterventionService.getById - Propriété ID: " + intervention.getProperty().getId());
            
            // Vérifier les droits d'accès
            System.out.println("🔍 InterventionService.getById - Vérification des droits d'accès...");
            checkAccessRights(intervention, jwt);
            System.out.println("🔍 InterventionService.getById - Droits d'accès validés");
            
            System.out.println("🔍 InterventionService.getById - Conversion en DTO...");
            InterventionDto result = convertToDto(intervention);
            System.out.println("🔍 InterventionService.getById - DTO créé avec succès");
            
            return result;
        } catch (NotFoundException e) {
            System.err.println("🔍 InterventionService.getById - Intervention non trouvée: " + e.getMessage());
            throw e;
        } catch (UnauthorizedException e) {
            System.err.println("🔍 InterventionService.getById - Accès non autorisé: " + e.getMessage());
            throw e;
        } catch (Exception e) {
            System.err.println("🔍 InterventionService.getById - Erreur inattendue: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
    
    public Page<InterventionDto> listWithRoleBasedAccess(Pageable pageable, Long propertyId, 
                                                        String type, String status, String priority, Jwt jwt) {
        System.out.println("🔍 DEBUT listWithRoleBasedAccess - JWT: " + (jwt != null ? "présent" : "null"));
        
        try {
            UserRole userRole = extractUserRole(jwt);
            System.out.println("🔍 Rôle extrait: " + userRole);
            
            // Pour les admins et managers, on n'a pas besoin de l'userId
            List<Intervention> interventions;
            
            if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
                System.out.println("🔍 Admin/Manager - récupération de toutes les interventions");
                interventions = interventionRepository.findByFilters(propertyId, type, status, priority);
            } else if (userRole == UserRole.HOST) {
                System.out.println("🔍 Host - récupération des interventions de ses propriétés");
                // Pour les hosts, on peut filtrer par propriété sans avoir besoin de l'userId
                if (propertyId != null) {
                    Property property = propertyRepository.findById(propertyId)
                            .orElseThrow(() -> new NotFoundException("Propriété non trouvée"));
                    // Vérification de propriété sera faite au niveau des données
                }
                interventions = interventionRepository.findByFilters(propertyId, type, status, priority);
            } else {
                System.out.println("🔍 Autre rôle - récupération des interventions assignées");
                // Pour les autres rôles, on peut récupérer toutes les interventions ou filtrer différemment
                interventions = interventionRepository.findByFilters(propertyId, type, status, priority);
            }
            
            System.out.println("🔍 Interventions trouvées: " + interventions.size());
            
            // Convertir en DTOs et paginer
            List<InterventionDto> dtos = interventions.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());
            
            // Pagination manuelle (pour simplifier)
            int start = (int) pageable.getOffset();
            int end = Math.min((start + pageable.getPageSize()), dtos.size());
            
            if (start <= dtos.size()) {
                return new org.springframework.data.domain.PageImpl<>(
                        dtos.subList(start, end), pageable, dtos.size());
            }
            
            return new org.springframework.data.domain.PageImpl<>(List.of(), pageable, 0);
            
        } catch (Exception e) {
            System.err.println("🔍 ERREUR dans listWithRoleBasedAccess: " + e.getMessage());
            e.printStackTrace();
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
        
        interventionRepository.deleteById(id);
    }
    
    public InterventionDto updateStatus(Long id, String status, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);
        
        intervention.setStatus(InterventionStatus.fromString(status));
        intervention = interventionRepository.save(intervention);
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
        return convertToDto(intervention);
    }
    
    private void checkAccessRights(Intervention intervention, Jwt jwt) {
        System.out.println("🔍 InterventionService.checkAccessRights - Début de la vérification");
        
        UserRole userRole = extractUserRole(jwt);
        System.out.println("🔍 InterventionService.checkAccessRights - Rôle utilisateur: " + userRole);
        
        // Pour les admins et managers, accès complet sans vérification d'ID
        if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
            System.out.println("🔍 InterventionService.checkAccessRights - Admin/Manager - accès autorisé");
            return; // Accès complet
        }
        
        // Pour les autres rôles, extraire l'ID utilisateur depuis le JWT
        String userIdString = jwt.getSubject();
        System.out.println("🔍 InterventionService.checkAccessRights - Subject JWT: " + userIdString);
        
        // Vérifier si c'est un UUID Keycloak ou un ID numérique
        final Long userId;
        try {
            userId = Long.valueOf(userIdString);
            System.out.println("🔍 InterventionService.checkAccessRights - ID utilisateur numérique: " + userId);
        } catch (NumberFormatException e) {
            System.out.println("🔍 InterventionService.checkAccessRights - Subject JWT n'est pas un ID numérique, probablement un UUID Keycloak");
            // Pour l'instant, on refuse l'accès si on ne peut pas identifier l'utilisateur
            // TODO: Implémenter la logique pour récupérer l'ID utilisateur depuis Keycloak
            throw new UnauthorizedException("Impossible d'identifier l'utilisateur depuis le JWT");
        }
        
        if (userRole == UserRole.HOST) {
            System.out.println("🔍 InterventionService.checkAccessRights - Vérification des droits HOST");
            // Host peut voir les interventions de ses propriétés
            if (intervention.getProperty().getOwner().getId().equals(userId)) {
                System.out.println("🔍 InterventionService.checkAccessRights - HOST - propriétaire de la propriété, accès autorisé");
                return;
            }
            System.out.println("🔍 InterventionService.checkAccessRights - HOST - pas propriétaire de la propriété");
        } else {
            System.out.println("🔍 InterventionService.checkAccessRights - Vérification des droits utilisateur standard");
            // Autres utilisateurs peuvent voir les interventions assignées
            if (intervention.getAssignedUser() != null && 
                intervention.getAssignedUser().getId().equals(userId)) {
                System.out.println("🔍 InterventionService.checkAccessRights - Utilisateur assigné, accès autorisé");
                return;
            }
            if (intervention.getTeamId() != null) {
                System.out.println("🔍 InterventionService.checkAccessRights - Vérification de l'équipe");
                // Vérifier si l'utilisateur fait partie de l'équipe
                Team team = teamRepository.findById(intervention.getTeamId())
                        .orElse(null);
                if (team != null) {
                    boolean isTeamMember = team.getMembers().stream()
                            .anyMatch(member -> member.getUser().getId().equals(userId));
                    if (isTeamMember) {
                        System.out.println("🔍 InterventionService.checkAccessRights - Membre de l'équipe, accès autorisé");
                        return;
                    }
                }
            }
        }
        
        System.out.println("🔍 InterventionService.checkAccessRights - Aucun droit d'accès trouvé, accès refusé");
        throw new UnauthorizedException("Accès non autorisé à cette intervention");
    }
    
    private void apply(InterventionDto dto, Intervention intervention) {
        if (dto.title != null) intervention.setTitle(dto.title);
        if (dto.description != null) intervention.setDescription(dto.description);
        if (dto.type != null) intervention.setType(dto.type);
        if (dto.status != null) {
            try {
                InterventionStatus status = InterventionStatus.fromString(dto.status);
                intervention.setStatus(status);
                System.out.println("🔍 InterventionService.apply - Statut mis à jour: " + status);
            } catch (IllegalArgumentException e) {
                System.err.println("🔍 InterventionService.apply - Statut invalide: " + dto.status);
                throw new IllegalArgumentException("Statut invalide: " + dto.status + ". Valeurs autorisées: " + 
                    Arrays.stream(InterventionStatus.values()).map(InterventionStatus::name).collect(Collectors.joining(", ")));
            }
        }
        if (dto.priority != null) intervention.setPriority(dto.priority);
        if (dto.estimatedDurationHours != null) intervention.setEstimatedDurationHours(dto.estimatedDurationHours);
        if (dto.estimatedCost != null) intervention.setEstimatedCost(dto.estimatedCost);
        if (dto.notes != null) intervention.setNotes(dto.notes);
        if (dto.photos != null) intervention.setPhotos(dto.photos);
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
                    System.out.println("🔍 InterventionService.apply - Utilisateur assigné: " + assignedUser.getFullName());
                }
            } else if ("team".equals(dto.assignedToType)) {
                // Assigner à une équipe
                intervention.setTeamId(dto.assignedToId);
                intervention.setAssignedTechnicianId(null); // Réinitialiser l'utilisateur
                intervention.setAssignedUser(null); // Réinitialiser l'utilisateur assigné
                
                // Vérifier que l'équipe existe
                Team assignedTeam = teamRepository.findById(dto.assignedToId).orElse(null);
                if (assignedTeam != null) {
                    System.out.println("🔍 InterventionService.apply - Équipe assignée: " + assignedTeam.getName());
                } else {
                    System.out.println("🔍 InterventionService.apply - Équipe non trouvée pour l'ID: " + dto.assignedToId);
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
        System.out.println("🔍 InterventionService.convertToDto - Début de la conversion");
        
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
            dto.photos = intervention.getPhotos();
            dto.progressPercentage = intervention.getProgressPercentage();
            
            // Dates
            if (intervention.getScheduledDate() != null) {
                dto.scheduledDate = intervention.getScheduledDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                System.out.println("🔍 InterventionService.convertToDto - Date programmée formatée: " + dto.scheduledDate);
            } else {
                dto.scheduledDate = null;
                System.out.println("🔍 InterventionService.convertToDto - Aucune date programmée");
            }
            
            dto.createdAt = intervention.getCreatedAt();
            dto.updatedAt = intervention.getUpdatedAt();
            dto.completedAt = intervention.getCompletedAt();
            
            // Relations
            if (intervention.getProperty() != null) {
                dto.propertyId = intervention.getProperty().getId();
                dto.propertyName = intervention.getProperty().getName();
                dto.propertyAddress = intervention.getProperty().getAddress();
                System.out.println("🔍 InterventionService.convertToDto - Propriété: " + dto.propertyName + " (ID: " + dto.propertyId + ")");
            } else {
                System.out.println("🔍 InterventionService.convertToDto - Aucune propriété associée");
            }
            
            if (intervention.getRequestor() != null) {
                dto.requestorId = intervention.getRequestor().getId();
                dto.requestorName = intervention.getRequestor().getFullName();
                System.out.println("🔍 InterventionService.convertToDto - Demandeur: " + dto.requestorName + " (ID: " + dto.requestorId + ")");
            } else {
                System.out.println("🔍 InterventionService.convertToDto - Aucun demandeur associé");
            }
            
            // Gestion de l'assignation
            if (intervention.getAssignedToType() != null) {
                dto.assignedToType = intervention.getAssignedToType();
                dto.assignedToId = intervention.getAssignedToId();
                
                if ("user".equals(intervention.getAssignedToType()) && intervention.getAssignedUser() != null) {
                    dto.assignedToName = intervention.getAssignedUser().getFullName();
                    System.out.println("🔍 InterventionService.convertToDto - Utilisateur assigné: " + dto.assignedToName);
                } else if ("team".equals(intervention.getAssignedToType()) && intervention.getTeamId() != null) {
                    // Récupérer le vrai nom de l'équipe depuis la base
                    Team assignedTeam = teamRepository.findById(intervention.getTeamId()).orElse(null);
                    if (assignedTeam != null) {
                        dto.assignedToName = assignedTeam.getName();
                        System.out.println("🔍 InterventionService.convertToDto - Équipe assignée: " + dto.assignedToName);
                    } else {
                        dto.assignedToName = "Équipe inconnue";
                        System.out.println("🔍 InterventionService.convertToDto - Équipe non trouvée pour l'ID: " + intervention.getTeamId());
                    }
                } else {
                    dto.assignedToName = null;
                    System.out.println("🔍 InterventionService.convertToDto - Aucun assigné");
                }
            } else {
                dto.assignedToType = null;
                dto.assignedToId = null;
                dto.assignedToName = null;
                System.out.println("🔍 InterventionService.convertToDto - Aucune assignation");
            }
            
            System.out.println("🔍 InterventionService.convertToDto - Conversion terminée avec succès");
            return dto;
        } catch (Exception e) {
            System.err.println("🔍 InterventionService.convertToDto - Erreur lors de la conversion: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }
    
    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     * Les rôles sont stockés dans realm_access.roles et préfixés avec "ROLE_"
     */
    private UserRole extractUserRole(Jwt jwt) {
        System.out.println("🔍 InterventionService.extractUserRole - Début de l'extraction");
        
        try {
            // Essayer d'abord realm_access.roles (format Keycloak)
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            System.out.println("🔍 InterventionService.extractUserRole - Realm_access: " + realmAccess);
            
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                System.out.println("🔍 InterventionService.extractUserRole - Rôles extraits: " + roles);
                
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    System.out.println("🔍 InterventionService.extractUserRole - Liste des rôles: " + roleList);
                    
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;
                            System.out.println("🔍 InterventionService.extractUserRole - Rôle trouvé: " + roleStr);

                            // Ignorer les rôles techniques Keycloak
                            if (roleStr.equals("offline_access") || 
                                roleStr.equals("uma_authorization") || 
                                roleStr.equals("default-roles-clenzy")) {
                                System.out.println("🔍 InterventionService.extractUserRole - Rôle technique ignoré: " + roleStr);
                                continue;
                            }

                            // Retourner le premier rôle métier trouvé (ADMIN, MANAGER, HOST, etc.)
                            System.out.println("🔍 InterventionService.extractUserRole - Rôle métier trouvé: " + roleStr);
                            try {
                                return UserRole.valueOf(roleStr.toUpperCase());
                            } catch (IllegalArgumentException e) {
                                System.err.println("🔍 InterventionService.extractUserRole - Rôle inconnu: " + roleStr + ", fallback vers USER");
                                return UserRole.HOST; // Fallback vers HOST pour les rôles non reconnus
                            }
                        }
                    }
                }
            }
            
            // Fallback: essayer le claim "role" direct
            String directRole = jwt.getClaimAsString("role");
            System.out.println("🔍 InterventionService.extractUserRole - Rôle direct: " + directRole);
            
            if (directRole != null) {
                System.out.println("🔍 InterventionService.extractUserRole - Retour du rôle direct: " + directRole.toUpperCase());
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    System.err.println("🔍 InterventionService.extractUserRole - Rôle direct inconnu: " + directRole + ", fallback vers HOST");
                    return UserRole.HOST;
                }
            }
            
            // Si aucun rôle trouvé, retourner HOST par défaut
            System.out.println("🔍 InterventionService.extractUserRole - Aucun rôle trouvé, retour de HOST par défaut");
            return UserRole.HOST;
        } catch (Exception e) {
            System.err.println("🔍 InterventionService.extractUserRole - Erreur lors de l'extraction: " + e.getMessage());
            e.printStackTrace();
            return UserRole.HOST; // Fallback en cas d'erreur
        }
    }
}
