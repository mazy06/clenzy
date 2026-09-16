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
import java.util.Comparator;
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

    private final PropertyTeamRepository propertyTeamRepository;
    private final InterventionRepository interventionRepository;
    private final TeamRepository teamRepository;
    private final TeamCoverageZoneRepository teamCoverageZoneRepository;
    private final PropertyRepository propertyRepository;
    private final OrganizationRepository organizationRepository;
    private final TenantContext tenantContext;
    private final ProviderAvailabilityService availabilityService;
    private final com.clenzy.repository.ServiceRequestRepository assignments;

    public PropertyTeamService(PropertyTeamRepository propertyTeamRepository,
                               InterventionRepository interventionRepository,
                               TeamRepository teamRepository,
                               TeamCoverageZoneRepository teamCoverageZoneRepository,
                               PropertyRepository propertyRepository,
                               OrganizationRepository organizationRepository,
                               TenantContext tenantContext,
                               ProviderAvailabilityService availabilityService,
                               com.clenzy.repository.ServiceRequestRepository assignments) {
        this.propertyTeamRepository = propertyTeamRepository;
        this.interventionRepository = interventionRepository;
        this.teamRepository = teamRepository;
        this.teamCoverageZoneRepository = teamCoverageZoneRepository;
        this.propertyRepository = propertyRepository;
        this.organizationRepository = organizationRepository;
        this.tenantContext = tenantContext;
        this.availabilityService = availabilityService;
        this.assignments = assignments;
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
        return findAvailableTeamForProperty(propertyId, scheduledDate, estimatedDurationHours, serviceType, orgId, Set.of());
    }

    public Optional<Long> findAvailableTeamForProperty(Long propertyId, LocalDateTime scheduledDate,
                                                        Integer estimatedDurationHours, String serviceType,
                                                        Long orgId, Set<Long> excludedTeamIds) {
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
        Set<Long> testedTeamIds = new HashSet<>(excludedTeamIds);

        boolean canDoGeoSearch = property != null && (
                (property.getDepartment() != null && !property.getDepartment().isBlank())
                || (property.getCity() != null && !property.getCity().isBlank())
        );

        for (Long searchOrgId : searchOrgIds) {
            // 1. Essayer l'equipe par defaut (property_teams) pour cette org
            Optional<Long> defaultResult = tryDefaultTeam(propertyId, searchOrgId, serviceType,
                rangeStart, rangeEnd, testedTeamIds);
            if (defaultResult.isPresent()) return defaultResult;

            // 2. Fallback : recherche par zone geographique dans cette org
            if (canDoGeoSearch) {
                Optional<Long> geoResult = tryGeographicSearch(property, searchOrgId, serviceType,
                    rangeStart, rangeEnd, testedTeamIds);
                if (geoResult.isPresent()) return geoResult;
            }
        }

        if (!canDoGeoSearch) {
            log.debug("Auto-assignation: propriete {} sans department ni city, recherche geographique impossible", propertyId);
        }

        log.debug("Auto-assignation: aucune equipe compatible et disponible pour propriete {} (orgs testees: {})",
            propertyId, searchOrgIds);
        return Optional.empty();
    }

    /**
     * Prestataires proposables pour un logement à une date donnée.
     *
     * <p>Même parcours que l'auto-assignation — équipe attitrée au logement,
     * puis zones de couverture, en cascade sur les organisations — mais on
     * rapporte <b>tous</b> les candidats au lieu de s'arrêter au premier.
     * L'auto-assignation choisit ; un opérateur qui replanifie, lui, veut voir
     * parmi quoi il choisit, et pourquoi tel prestataire est proposé.</p>
     *
     * <p>Les équipes occupées sur le créneau sont <b>conservées</b> et marquées
     * indisponibles : les masquer laisserait croire qu'elles n'existent pas,
     * alors que déplacer la date d'une heure les rend disponibles. C'est
     * précisément l'arbitrage qu'on veut permettre.</p>
     */
    @Transactional(readOnly = true)
    public List<AssignableTeam> findAssignableTeams(Long propertyId, LocalDateTime scheduledDate,
                                                    Integer estimatedDurationHours, String serviceType,
                                                    Long orgId) {
        return findAssignableTeams(propertyId, scheduledDate, estimatedDurationHours, serviceType, orgId, null, null);
    }

    @Transactional(readOnly = true)
    public List<AssignableTeam> findAssignableTeams(Long propertyId, LocalDateTime scheduledDate,
                                                    Integer estimatedDurationHours, String serviceType,
                                                    Long orgId, Long requestId, Long interventionId) {
        final int duration = (estimatedDurationHours != null && estimatedDurationHours > 0)
                ? estimatedDurationHours : DEFAULT_DURATION_HOURS;
        final LocalDateTime rangeStart = scheduledDate;
        final LocalDateTime rangeEnd = scheduledDate.plusHours(duration);

        final Property property = propertyRepository.findById(propertyId).orElse(null);
        final Set<Long> seen = new HashSet<>();
        final List<AssignableTeam> found = new ArrayList<>();

        for (Long searchOrgId : buildSearchOrgIds(orgId)) {
            propertyTeamRepository.findAllByPropertyId(propertyId, searchOrgId).stream()
                    .map(PropertyTeam::getTeamId)
                    .forEach(teamId -> collect(teamId, "DEFAULT", serviceType, rangeStart, rangeEnd, requestId, interventionId, duration, property, seen, found));

            if (property != null) {
                for (Long teamId : geographicCandidates(property, searchOrgId)) {
                    collect(teamId, "ZONE", serviceType, rangeStart, rangeEnd, requestId, interventionId, duration, property, seen, found);
                }
            }
        }

        // Puis le reste des équipes de l'organisation, hors zone de couverture.
        // Une prestation dont l'assignation automatique a échoué dix fois n'a,
        // par construction, aucune équipe couvrante : s'en tenir aux suggestions
        // laisserait l'opérateur devant une liste vide, sans recours.
        for (Team team : teamRepository.findAllForOrg(orgId)) {
            collect(team.getId(), "OTHER", serviceType, rangeStart, rangeEnd, requestId, interventionId, duration, property, seen, found);
        }

        // Disponibles d'abord ; à disponibilité égale, l'équipe attitrée, puis
        // celles de la zone, puis les autres.
        final List<String> priority = List.of("DEFAULT", "ZONE", "OTHER");
        found.sort(Comparator.comparing(AssignableTeam::available).reversed()
                .thenComparing(team -> priority.indexOf(team.origin())));
        return found;
    }

    /** Ajoute l'équipe aux candidats si son type convient et qu'on ne l'a pas déjà vue. */
    private void collect(Long teamId, String origin, String serviceType,
                         LocalDateTime rangeStart, LocalDateTime rangeEnd,
                         Long requestId, Long interventionId, int duration, Property property,
                         Set<Long> seen, List<AssignableTeam> found) {
        if (teamId == null || !seen.add(teamId)) return;
        if (rejectsPropertyType(teamId, property)) return;
        final Team team = teamRepository.findById(teamId).orElse(null);
        if (team == null) return;
        if (!InterventionTypeMatcher.isCompatible(team.getInterventionType(), serviceType)) return;

        final boolean occupied = assignments.previewAssignmentConflicts(
                requestId, interventionId, "team", teamId, rangeStart, duration);
        // Hors creneaux declares : le prestataire reste PROPOSE, marque
        // indisponible. Le masquer laisserait croire qu'il n'existe pas, alors
        // qu'un operateur peut vouloir le solliciter quand meme.
        final boolean withinDeclared = availabilityService.isAvailable(teamId, rangeStart, rangeEnd);
        found.add(new AssignableTeam(teamId, team.getName(), origin,
                !occupied && withinDeclared, occupied ? 1L : 0L));
    }

    /** Équipes dont une zone de couverture contient le logement. */
    private List<Long> geographicCandidates(Property property, Long searchOrgId) {
        String countryCode = property.getCountryCode();
        if (countryCode == null || countryCode.isBlank()) countryCode = "FR";
        countryCode = countryCode.trim().toUpperCase(java.util.Locale.ROOT);

        if ("FR".equals(countryCode)) {
            final String department = property.getDepartment();
            if (department == null || department.isBlank()) return List.of();
            final String arrondissement = property.getArrondissement();
            return (arrondissement != null && !arrondissement.isBlank())
                    ? teamCoverageZoneRepository.findTeamIdsByDepartmentAndArrondissement(
                            department.trim(), arrondissement.trim(), searchOrgId)
                    : teamCoverageZoneRepository.findTeamIdsByDepartment(department.trim(), searchOrgId);
        }
        final String city = property.getCity();
        if (city == null || city.isBlank()) return List.of();
        return teamCoverageZoneRepository.findTeamIdsByCountryAndCity(countryCode, city.trim(), searchOrgId);
    }

    /**
     * Un prestataire proposable.
     *
     * @param origin    {@code DEFAULT} = équipe attitrée au logement,
     *                  {@code ZONE} = couvre la zone géographique,
     *                  {@code OTHER} = même organisation, hors zone
     * @param available libre sur le créneau demandé
     * @param conflicts indicateur de conflit (0 ou 1), sans détail sur les engagements externes
     */
    public record AssignableTeam(Long teamId, String name, String origin,
                                 boolean available, long conflicts) {}

    /**
     * Les équipes proposables, et — quand il n'y en a aucune — le type d'équipe
     * qu'il aurait fallu.
     *
     * <p>Une liste vide seule laisse devant un mur : on ne sait pas si l'on
     * manque d'équipe, de couverture de zone, ou de disponibilité. Nommer le
     * type attendu transforme le constat en action.</p>
     *
     * @param requiredTeamType {@code CLEANING}, {@code MAINTENANCE},
     *                         {@code OTHER} — {@code null} si le type de
     *                         prestation n'est pas reconnu
     */
    public record AssignableTeams(List<AssignableTeam> teams, String requiredTeamType) {}

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
        var property = propertyRepository.findById(propertyId).orElse(null);
        for (PropertyTeam mapping : propertyTeamRepository.findAllByPropertyId(propertyId, searchOrgId)) {
            Long teamId = mapping.getTeamId();
            if (!testedTeamIds.add(teamId)) continue;
            Team team = teamRepository.findById(teamId).orElse(null);
            if (team == null || !InterventionTypeMatcher.isCompatible(team.getInterventionType(), serviceType)) continue;
            if (rejectsPropertyType(teamId, property)) continue;
            if (hasAssignmentConflict(teamId, rangeStart, rangeEnd)) continue;
            if (!availabilityService.isAvailable(teamId, rangeStart, rangeEnd)) continue;
            log.debug("Auto-assignation: equipe liee {} (org={}, type OK, disponible)", teamId, searchOrgId);
            return Optional.of(teamId);
        }
        return Optional.empty();
    }

    /**
     * Recherche geographique d'une equipe dans une org donnee.
     *
     * - Pays "FR" (defaut historique) → matching par department + arrondissement.
     * - Autres pays (MA, SA, ...) → matching par country + city.
     */
    private Optional<Long> tryGeographicSearch(Property property, Long searchOrgId, String serviceType,
                                                LocalDateTime rangeStart, LocalDateTime rangeEnd,
                                                Set<Long> testedTeamIds) {
        List<Long> candidateTeamIds = geographicCandidates(property, searchOrgId);

        for (Long candidateId : candidateTeamIds) {
            if (testedTeamIds.contains(candidateId)) continue;
            if (rejectsPropertyType(candidateId, property)) continue;
            testedTeamIds.add(candidateId);

            Team candidate = teamRepository.findById(candidateId).orElse(null);
            if (candidate == null) continue;

            if (!InterventionTypeMatcher.isCompatible(candidate.getInterventionType(), serviceType)) {
                continue;
            }

            if (!hasAssignmentConflict(candidateId, rangeStart, rangeEnd)
                    && availabilityService.isAvailable(candidateId, rangeStart, rangeEnd)) {
                log.debug("Auto-assignation geo: equipe {} (org={}, country={}, type OK, disponible)",
                    candidateId, searchOrgId, property.getCountryCode());
                return Optional.of(candidateId);
            }
        }

        return Optional.empty();
    }

    private boolean rejectsPropertyType(Long teamId, Property property) {
        return teamCoverageZoneRepository.rejectsPropertyType(teamId,
            property == null || property.getType() == null ? null : property.getType().name());
    }

    /** Même aperçu global des réservations que les suggestions manuelles ; la mutation reverrouille ensuite. */
    private boolean hasAssignmentConflict(Long teamId, LocalDateTime start, LocalDateTime end) {
        return assignments.previewAssignmentConflicts(null, null, "team", teamId, start,
            Math.toIntExact(java.time.Duration.between(start, end).toHours()));
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
