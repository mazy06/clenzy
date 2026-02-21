package com.clenzy.service;

import com.clenzy.dto.TeamDto;
import com.clenzy.model.Team;
import com.clenzy.model.TeamCoverageZone;
import com.clenzy.model.TeamMember;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.TeamCoverageZoneRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.ManagerTeamRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

import com.clenzy.tenant.TenantContext;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@Transactional
public class TeamService {

    private static final Logger log = LoggerFactory.getLogger(TeamService.class);

    private final TeamRepository teamRepository;
    private final TeamCoverageZoneRepository teamCoverageZoneRepository;
    private final UserRepository userRepository;
    private final ManagerTeamRepository managerTeamRepository;
    private final NotificationService notificationService;
    private final TenantContext tenantContext;

    public TeamService(TeamRepository teamRepository, TeamCoverageZoneRepository teamCoverageZoneRepository, UserRepository userRepository, ManagerTeamRepository managerTeamRepository, NotificationService notificationService, TenantContext tenantContext) {
        this.teamRepository = teamRepository;
        this.teamCoverageZoneRepository = teamCoverageZoneRepository;
        this.userRepository = userRepository;
        this.managerTeamRepository = managerTeamRepository;
        this.notificationService = notificationService;
        this.tenantContext = tenantContext;
    }

    public TeamDto create(TeamDto dto, Jwt jwt) {
        // Vérifier que seuls ADMIN et MANAGER peuvent créer des équipes
        if (jwt == null) {
            throw new com.clenzy.exception.UnauthorizedException("Non authentifié");
        }

        UserRole userRole = extractUserRole(jwt);
        if (!userRole.isPlatformStaff()) {
            throw new com.clenzy.exception.UnauthorizedException("Seuls les administrateurs et managers peuvent créer des équipes");
        }

        Team team = new Team();
        team.setOrganizationId(tenantContext.getRequiredOrganizationId());
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
                    member.setOrganizationId(tenantContext.getRequiredOrganizationId());
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

        // Creer les zones de couverture
        if (dto.coverageZones != null && !dto.coverageZones.isEmpty()) {
            for (TeamDto.CoverageZoneDto zoneDto : dto.coverageZones) {
                TeamCoverageZone zone = new TeamCoverageZone(savedTeam.getId(), zoneDto.department, zoneDto.arrondissement);
                zone.setOrganizationId(tenantContext.getRequiredOrganizationId());
                teamCoverageZoneRepository.save(zone);
            }
        }

        TeamDto result = convertToDto(savedTeam);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.TEAM_CREATED,
                "Nouvelle equipe",
                "Equipe \"" + savedTeam.getName() + "\" creee",
                "/teams/" + savedTeam.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error TEAM_CREATED: {}", e.getMessage());
        }

        return result;
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
                member.setOrganizationId(tenantContext.getRequiredOrganizationId());
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

        // Gestion des zones de couverture
        if (dto.coverageZones != null) {
            team.getCoverageZones().clear();
            teamCoverageZoneRepository.deleteByTeamIdAndOrganizationId(id, tenantContext.getRequiredOrganizationId());
            for (TeamDto.CoverageZoneDto zoneDto : dto.coverageZones) {
                TeamCoverageZone zone = new TeamCoverageZone(id, zoneDto.department, zoneDto.arrondissement);
                zone.setOrganizationId(tenantContext.getRequiredOrganizationId());
                zone.setTeam(team);
                team.getCoverageZones().add(zone);
            }
        }

        Team updatedTeam = teamRepository.save(team);
        TeamDto result = convertToDto(updatedTeam);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.TEAM_UPDATED,
                "Equipe mise a jour",
                "Equipe \"" + updatedTeam.getName() + "\" modifiee",
                "/teams/" + updatedTeam.getId()
            );
        } catch (Exception e) {
            log.warn("Notification error TEAM_UPDATED: {}", e.getMessage());
        }

        return result;
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
        log.debug("list - Role: {}", userRole);

        List<Team> filteredTeams;

        if (userRole.isPlatformAdmin()) {
            // SUPER_ADMIN/ADMIN : toutes les équipes
            filteredTeams = teamRepository.findAll();
        } else if (userRole == UserRole.SUPER_MANAGER) {
            // MANAGER : seulement les équipes qu'il gère
            String keycloakId = jwt.getSubject();
            User managerUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            if (managerUser != null) {
                List<Long> teamIds = managerTeamRepository.findTeamIdsByManagerIdAndIsActiveTrue(managerUser.getId(), tenantContext.getRequiredOrganizationId());
                filteredTeams = teamIds.stream()
                    .map(teamId -> teamRepository.findById(teamId).orElse(null))
                    .filter(team -> team != null)
                    .collect(Collectors.toList());
            } else {
                filteredTeams = new ArrayList<>();
            }
        } else if (userRole == UserRole.HOUSEKEEPER || userRole == UserRole.TECHNICIAN || userRole == UserRole.LAUNDRY || userRole == UserRole.EXTERIOR_TECH || userRole == UserRole.SUPERVISOR) {
            // Rôles opérationnels : seulement les équipes dont ils sont membres
            String keycloakId = jwt.getSubject();
            User currentUser = userRepository.findByKeycloakId(keycloakId).orElse(null);
            if (currentUser != null) {
                filteredTeams = teamRepository.findByUserId(currentUser.getId(), tenantContext.getRequiredOrganizationId());
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
                                return UserRole.SUPER_ADMIN;
                            }
                            try {
                                UserRole userRole = UserRole.valueOf(roleStr.toUpperCase());
                                if (userRole.isPlatformStaff()) {
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
            log.warn("Error extracting role from JWT: {}", e.getMessage());
            return UserRole.HOST;
        }
    }

    public void delete(Long id) {
        if (!teamRepository.existsById(id)) {
            throw new NotFoundException("Équipe non trouvée avec l'ID: " + id);
        }
        teamRepository.deleteById(id);

        try {
            notificationService.notifyAdminsAndManagers(
                NotificationKey.TEAM_DELETED,
                "Equipe supprimee",
                "L'equipe #" + id + " a ete supprimee",
                "/teams"
            );
        } catch (Exception e) {
            log.warn("Notification error TEAM_DELETED: {}", e.getMessage());
        }
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

        if (team.getCoverageZones() != null) {
            dto.coverageZones = team.getCoverageZones().stream()
                .map(zone -> {
                    TeamDto.CoverageZoneDto zoneDto = new TeamDto.CoverageZoneDto();
                    zoneDto.id = zone.getId();
                    zoneDto.department = zone.getDepartment();
                    zoneDto.arrondissement = zone.getArrondissement();
                    return zoneDto;
                })
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
