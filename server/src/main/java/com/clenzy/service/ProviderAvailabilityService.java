package com.clenzy.service;

import com.clenzy.model.Team;
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

    public ProviderAvailabilityService(TeamWeeklyAvailabilityRepository weeklyRepository,
                                       TeamAbsenceRepository absenceRepository,
                                       TenantContext tenantContext) {
        this.weeklyRepository = weeklyRepository;
        this.absenceRepository = absenceRepository;
        this.tenantContext = tenantContext;
    }

    @Transactional(readOnly = true)
    public List<TeamWeeklyAvailability> getWeekly(Long teamId) {
        return weeklyRepository.findByTeamIdOrderByDayOfWeekAscStartTimeAsc(teamId);
    }

    @Transactional(readOnly = true)
    public List<TeamAbsence> getAbsences(Long teamId) {
        return absenceRepository.findByTeamIdOrderByStartDateAsc(teamId);
    }

    /**
     * REMPLACE les creneaux hebdomadaires. Remplacement et non ajout : la
     * semaine type se redecrit en entier, empiler les versions successives
     * laisserait des creneaux abandonnes rendre le prestataire eligible.
     */
    @Transactional
    public List<TeamWeeklyAvailability> replaceWeekly(Long teamId, List<WeeklySlotInput> slots) {
        final Long orgId = tenantContext.getRequiredOrganizationId();
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
        return absenceRepository.save(absence);
    }

    @Transactional
    public void removeAbsence(Long teamId, Long absenceId) {
        absenceRepository.findById(absenceId)
                .filter(absence -> absence.getTeamId().equals(teamId))
                .ifPresent(absenceRepository::delete);
    }

    /**
     * Le prestataire est-il disponible sur [from, to] ?
     *
     * <p>Deux verdicts independants : une absence datee ecarte le creneau quelle
     * que soit la semaine type, et un creneau doit etre COUVERT par une plage
     * declaree. Une mission a cheval sur deux jours n'est pas evaluee finement —
     * on refuse, faute de savoir dire oui avec certitude.</p>
     */
    @Transactional(readOnly = true)
    public boolean isAvailable(Long teamId, LocalDateTime from, LocalDateTime to) {
        final LocalDate date = from.toLocalDate();

        if (!absenceRepository.findCovering(teamId, date).isEmpty()) {
            return false;
        }

        List<TeamWeeklyAvailability> slots = weeklyRepository
                .findByTeamIdOrderByDayOfWeekAscStartTimeAsc(teamId);
        // Silence = disponible : c'est ce qui preserve les equipes existantes.
        if (slots.isEmpty()) {
            return true;
        }

        // Chevauchement de journee : la semaine type ne sait pas repondre.
        if (!to.toLocalDate().equals(date)) {
            return false;
        }

        final LocalTime start = from.toLocalTime();
        final LocalTime end = to.toLocalTime();
        return slots.stream().anyMatch(slot -> slot.covers(date.getDayOfWeek(), start, end));
    }

    /** Un creneau de la semaine type. */
    public record WeeklySlotInput(Short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
