package com.clenzy.service;

import com.clenzy.dto.TeamDto;
import com.clenzy.model.Team;
import com.clenzy.model.TeamMember;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class TeamService {
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;
    private final ManagerTeamRepository managerTeamRepository;

    public TeamService(TeamRepository teamRepository, UserRepository userRepository, ManagerTeamRepository managerTeamRepository) {
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
        this.managerTeamRepository = managerTeamRepository;
    }

    public TeamDto create(TeamDto dto, Jwt jwt) {
        // Vérifier que seuls ADMIN et MANAGER peuvent créer des équipes
        if (jwt == null) {
            throw new com.clenzy.exception.UnauthorizedException("Non authentifié");
        }
        
        UserRole userRole = extractUserRole(jwt);
        if (userRole != UserRole.ADMIN && userRole != UserRole.MANAGER) {
            throw new com.clenzy.exception.UnauthorizedException("Seuls les administrateurs et managers peuvent créer des équipes");
        }
        
        Team team = new Team();
        team.setName(dto.name);
        team.setDescription(dto.description);
        team.setInterventionType(dto.interventionType);
        team.setCreatedAt(LocalDateTime.now());

        // Créer les membres de l'équipe
        if (dto.members != null && !dto.members.isEmpty()) {
            List<TeamMember> members = dto.members.stream()
                .map(memberDto -> {
                    User user = userRepository.findById(memberDto.userId)
                        .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé avec l'ID: " + memberDto.userId));
                    
                    TeamMember member = new TeamMember();
                    member.setTeam(team);
                    member.setUser(user);
                    member.setRole(memberDto.role);
                    member.setCreatedAt(LocalDateTime.now());
                    
                    return member;
                })
                .collect(Collectors.toList());
            
            team.setMembers(members);
        }

        Team savedTeam = teamRepository.save(team);
        return convertToDto(savedTeam);
    }

    public TeamDto update(Long id, TeamDto dto) {
        Team team = teamRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Équipe non trouvée avec l'ID: " + id));

        // Mise à jour des champs simples
        team.setName(dto.name);
        team.setDescription(dto.description);
        team.setInterventionType(dto.interventionType);
        team.setUpdatedAt(LocalDateTime.now());

        // Gestion des membres - approche plus simple
        if (dto.members != null) {
            // Créer une nouvelle liste de membres
            List<TeamMember> newMembers = new ArrayList<>();
            
            for (TeamDto.TeamMemberDto memberDto : dto.members) {
                User user = userRepository.findById(memberDto.userId)
                    .orElseThrow(() -> new NotFoundException("Utilisateur non trouvé avec l'ID: " + memberDto.userId));
                
                TeamMember member = new TeamMember();
                member.setTeam(team);
                member.setUser(user);
                member.setRole(memberDto.role);
                member.setCreatedAt(LocalDateTime.now());
                newMembers.add(member);
            }
            
            // Remplacer complètement la liste des membres
            team.getMembers().clear();
            team.getMembers().addAll(newMembers);
        }

        Team updatedTeam = teamRepository.save(team);
        return convertToDto(updatedTeam);
    }

    @Transactional(readOnly = true)
    public TeamDto getById(Long id) {
        Team team = teamRepository.findById(id)
            .orElseThrow(() -> new NotFoundException("Équipe non trouvée avec l'ID: " + id));
        return convertToDto(team);
    }

    @Transactional(readOnly = true)
    public Page<TeamDto> list(Pageable pageable, Jwt jwt) {
        if (jwt == null) {
            // Si pas de JWT, retourner toutes les équipes (pour compatibilité)
            Page<Team> teams = teamRepository.findAll(pageable);
            return teams.map(this::convertToDto);
        }

        UserRole userRole = extractUserRole(jwt);
        System.out.println("🔍 TeamService.list - Rôle: " + userRole);

        List<Team> filteredTeams;

        if (userRole == UserRole.ADMIN) {
            // ADMIN : toutes les équipes
            filteredTeams = teamRepository.findAll();
        } else if (userRole == UserRole.MANAGER) {
            // MANAGER : seulement les équipes qu'il gère
            String keycloakId = jwt.getSubject();
            User managerUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            if (managerUser != null) {
                List<Long> teamIds = managerTeamRepository.findTeamIdsByManagerIdAndIsActiveTrue(managerUser.getId());
                filteredTeams = teamIds.stream()
                    .map(teamId -> teamRepository.findById(teamId).orElse(null))
                    .filter(team -> team != null)
                    .collect(Collectors.toList());
            } else {
                filteredTeams = new ArrayList<>();
            }
        } else if (userRole == UserRole.HOUSEKEEPER || userRole == UserRole.TECHNICIAN) {
            // HOUSEKEEPER/TECHNICIAN : seulement les équipes dont ils sont membres
            String keycloakId = jwt.getSubject();
            User currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            if (currentUser != null) {
                filteredTeams = teamRepository.findByUserId(currentUser.getId());
            } else {
                filteredTeams = new ArrayList<>();
            }
        } else {
            // Autres rôles : aucune équipe
            filteredTeams = new ArrayList<>();
        }

        // Appliquer la pagination manuellement
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filteredTeams.size());
        List<Team> pageContent = filteredTeams.subList(start, end);

        return new PageImpl<>(pageContent.stream().map(this::convertToDto).collect(Collectors.toList()), 
                             pageable, filteredTeams.size());
    }

    /**
     * Extrait le rôle principal de l'utilisateur depuis le JWT
     */
    private UserRole extractUserRole(Jwt jwt) {
        try {
            Map<String, Object> realmAccess = jwt.getClaim("realm_access");
            if (realmAccess != null) {
                Object roles = realmAccess.get("roles");
                if (roles instanceof List<?>) {
                    List<?> roleList = (List<?>) roles;
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;
                            if (roleStr.equals("offline_access") || 
                                roleStr.equals("uma_authorization") || 
                                roleStr.equals("default-roles-clenzy")) {
                                continue;
                            }
                            if (roleStr.equalsIgnoreCase("realm-admin")) {
                                return UserRole.ADMIN;
                            }
                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                if (userRole == UserRole.ADMIN || userRole == UserRole.MANAGER) {
                                    return userRole;
                                }
                            } catch (IllegalArgumentException e) {
                                // Ignorer les rôles non reconnus
                            }
                        }
                    }
                    // Si aucun rôle prioritaire trouvé, prendre le premier rôle valide
                    for (Object role : roleList) {
                        if (role instanceof String) {
                            String roleStr = (String) role;
                            try {
                                return UserRole.valueOf(roleStr.toUpperCase());
                            } catch (IllegalArgumentException e) {
                                // Ignorer
                            }
                        }
                    }
                }
            }
            // Fallback : essayer le rôle direct
            String directRole = jwt.getClaim("role");
            if (directRole != null) {
                try {
                    return UserRole.valueOf(directRole.toUpperCase());
                } catch (IllegalArgumentException e) {
                    // Ignorer
                }
            }
            return UserRole.HOST; // Fallback par défaut
        } catch (Exception e) {
            System.err.println("Erreur extraction rôle: " + e.getMessage());
            return UserRole.HOST;
        }
    }

    public void delete(Long id) {
        if (!teamRepository.existsById(id)) {
            throw new NotFoundException("Équipe non trouvée avec l'ID: " + id);
        }
        teamRepository.deleteById(id);
    }

    private TeamDto convertToDto(Team team) {
        TeamDto dto = new TeamDto();
        dto.id = team.getId();
        dto.name = team.getName();
        dto.description = team.getDescription();
        dto.interventionType = team.getInterventionType();
        dto.memberCount = team.getMemberCount();
        dto.createdAt = team.getCreatedAt();
        dto.updatedAt = team.getUpdatedAt();

        if (team.getMembers() != null) {
            dto.members = team.getMembers().stream()
                .map(this::convertMemberToDto)
                .collect(Collectors.toList());
        }

        return dto;
    }

    private TeamDto.TeamMemberDto convertMemberToDto(TeamMember member) {
        TeamDto.TeamMemberDto dto = new TeamDto.TeamMemberDto();
        dto.userId = member.getUser().getId();
        dto.role = member.getRole();
        dto.firstName = member.getFirstName();
        dto.lastName = member.getLastName();
        dto.email = member.getEmail();
        return dto;
    }
}
