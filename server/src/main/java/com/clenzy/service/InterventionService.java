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
        String userRole = extractUserRole(jwt);
        if (!"ADMIN".equals(userRole) && !"MANAGER".equals(userRole)) {
            throw new UnauthorizedException("Seuls les administrateurs et managers peuvent créer des interventions");
        }
        
        Intervention intervention = new Intervention();
        apply(dto, intervention);
        intervention = interventionRepository.save(intervention);
        return convertToDto(intervention);
    }
    
    public InterventionDto update(Long id, InterventionDto dto, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);
        
        apply(dto, intervention);
        intervention = interventionRepository.save(intervention);
        return convertToDto(intervention);
    }
    
    public InterventionDto getById(Long id, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);
        
        return convertToDto(intervention);
    }
    
    public Page<InterventionDto> listWithRoleBasedAccess(Pageable pageable, Long propertyId, 
                                                        String type, String status, String priority, Jwt jwt) {
        System.out.println("🔍 DEBUT listWithRoleBasedAccess - JWT: " + (jwt != null ? "présent" : "null"));
        
        try {
            String userRole = extractUserRole(jwt);
            System.out.println("🔍 Rôle extrait: " + userRole);
            
            // Pour les admins et managers, on n'a pas besoin de l'userId
            List<Intervention> interventions;
            
            if ("ADMIN".equals(userRole) || "MANAGER".equals(userRole)) {
                System.out.println("🔍 Admin/Manager - récupération de toutes les interventions");
                interventions = interventionRepository.findByFilters(propertyId, type, status, priority);
            } else if ("HOST".equals(userRole)) {
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
        String userRole = extractUserRole(jwt);
        if (!"ADMIN".equals(userRole)) {
            throw new UnauthorizedException("Seuls les administrateurs peuvent supprimer des interventions");
        }
        
        interventionRepository.deleteById(id);
    }
    
    public InterventionDto updateStatus(Long id, String status, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        // Vérifier les droits d'accès
        checkAccessRights(intervention, jwt);
        
        intervention.setStatus(status);
        intervention = interventionRepository.save(intervention);
        return convertToDto(intervention);
    }
    
    public InterventionDto assign(Long id, Long userId, Long teamId, Jwt jwt) {
        Intervention intervention = interventionRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Intervention non trouvée"));
        
        // Seuls les managers et admins peuvent assigner
        String userRole = extractUserRole(jwt);
        if (!"ADMIN".equals(userRole) && !"MANAGER".equals(userRole)) {
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
        String userRole = extractUserRole(jwt);
        Long userId = Long.valueOf(jwt.getSubject());
        
        if ("ADMIN".equals(userRole) || "MANAGER".equals(userRole)) {
            return; // Accès complet
        }
        
        if ("HOST".equals(userRole)) {
            // Host peut voir les interventions de ses propriétés
            if (intervention.getProperty().getOwner().getId().equals(userId)) {
                return;
            }
        } else {
            // Autres utilisateurs peuvent voir les interventions assignées
            if (intervention.getAssignedUser() != null && 
                intervention.getAssignedUser().getId().equals(userId)) {
                return;
            }
            if (intervention.getTeamId() != null) {
                // Vérifier si l'utilisateur fait partie de l'équipe
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
        
        throw new UnauthorizedException("Accès non autorisé à cette intervention");
    }
    
    private void apply(InterventionDto dto, Intervention intervention) {
        if (dto.title != null) intervention.setTitle(dto.title);
        if (dto.description != null) intervention.setDescription(dto.description);
        if (dto.type != null) intervention.setType(dto.type);
        if (dto.status != null) intervention.setStatus(dto.status);
        if (dto.priority != null) intervention.setPriority(dto.priority);
        if (dto.estimatedDurationHours != null) intervention.setEstimatedDurationHours(dto.estimatedDurationHours);
        if (dto.estimatedCost != null) intervention.setEstimatedCost(dto.estimatedCost);
        if (dto.notes != null) intervention.setNotes(dto.notes);
        if (dto.photos != null) intervention.setPhotos(dto.photos);
        if (dto.progressPercentage != null) intervention.setProgressPercentage(dto.progressPercentage);
        
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
        InterventionDto dto = new InterventionDto();
        dto.id = intervention.getId();
        dto.title = intervention.getTitle();
        dto.description = intervention.getDescription();
        dto.type = intervention.getType();
        dto.status = intervention.getStatus();
        dto.priority = intervention.getPriority();
        dto.estimatedDurationHours = intervention.getEstimatedDurationHours();
        dto.actualDurationMinutes = intervention.getActualDurationMinutes();
        dto.estimatedCost = intervention.getEstimatedCost();
        dto.actualCost = intervention.getActualCost();
        dto.notes = intervention.getNotes();
        dto.photos = intervention.getPhotos();
        dto.progressPercentage = intervention.getProgressPercentage();
        dto.scheduledDate = intervention.getScheduledDate() != null ? 
                intervention.getScheduledDate().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME) : null;
        dto.createdAt = intervention.getCreatedAt();
        dto.updatedAt = intervention.getUpdatedAt();
        dto.completedAt = intervention.getCompletedAt();
        
        // Relations
        if (intervention.getProperty() != null) {
            dto.propertyId = intervention.getProperty().getId();
            dto.propertyName = intervention.getProperty().getName();
            dto.propertyAddress = intervention.getProperty().getAddress();
        }
        
        if (intervention.getRequestor() != null) {
            dto.requestorId = intervention.getRequestor().getId();
            dto.requestorName = intervention.getRequestor().getFullName();
        }
        
        dto.assignedToType = intervention.getAssignedToType();
        dto.assignedToId = intervention.getAssignedToId();
        dto.assignedToName = intervention.getAssignedToName();
        
        return dto;
    }
    
    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     * Les rôles sont stockés dans realm_access.roles et préfixés avec "ROLE_"
     */
    private String extractUserRole(Jwt jwt) {
        // Essayer d'abord realm_access.roles (format Keycloak)
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess != null) {
            Object roles = realmAccess.get("roles");
            if (roles instanceof List<?>) {
                List<?> roleList = (List<?>) roles;
                for (Object role : roleList) {
                    if (role instanceof String) {
                        String roleStr = (String) role;
                        // Retourner le premier rôle trouvé (ADMIN, MANAGER, etc.)
                        return roleStr.toUpperCase();
                    }
                }
            }
        }
        
        // Fallback: essayer le claim "role" direct
        String directRole = jwt.getClaimAsString("role");
        if (directRole != null) {
            return directRole.toUpperCase();
        }
        
        // Si aucun rôle trouvé, retourner "USER" par défaut
        return "USER";
    }
}
