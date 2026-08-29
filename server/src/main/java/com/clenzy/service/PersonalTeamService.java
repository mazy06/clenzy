package com.clenzy.service;

import com.clenzy.model.Team;
import com.clenzy.model.TeamMember;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.model.TeamCoverageZone;
import com.clenzy.repository.TeamCoverageZoneRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Equipe PERSONNELLE d'un intervenant — l'« equipe implicite » d'une personne.
 *
 * <h2>Le probleme</h2>
 * <p>Tout le moteur d'affectation ({@link PropertyTeamService}) raisonne en
 * equipes : les zones de couverture sont clefees par {@code team_id},
 * l'occupation se teste par {@code team_id}, et le metier vient du
 * {@code interventionType} de l'equipe. Un intervenant independant, sans
 * equipe, est donc invisible de l'auto-assignation — un gestionnaire doit le
 * choisir a la main.</p>
 *
 * <h2>Le choix</h2>
 * <p>Plutot que de dupliquer le moteur pour les personnes, on donne a chaque
 * independant une equipe d'un seul membre. Zones, disponibilites et
 * compatibilite de metier s'appliquent alors sans qu'une ligne du moteur
 * change.</p>
 *
 * <p>La creation est PARESSEUSE : l'equipe nait au premier besoin — quand
 * l'intervenant declare sa zone — et non a l'inscription. Creer une equipe pour
 * chaque utilisateur remplirait la base d'objets que personne n'utilise.</p>
 *
 * <p>Ces equipes ne doivent JAMAIS apparaitre dans les listes d'equipes de
 * l'interface gestionnaire : elles y noieraient les vraies equipes sous autant
 * d'entrees que d'intervenants.</p>
 */
@Service
public class PersonalTeamService {

    private static final Logger log = LoggerFactory.getLogger(PersonalTeamService.class);

    private final TeamRepository teamRepository;
    private final TeamCoverageZoneRepository zoneRepository;
    private final UserRepository userRepository;
    private final TenantContext tenantContext;

    public PersonalTeamService(TeamRepository teamRepository,
                               TeamCoverageZoneRepository zoneRepository,
                               UserRepository userRepository,
                               TenantContext tenantContext) {
        this.teamRepository = teamRepository;
        this.zoneRepository = zoneRepository;
        this.userRepository = userRepository;
        this.tenantContext = tenantContext;
    }

    /** Equipe personnelle existante, sans en creer. */
    @Transactional(readOnly = true)
    public Optional<Team> find(Long userId) {
        return teamRepository.findByPersonalUserId(userId, tenantContext.getRequiredOrganizationId());
    }

    /**
     * Equipe personnelle de l'intervenant, creee au besoin.
     *
     * <p>L'unicite est garantie en base par un index unique partiel sur
     * {@code (organization_id, personal_user_id)} : deux appels concurrents ne
     * peuvent pas produire deux equipes — le second echoue sur la contrainte
     * plutot que de dedoubler silencieusement.</p>
     */
    @Transactional
    public Team getOrCreate(Long userId) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        Optional<Team> existing = teamRepository.findByPersonalUserId(userId, orgId);
        if (existing.isPresent()) {
            return existing.get();
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur non trouve : " + userId));

        Team team = new Team();
        team.setOrganizationId(orgId);
        team.setPersonalUserId(userId);
        team.setName(displayName(user));
        team.setDescription("Intervenant independant");
        team.setInterventionType(interventionTypeFor(user));
        team.setCreatedAt(LocalDateTime.now());

        TeamMember member = new TeamMember();
        member.setOrganizationId(orgId);
        member.setTeam(team);
        member.setUser(user);
        member.setRole("MEMBER");
        member.setCreatedAt(LocalDateTime.now());
        team.setMembers(List.of(member));

        Team saved = teamRepository.save(team);
        log.info("Equipe personnelle creee: teamId={} userId={} org={} type={}",
                saved.getId(), userId, orgId, saved.getInterventionType());
        return saved;
    }

    /** Equipe personnelle a partir de l'identite Keycloak, sans en creer. */
    @Transactional(readOnly = true)
    public Optional<Team> findByKeycloakId(String keycloakId) {
        return find(requireUser(keycloakId).getId());
    }

    /** Equipe personnelle a partir de l'identite Keycloak, creee au besoin. */
    @Transactional
    public Team getOrCreateByKeycloakId(String keycloakId) {
        return getOrCreate(requireUser(keycloakId).getId());
    }

    // ── Zone d'intervention declaree par l'intervenant ─────────────────────

    /** Zone declaree, vide tant qu'aucune equipe personnelle n'existe. */
    @Transactional(readOnly = true)
    public List<TeamCoverageZone> getCoverageZones(String keycloakId) {
        return find(requireUser(keycloakId).getId())
                .map(team -> zoneRepository.findByTeamId(team.getId()))
                .orElseGet(List::of);
    }

    /**
     * REMPLACE la zone declaree — l'intervenant decrit ou il travaille
     * AUJOURD'HUI. Empiler les declarations successives laisserait des secteurs
     * qu'il a quittes le rendre eligible a des missions qu'il refusera.
     *
     * <p>C'est ici que l'equipe personnelle nait, si elle n'existait pas :
     * declarer sa zone est exactement le moment ou elle devient utile.</p>
     */
    @Transactional
    public List<TeamCoverageZone> replaceCoverageZones(String keycloakId, List<CoverageZoneInput> zones) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        Team team = getOrCreate(requireUser(keycloakId).getId());

        zoneRepository.deleteByTeamIdAndOrganizationId(team.getId(), orgId);

        return zones.stream().map(input -> {
            TeamCoverageZone zone = new TeamCoverageZone(
                    team.getId(),
                    input.country().toUpperCase(),
                    input.department(),
                    input.arrondissement(),
                    input.city());
            zone.setOrganizationId(orgId);
            return zoneRepository.save(zone);
        }).toList();
    }

    /**
     * Une zone declaree. La France se decrit par departement (et arrondissement
     * pour Paris, Lyon, Marseille), le reste du monde par ville : c'est la
     * maille dont dispose le moteur, et elle differe selon le pays.
     */
    public record CoverageZoneInput(String country, String department,
                                    String arrondissement, String city) {}

    private User requireUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur non trouve"));
    }

    /**
     * Metier de l'equipe, deduit du ROLE de l'intervenant : c'est lui qui dit ce
     * qu'il sait faire, et {@code InterventionTypeMatcher} raisonne sur ces
     * memes libelles.
     */
    private String interventionTypeFor(User user) {
        UserRole role = user.getRole();
        if (role == null) return "CLEANING";
        return switch (role) {
            case TECHNICIAN -> "MAINTENANCE";
            case LAUNDRY -> "LAUNDRY";
            case EXTERIOR_TECH -> "EXTERIOR";
            default -> "CLEANING";
        };
    }

    /** Nom lisible dans les ecrans de replanification, ou l'equipe apparait. */
    private String displayName(User user) {
        String first = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String last = user.getLastName() != null ? user.getLastName().trim() : "";
        String full = (first + " " + last).trim();
        if (!full.isBlank()) return full;
        // Pas d'identite renseignee : l'email fait un libelle lisible, et il est
        // toujours present. L'identifiant seul ne dirait rien au gestionnaire.
        return user.getEmail() != null ? user.getEmail() : "Intervenant " + user.getId();
    }
}
