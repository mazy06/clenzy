package com.clenzy.service;

import com.clenzy.dto.PropertyTeamDto;
import com.clenzy.dto.PropertyTeamRequest;
import com.clenzy.model.*;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.OrganizationRepository;
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
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
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
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;

    public PropertyTeamService(PropertyTeamRepository propertyTeamRepository,
                               InterventionRepository interventionRepository,
                               TeamRepository teamRepository,
                               TeamCoverageZoneRepository teamCoverageZoneRepository,
                               PropertyRepository propertyRepository,
                               OrganizationRepository organizationRepository,
                               TenantContext tenantContext) {
        this.propertyTeamRepository = propertyTeamRepository;
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
        this.teamCoverageZoneRepository = teamCoverageZoneRepository;
        this.propertyRepository = propertyRepository;
        this.organizationRepository = organizationRepository;
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
     * Strategie d'attribution selon le type d'organisation :
     *
     * - INDIVIDUAL  → equipes des organisations SYSTEM uniquement
     * - CONCIERGE / CLEANING_COMPANY → d'abord equipes de sa propre org, puis fallback SYSTEM
     * - SYSTEM      → equipes de sa propre org uniquement
     *
     * Pour chaque couche d'org :
     *   1. Essayer l'equipe par defaut (property_teams) si compatible type + disponible
     *   2. Fallback : chercher par zone geographique + type + disponibilite
     *
     * La disponibilite est verifiee TOUTES orgs confondues (une equipe ne peut etre
     * qu'a un seul endroit a la fois, meme si elle sert plusieurs organisations).
     *
     * Version web (TenantContext disponible).
     */
    @Transactional(readOnly = true)
    public Optional<Long> findAvailableTeamForProperty(Long propertyId, LocalDateTime scheduledDate,
                                                        Integer estimatedDurationHours, String serviceType) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return findAvailableTeamForProperty(propertyId, scheduledDate, estimatedDurationHours, serviceType, orgId);
    }

    /**
     * Surcharge pour le contexte scheduler (pas de TenantContext).
     * Meme algorithme que la methode ci-dessus, mais avec un orgId explicite.
     */
    @Transactional(readOnly = true)
    public Optional<Long> findAvailableTeamForProperty(Long propertyId, LocalDateTime scheduledDate,
                                                        Integer estimatedDurationHours, String serviceType,
                                                        Long orgId) {
        int duration = (estimatedDurationHours != null && estimatedDurationHours > 0)
            ? estimatedDurationHours
            : DEFAULT_DURATION_HOURS;
        LocalDateTime rangeStart = scheduledDate;
        LocalDateTime rangeEnd = scheduledDate.plusHours(duration);

        // Charger la propriete une seule fois (necessaire pour la recherche geographique)
        Property property = propertyRepository.findById(propertyId).orElse(null);

        // Determiner l'ordre de recherche selon le type d'organisation
        List<Long> searchOrgIds = buildSearchOrgIds(orgId);
        log.debug("Auto-assignation: org={}, type recherche={}, searchOrgIds={}",
            orgId, getOrgTypeLabel(orgId), searchOrgIds);

        // Equipes deja testees (eviter les doublons entre couches)
        Set<Long> testedTeamIds = new HashSet<>();

        for (Long searchOrgId : searchOrgIds) {
            // 1. Essayer l'equipe par defaut (property_teams) pour cette org
            Optional<Long> defaultResult = tryDefaultTeam(propertyId, searchOrgId, serviceType,
                rangeStart, rangeEnd, testedTeamIds);
            if (defaultResult.isPresent()) return defaultResult;

            // 2. Fallback : recherche par zone geographique dans cette org
            if (property != null && property.getDepartment() != null) {
                Optional<Long> geoResult = tryGeographicSearch(property, searchOrgId, serviceType,
                    rangeStart, rangeEnd, testedTeamIds);
                if (geoResult.isPresent()) return geoResult;
            }
        }

        if (property == null || property.getDepartment() == null) {
            log.debug("Auto-assignation: propriete {} sans departement, recherche geographique impossible", propertyId);
        }

        log.debug("Auto-assignation: aucune equipe compatible et disponible pour propriete {} (orgs testees: {})",
            propertyId, searchOrgIds);
        return Optional.empty();
    }

    // ── Helpers auto-assignation ──────────────────────────────────────────────

    /**
     * Construire la liste ordonnee des organisations a interroger.
     *
     * - INDIVIDUAL  → [SYSTEM orgs]        (pas d'equipes propres)
     * - CONCIERGE / CLEANING_COMPANY → [own org, SYSTEM orgs]  (priorite propre org)
     * - SYSTEM      → [own org]            (auto-suffisant)
     */
    private List<Long> buildSearchOrgIds(Long orgId) {
        Organization org = organizationRepository.findById(orgId).orElse(null);
        List<Long> systemOrgIds = organizationRepository.findIdsByType(OrganizationType.SYSTEM);

        if (org == null || org.isIndividual()) {
            // INDIVIDUAL → uniquement les equipes des organisations SYSTEM
            return systemOrgIds.isEmpty() ? List.of() : systemOrgIds;
        }

        if (OrganizationType.SYSTEM.equals(org.getType())) {
            // SYSTEM → uniquement ses propres equipes
            return List.of(orgId);
        }

        // CONCIERGE / CLEANING_COMPANY → propre org d'abord, puis SYSTEM en fallback
        List<Long> result = new ArrayList<>();
        result.add(orgId);
        for (Long sysId : systemOrgIds) {
            if (!sysId.equals(orgId)) {
                result.add(sysId);
            }
        }
        return result;
    }

    /**
     * Tenter l'equipe par defaut (mapping property_teams) pour une org donnee.
     */
    private Optional<Long> tryDefaultTeam(Long propertyId, Long searchOrgId, String serviceType,
                                           LocalDateTime rangeStart, LocalDateTime rangeEnd,
                                           Set<Long> testedTeamIds) {
        Optional<PropertyTeam> mapping = propertyTeamRepository.findByPropertyId(propertyId, searchOrgId);
        if (mapping.isEmpty()) return Optional.empty();

        Long defaultTeamId = mapping.get().getTeamId();
        if (testedTeamIds.contains(defaultTeamId)) return Optional.empty();
        testedTeamIds.add(defaultTeamId);

        Team defaultTeam = teamRepository.findById(defaultTeamId).orElse(null);
        if (defaultTeam == null) return Optional.empty();

        if (!InterventionTypeMatcher.isCompatible(defaultTeam.getInterventionType(), serviceType)) {
            log.debug("Equipe par defaut {} (org={}) incompatible type: {} vs {}",
                defaultTeamId, searchOrgId, defaultTeam.getInterventionType(), serviceType);
            return Optional.empty();
        }

        // Verifier disponibilite TOUTES orgs (une equipe SYSTEM sert plusieurs orgs)
        long conflictCount = interventionRepository.countActiveByTeamIdAndDateRangeAnyOrg(
            defaultTeamId, ACTIVE_STATUSES, rangeStart, rangeEnd
        );
        if (conflictCount > 0) {
            log.debug("Equipe par defaut {} (org={}) occupee ({} conflits)", defaultTeamId, searchOrgId, conflictCount);
            return Optional.empty();
        }

        log.debug("Auto-assignation: equipe par defaut {} (org={}, type OK, disponible)", defaultTeamId, searchOrgId);
        return Optional.of(defaultTeamId);
    }

    /**
     * Recherche geographique d'une equipe dans une org donnee.
     */
    private Optional<Long> tryGeographicSearch(Property property, Long searchOrgId, String serviceType,
                                                LocalDateTime rangeStart, LocalDateTime rangeEnd,
                                                Set<Long> testedTeamIds) {
        String department = property.getDepartment();
        String arrondissement = property.getArrondissement();

        List<Long> candidateTeamIds;
        if (arrondissement != null && !arrondissement.isEmpty()) {
            candidateTeamIds = teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement(
                department, arrondissement, searchOrgId);
        } else {
            candidateTeamIds = teamCoverageZoneRepository.findTeamIdsByDepartment(department, searchOrgId);
        }

        if (candidateTeamIds.isEmpty()) {
            log.debug("Auto-assignation: aucune equipe couvrant dept {} dans org {}", department, searchOrgId);
            return Optional.empty();
        }

        for (Long candidateId : candidateTeamIds) {
            if (testedTeamIds.contains(candidateId)) continue;
            testedTeamIds.add(candidateId);

            Team candidate = teamRepository.findById(candidateId).orElse(null);
            if (candidate == null) continue;

            if (!InterventionTypeMatcher.isCompatible(candidate.getInterventionType(), serviceType)) {
                continue;
            }

            // Disponibilite TOUTES orgs confondues
            long conflictCount = interventionRepository.countActiveByTeamIdAndDateRangeAnyOrg(
                candidateId, ACTIVE_STATUSES, rangeStart, rangeEnd
            );
            if (conflictCount == 0) {
                log.debug("Auto-assignation geo: equipe {} (org={}, dept={}, type OK, disponible)",
                    candidateId, searchOrgId, department);
                return Optional.of(candidateId);
            }
        }

        return Optional.empty();
    }

    /**
     * Label du type d'org pour les logs.
     */
    private String getOrgTypeLabel(Long orgId) {
        return organizationRepository.findById(orgId)
            .map(o -> o.getType().name())
            .orElse("UNKNOWN");
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
