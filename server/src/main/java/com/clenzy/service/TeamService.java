package com.clenzy.service;

import com.clenzy.dto.TeamDto;
import com.clenzy.model.Team;
import com.clenzy.model.TeamMember;
import com.clenzy.model.User;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Transactional
public class TeamService {
    private final TeamRepository teamRepository;
    private final UserRepository userRepository;

    public TeamService(TeamRepository teamRepository, UserRepository userRepository) {
        this.teamRepository = teamRepository;
        this.userRepository = userRepository;
    }

    public TeamDto create(TeamDto dto) {
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

        team.setName(dto.name);
        team.setDescription(dto.description);
        team.setInterventionType(dto.interventionType);
        team.setUpdatedAt(LocalDateTime.now());

        // Mettre à jour les membres de l'équipe
        if (dto.members != null) {
            // Supprimer les anciens membres
            team.getMembers().clear();
            
            // Ajouter les nouveaux membres
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
    public Page<TeamDto> list(Pageable pageable) {
        Page<Team> teams = teamRepository.findAll(pageable);
        return teams.map(this::convertToDto);
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
