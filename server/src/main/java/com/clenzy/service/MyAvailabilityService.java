package com.clenzy.service;

import com.clenzy.model.Team;
import com.clenzy.model.TeamAbsence;
import com.clenzy.model.TeamWeeklyAvailability;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Disponibilites vues du cote de l'INTERVENANT : « mes » creneaux, « mes »
 * absences.
 *
 * <p>Fait le pont entre l'identite Keycloak et l'equipe PERSONNELLE qui porte
 * reellement les donnees. Les declarer est, avec la zone, le moment ou cette
 * equipe devient utile — elle nait donc ici si elle n'existe pas encore.</p>
 */
@Service
public class MyAvailabilityService {

    private final PersonalTeamService personalTeamService;
    private final ProviderAvailabilityService availabilityService;

    public MyAvailabilityService(PersonalTeamService personalTeamService,
                                 ProviderAvailabilityService availabilityService) {
        this.personalTeamService = personalTeamService;
        this.availabilityService = availabilityService;
    }

    @Transactional(readOnly = true)
    public List<TeamWeeklyAvailability> getWeekly(String keycloakId) {
        return personalTeamService.findByKeycloakId(keycloakId)
                .map(team -> availabilityService.getWeekly(team.getId()))
                // Pas encore d'equipe personnelle : rien de declare, donc rien a
                // rendre. Une liste vide, pas une erreur.
                .orElseGet(List::of);
    }

    @Transactional(readOnly = true)
    public List<TeamAbsence> getAbsences(String keycloakId) {
        return personalTeamService.findByKeycloakId(keycloakId)
                .map(team -> availabilityService.getAbsences(team.getId()))
                .orElseGet(List::of);
    }

    @Transactional
    public List<TeamWeeklyAvailability> replaceWeekly(String keycloakId, List<WeeklySlot> slots) {
        Team team = personalTeamService.getOrCreateByKeycloakId(keycloakId);
        return availabilityService.replaceWeekly(team.getId(), slots.stream()
                .map(s -> new ProviderAvailabilityService.WeeklySlotInput(
                        s.dayOfWeek(), s.startTime(), s.endTime()))
                .toList());
    }

    @Transactional
    public TeamAbsence addAbsence(String keycloakId, LocalDate start, LocalDate end, String reason) {
        Team team = personalTeamService.getOrCreateByKeycloakId(keycloakId);
        return availabilityService.addAbsence(team.getId(), start, end, reason);
    }

    @Transactional
    public void removeAbsence(String keycloakId, Long absenceId) {
        personalTeamService.findByKeycloakId(keycloakId)
                .ifPresent(team -> availabilityService.removeAbsence(team.getId(), absenceId));
    }

    public record WeeklySlot(Short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
}
