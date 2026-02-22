package com.clenzy.service;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyTeam;
import com.clenzy.model.Team;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.PropertyTeamRepository;
import com.clenzy.repository.TeamCoverageZoneRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import com.clenzy.util.InterventionTypeMatcher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@Transactional
public class PropertyTeamService {

    private static final Logger log = LoggerFactory.getLogger(PropertyTeamService.class);
    private static final int DEFAULT_DURATION_HOURS = 4;
    private static final List<InterventionStatus> ACTIVE_STATUSES = List.of(
        InterventionStatus.PENDING,
        InterventionStatus.AWAITING_VALIDATION,
        InterventionStatus.AWAITING_PAYMENT,
        InterventionStatus.IN_PROGRESS
    );

    private final PropertyTeamRepository propertyTeamRepository;
    private final InterventionRepository interventionRepository;
    private final TeamRepository teamRepository;
    private final TeamCoverageZoneRepository teamCoverageZoneRepository;
    private final PropertyRepository propertyRepository;
    private final TenantContext tenantContext;

    public PropertyTeamService(PropertyTeamRepository propertyTeamRepository,
                               InterventionRepository interventionRepository,
                               TeamRepository teamRepository,
                               TeamCoverageZoneRepository teamCoverageZoneRepository,
                               PropertyRepository propertyRepository,
                               TenantContext tenantContext) {
        this.propertyTeamRepository = propertyTeamRepository;
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
        this.teamCoverageZoneRepository = teamCoverageZoneRepository;
        this.propertyRepository = propertyRepository;
        this.tenantContext = tenantContext;
    }

    /**
     * Assigner une equipe a une propriete (upsert)
     */
    public PropertyTeamDto assignTeamToProperty(PropertyTeamRequest request) {
        // Verifier que l'equipe existe
        Team team = teamRepository.findById(request.getTeamId())
            .orElseThrow(() -> new RuntimeException("Equipe non trouvee"));

        // Upsert : supprimer l'ancien mapping si existant
        if (propertyTeamRepository.existsByPropertyId(request.getPropertyId())) {
            propertyTeamRepository.deleteByPropertyIdAndOrganizationId(request.getPropertyId(), tenantContext.getRequiredOrganizationId());
        }

        PropertyTeam propertyTeam = new PropertyTeam(request.getPropertyId(), request.getTeamId());
        propertyTeam.setOrganizationId(tenantContext.getRequiredOrganizationId());
        PropertyTeam saved = propertyTeamRepository.save(propertyTeam);

        return convertToDto(saved, team);
    }

    /**
     * Retirer l'equipe d'une propriete
     */
    public void removeTeamFromProperty(Long propertyId) {
        if (!propertyTeamRepository.existsByPropertyId(propertyId)) {
            throw new RuntimeException("Aucune equipe assignee a cette propriete");
        }
        propertyTeamRepository.deleteByPropertyIdAndOrganizationId(propertyId, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Recuperer l'equipe d'une propriete
     */
    @Transactional(readOnly = true)
    public Optional<PropertyTeamDto> getByProperty(Long propertyId) {
        return propertyTeamRepository.findByPropertyId(propertyId, tenantContext.getRequiredOrganizationId())
            .map(pt -> convertToDto(pt, pt.getTeam()));
    }

    /**
     * Recuperer les equipes de plusieurs proprietes (batch)
     */
    @Transactional(readOnly = true)
    public List<PropertyTeamDto> getByProperties(List<Long> propertyIds) {
        if (propertyIds == null || propertyIds.isEmpty()) {
            return List.of();
        }
        return propertyTeamRepository.findByPropertyIdIn(propertyIds, tenantContext.getRequiredOrganizationId()).stream()
            .map(pt -> convertToDto(pt, pt.getTeam()))
            .collect(Collectors.toList());
    }

    /**
     * Trouver une equipe disponible pour une propriete a une date donnee.
     * Verifie : compatibilite de type, zone geographique, et disponibilite horaire.
     *
     * Algorithme :
     * 1. Essayer l'equipe par defaut (property_teams) si compatible type + disponible
     * 2. Fallback : chercher par zone geographique + type + disponibilite
     *
     * @param propertyId             ID de la propriete
     * @param scheduledDate          Date prevue de l'intervention
     * @param estimatedDurationHours Duree estimee en heures
     * @param serviceType            Type de service de la demande (CLEANING, EMERGENCY_REPAIR, etc.)
     * @return Optional.of(teamId) si une equipe est trouvee, Optional.empty() sinon
     */
    @Transactional(readOnly = true)
    public Optional<Long> findAvailableTeamForProperty(Long propertyId, LocalDateTime scheduledDate, Integer estimatedDurationHours, String serviceType) {
        int duration = (estimatedDurationHours != null && estimatedDurationHours > 0)
            ? estimatedDurationHours
            : DEFAULT_DURATION_HOURS;
        LocalDateTime rangeStart = scheduledDate;
        LocalDateTime rangeEnd = scheduledDate.plusHours(duration);

        // 1. Essayer l'equipe par defaut (property_teams)
        Optional<PropertyTeam> mapping = propertyTeamRepository.findByPropertyId(propertyId, tenantContext.getRequiredOrganizationId());
        if (mapping.isPresent()) {
            Long defaultTeamId = mapping.get().getTeamId();
            Team defaultTeam = teamRepository.findById(defaultTeamId).orElse(null);

            if (defaultTeam != null) {
                // Verifier compatibilite de type
                boolean typeOk = InterventionTypeMatcher.isCompatible(defaultTeam.getInterventionType(), serviceType);
                if (typeOk) {
                    // Verifier disponibilite
                    long conflictCount = interventionRepository.countActiveByTeamIdAndDateRange(
                        defaultTeamId, ACTIVE_STATUSES, rangeStart, rangeEnd, tenantContext.getRequiredOrganizationId()
                    );
                    if (conflictCount == 0) {
                        log.debug("Auto-assignation: equipe par defaut {} (type OK, disponible)", defaultTeamId);
                        return Optional.of(defaultTeamId);
                    }
                    log.debug("Equipe par defaut {} occupee ({} conflits)", defaultTeamId, conflictCount);
                } else {
                    log.debug("Equipe par defaut {} incompatible type: {} vs {}", defaultTeamId, defaultTeam.getInterventionType(), serviceType);
                }
            }
        }

        // 2. Fallback : recherche par zone geographique
        Property property = propertyRepository.findById(propertyId).orElse(null);
        if (property == null || property.getDepartment() == null) {
            log.debug("Auto-assignation: propriete {} sans departement, impossible de rechercher par zone", propertyId);
            return Optional.empty();
        }

        String department = property.getDepartment();
        String arrondissement = property.getArrondissement();

        // Chercher les equipes couvrant cette zone
        List<Long> candidateTeamIds;
        if (arrondissement != null && !arrondissement.isEmpty()) {
            candidateTeamIds = teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement(department, arrondissement, tenantContext.getRequiredOrganizationId());
        } else {
            candidateTeamIds = teamCoverageZoneRepository.findTeamIdsByDepartment(department, tenantContext.getRequiredOrganizationId());
        }

        if (candidateTeamIds.isEmpty()) {
            log.debug("Auto-assignation: aucune equipe couvrant le departement {}", department);
            return Optional.empty();
        }

        // Filtrer par type et disponibilite
        for (Long candidateId : candidateTeamIds) {
            // Eviter de retester l'equipe par defaut
            if (mapping.isPresent() && candidateId.equals(mapping.get().getTeamId())) {
                continue;
            }

            Team candidate = teamRepository.findById(candidateId).orElse(null);
            if (candidate == null) continue;

            // Verifier compatibilite de type
            if (!InterventionTypeMatcher.isCompatible(candidate.getInterventionType(), serviceType)) {
                continue;
            }

            // Verifier disponibilite
            long conflictCount = interventionRepository.countActiveByTeamIdAndDateRange(
                candidateId, ACTIVE_STATUSES, rangeStart, rangeEnd, tenantContext.getRequiredOrganizationId()
            );
            if (conflictCount == 0) {
                log.debug("Auto-assignation fallback: equipe {} (zone {}, type OK, disponible)", candidateId, department);
                return Optional.of(candidateId);
            }
        }

        log.debug("Auto-assignation: aucune equipe compatible et disponible pour propriete {}", propertyId);
        return Optional.empty();
    }

    /**
     * Conversion vers DTO
     */
    private PropertyTeamDto convertToDto(PropertyTeam pt, Team team) {
        return new PropertyTeamDto(
            pt.getId(),
            pt.getPropertyId(),
            pt.getTeamId(),
            team != null ? team.getName() : null,
            team != null ? team.getInterventionType() : null,
            pt.getAssignedAt()
        );
    }
}
