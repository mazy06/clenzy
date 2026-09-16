package com.clenzy.service;

import com.clenzy.model.TeamAbsence;
import com.clenzy.model.TeamWeeklyAvailability;
import com.clenzy.repository.TeamAbsenceRepository;
import com.clenzy.repository.TeamWeeklyAvailabilityRepository;
import com.clenzy.tenant.TenantContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Disponibilites declarees d'un prestataire — creneaux hebdomadaires et
 * absences datees.
 *
 * <h2>La regle qui gouverne tout</h2>
 * <p><b>Aucune declaration = disponible.</b> Un prestataire qui n'a rien saisi
 * reste eligible, exactement comme avant l'existence de ces tables. Traiter le
 * silence comme une indisponibilite aurait sorti d'un coup toutes les equipes
 * existantes du moteur d'affectation, sans que personne n'ait rien change.</p>
 *
 * <p>« Libre » et « disponible » sont deux choses differentes : le moteur
 * savait deja qu'une equipe n'avait pas d'intervention sur le creneau, il ne
 * savait pas qu'elle ne travaille pas le dimanche.</p>
 */
@Service
public class ProviderAvailabilityService {

    private final TeamWeeklyAvailabilityRepository weeklyRepository;
    private final TeamAbsenceRepository absenceRepository;
    private final TenantContext tenantContext;
    private final com.clenzy.repository.ServiceRequestRepository assignments;

    public ProviderAvailabilityService(TeamWeeklyAvailabilityRepository weeklyRepository,
                                       TeamAbsenceRepository absenceRepository,
                                       TenantContext tenantContext,
                                       com.clenzy.repository.ServiceRequestRepository assignments) {
        this.weeklyRepository = weeklyRepository;
        this.absenceRepository = absenceRepository;
        this.tenantContext = tenantContext;
        this.assignments = assignments;
    }

    @Transactional(readOnly = true)
    public List<TeamWeeklyAvailability> getWeekly(Long teamId) {
        return weeklyRepository.findByTeamIdOrderByDayOfWeekAscStartTimeAsc(teamId);
    }

    @Transactional(readOnly = true)
    public List<TeamAbsence> getAbsences(Long teamId) {
        var absences = absenceRepository.findByTeamIdOrderByStartDateAsc(teamId);
        absences.forEach(this::markAssignmentConflict);
        return absences;
    }

    /**
     * REMPLACE les creneaux hebdomadaires. Remplacement et non ajout : la
     * semaine type se redecrit en entier, empiler les versions successives
     * laisserait des creneaux abandonnes rendre le prestataire eligible.
     */
    @Transactional
    public List<TeamWeeklyAvailability> replaceWeekly(Long teamId, List<WeeklySlotInput> slots) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
        assignments.lockTeamAvailability(teamId);
        weeklyRepository.deleteByTeamIdAndOrganizationId(teamId, orgId);
        return slots.stream().map(slot -> {
            TeamWeeklyAvailability entity = new TeamWeeklyAvailability(
                    teamId, slot.dayOfWeek(), slot.startTime(), slot.endTime());
            entity.setOrganizationId(orgId);
            return weeklyRepository.save(entity);
        }).toList();
    }

    @Transactional
    public TeamAbsence addAbsence(Long teamId, LocalDate start, LocalDate end, String reason) {
        if (end.isBefore(start)) {
            throw new IllegalArgumentException("La date de fin precede la date de debut");
        }
        TeamAbsence absence = new TeamAbsence(teamId, start, end, reason);
        absence.setOrganizationId(tenantContext.getRequiredOrganizationId());
        assignments.lockTeamAvailability(teamId);
        var saved = absenceRepository.save(absence);
        markAssignmentConflict(saved);
        return saved;
    }

    private void markAssignmentConflict(TeamAbsence absence) {
        int hours = Math.toIntExact(java.time.temporal.ChronoUnit.DAYS.between(
                absence.getStartDate(), absence.getEndDate()) * 24 + 24);
        absence.setAssignmentConflict(assignments.previewAssignmentConflicts(null, null, "team",
                absence.getTeamId(), absence.getStartDate().atStartOfDay(), hours));
    }

    @Transactional
    public void removeAbsence(Long teamId, Long absenceId) {
        assignments.lockTeamAvailability(teamId);
        absenceRepository.findById(absenceId)
                .filter(absence -> absence.getTeamId().equals(teamId))
                .ifPresent(absenceRepository::delete);
    }

    /**
     * Le prestataire est-il disponible sur [from, to[ ?
     *
     * <p>Deux verdicts independants : une absence datee ecarte le creneau quelle
     * que soit la semaine type, et un creneau doit etre COUVERT par une plage
     * declaree. Si une semaine type existe, une mission à cheval sur deux jours
     * est refusée faute de couverture horaire vérifiée. Sans semaine type,
     * toutes les dates occupées restent contrôlées contre les absences.</p>
     */
    @Transactional(readOnly = true)
    public boolean isAvailable(Long teamId, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw new IllegalArgumentException("Le créneau doit avoir un début et une fin postérieure au début");
        }
        return weeklyRepository.isDeclaredAvailable(teamId, from, to);
    }

    @Transactional(readOnly = true)
    public boolean isUserAvailable(Long userId, LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw new IllegalArgumentException("Le créneau doit avoir un début et une fin postérieure au début");
        }
        return weeklyRepository.isUserDeclaredAvailable(userId, from, to);
    }

    /** Un creneau de la semaine type. */
    public record WeeklySlotInput(Short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
