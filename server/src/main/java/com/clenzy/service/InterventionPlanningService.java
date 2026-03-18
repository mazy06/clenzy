package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.model.InterventionStatus;
import com.clenzy.model.Reservation;
import com.clenzy.model.Team;
import com.clenzy.model.User;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Handles planning, team availability and user availability logic.
 * Extracted from InterventionController to respect SRP (controller should only delegate).
 */
@Service
@Transactional(readOnly = true)
public class InterventionPlanningService {

    private static final Logger log = LoggerFactory.getLogger(InterventionPlanningService.class);

    private static final List<InterventionStatus> ACTIVE_STATUSES = List.of(
            InterventionStatus.PENDING,
            InterventionStatus.AWAITING_VALIDATION,
            InterventionStatus.AWAITING_PAYMENT,
            InterventionStatus.IN_PROGRESS
    );

    private final InterventionRepository interventionRepository;
    private final ReservationRepository reservationRepository;
    private final UserRepository userRepository;
    private final TeamRepository teamRepository;
    private final TenantContext tenantContext;

    public InterventionPlanningService(InterventionRepository interventionRepository,
                                       ReservationRepository reservationRepository,
                                       UserRepository userRepository,
                                       TeamRepository teamRepository,
                                       TenantContext tenantContext) {
        this.interventionRepository = interventionRepository;
        this.reservationRepository = reservationRepository;
        this.userRepository = userRepository;
        this.teamRepository = teamRepository;
        this.tenantContext = tenantContext;
    }

    public List<Map<String, Object>> getPlanningInterventions(Jwt jwt, List<Long> propertyIds,
                                                               LocalDate from, LocalDate to, String type) {
        if (from == null) from = LocalDate.now().minusMonths(3);
        if (to == null) to = LocalDate.now().plusMonths(6);

        LocalDateTime fromDateTime = from.atStartOfDay();
        LocalDateTime toDateTime = to.atTime(LocalTime.MAX);

        User user = userRepository.findByKeycloakId(jwt.getSubject())
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        boolean isAdminOrManager = user.getRole() != null && user.getRole().isPlatformStaff();
        Long orgId = tenantContext.getRequiredOrganizationId();

        List<Intervention> interventions;

        if (propertyIds != null && !propertyIds.isEmpty()) {
            interventions = interventionRepository.findByPropertyIdsAndDateRange(propertyIds, fromDateTime, toDateTime, orgId);
        } else if (isAdminOrManager) {
            interventions = interventionRepository.findAllByDateRange(fromDateTime, toDateTime, orgId);
        } else {
            interventions = interventionRepository.findByOwnerKeycloakIdAndDateRange(jwt.getSubject(), fromDateTime, toDateTime, orgId);
        }

        // Filtre optionnel par type
        if (type != null && !type.isEmpty() && !"all".equals(type)) {
            interventions = interventions.stream()
                    .filter(i -> type.equalsIgnoreCase(i.getType()))
                    .collect(Collectors.toList());
        }

        // Construire la map interventionId -> reservationId
        final Map<Long, Long> interventionToReservation;
        List<Long> interventionIds = interventions.stream().map(Intervention::getId).collect(Collectors.toList());
        if (!interventionIds.isEmpty()) {
            List<Reservation> linkedReservations = reservationRepository.findByInterventionIdIn(interventionIds, orgId);
            interventionToReservation = linkedReservations.stream()
                    .filter(r -> r.getIntervention() != null)
                    .collect(Collectors.toMap(
                            r -> r.getIntervention().getId(),
                            Reservation::getId,
                            (a, b) -> a));
        } else {
            interventionToReservation = Map.of();
        }

        // Pre-load team names
        List<Long> teamIds = interventions.stream()
                .filter(i -> i.getTeamId() != null && i.getAssignedUser() == null)
                .map(Intervention::getTeamId)
                .distinct()
                .collect(Collectors.toList());
        final Map<Long, String> teamNameMap;
        if (!teamIds.isEmpty()) {
            teamNameMap = teamRepository.findAllById(teamIds).stream()
                    .collect(Collectors.toMap(Team::getId, Team::getName, (a, b) -> a));
        } else {
            teamNameMap = Map.of();
        }

        return interventions.stream().map(i -> {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", i.getId());
            map.put("propertyId", i.getProperty() != null ? i.getProperty().getId() : null);
            map.put("propertyName", i.getProperty() != null ? i.getProperty().getName() : "");
            map.put("type", i.getType() != null ? i.getType().toLowerCase() : "cleaning");

            String frontendStatus = "scheduled";
            if (i.getStatus() != null) {
                switch (i.getStatus()) {
                    case IN_PROGRESS: frontendStatus = "in_progress"; break;
                    case COMPLETED: frontendStatus = "completed"; break;
                    case CANCELLED: frontendStatus = "cancelled"; break;
                    default: frontendStatus = "scheduled"; break;
                }
            }
            map.put("status", frontendStatus);
            map.put("priority", i.getPriority() != null ? i.getPriority().toLowerCase() : "medium");
            map.put("title", i.getTitle());
            map.put("description", i.getDescription());

            String startDate = i.getScheduledDate() != null ? i.getScheduledDate().toLocalDate().toString() : null;
            map.put("startDate", startDate);
            map.put("endDate", startDate);
            map.put("startTime", i.getScheduledDate() != null ? i.getScheduledDate().toLocalTime().toString() : "11:00");

            if (i.getScheduledDate() != null && i.getEstimatedDurationHours() != null) {
                LocalTime endTime = i.getScheduledDate().toLocalTime().plusHours(i.getEstimatedDurationHours());
                map.put("endTime", endTime.toString());
            } else {
                map.put("endTime", null);
            }
            map.put("estimatedDurationHours", i.getEstimatedDurationHours());
            map.put("notes", i.getNotes());

            String assigneeName = null;
            if (i.getAssignedUser() != null) {
                assigneeName = (i.getAssignedUser().getFirstName() + " " + i.getAssignedUser().getLastName()).trim();
            } else if (i.getTeamId() != null) {
                assigneeName = teamNameMap.getOrDefault(i.getTeamId(), "Equipe #" + i.getTeamId());
            }
            map.put("assigneeName", assigneeName);
            map.put("linkedReservationId", interventionToReservation.getOrDefault(i.getId(), null));

            map.put("paymentStatus", i.getPaymentStatus() != null ? i.getPaymentStatus().name() : null);
            map.put("estimatedCost", i.getEstimatedCost());
            map.put("actualCost", i.getActualCost());
            map.put("paidAt", i.getPaidAt());
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * Check team member availability using a single batch query (M10 fix).
     */
    public Map<String, Object> checkTeamMemberAvailability(Long teamId, Long interventionId,
                                                            String date, Integer durationHours) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        Team team = teamRepository.findByIdWithMembers(teamId)
                .orElseThrow(() -> new RuntimeException("Equipe introuvable: " + teamId));

        LocalDateTime rangeStart;
        int duration;

        if (interventionId != null) {
            Intervention intervention = interventionRepository.findById(interventionId)
                    .orElseThrow(() -> new RuntimeException("Intervention introuvable: " + interventionId));
            rangeStart = intervention.getScheduledDate() != null
                    ? intervention.getScheduledDate()
                    : LocalDateTime.now();
            duration = intervention.getEstimatedDurationHours() != null
                    ? intervention.getEstimatedDurationHours()
                    : 4;
        } else if (date != null) {
            rangeStart = LocalDateTime.parse(date);
            duration = durationHours != null ? durationHours : 4;
        } else {
            return null; // caller should return badRequest
        }

        LocalDateTime rangeEnd = rangeStart.plusHours(duration);

        // Batch query: fetch conflict counts for all members in a single query (M10)
        List<Long> memberUserIds = team.getMembers().stream()
                .map(m -> m.getUser().getId())
                .collect(Collectors.toList());

        Map<Long, Long> conflictsByUserId = new java.util.HashMap<>();
        if (!memberUserIds.isEmpty()) {
            List<Object[]> counts = interventionRepository.countActiveByUserIdsAndDateRange(
                    memberUserIds, ACTIVE_STATUSES, rangeStart, rangeEnd, orgId);
            for (Object[] row : counts) {
                conflictsByUserId.put((Long) row[0], (Long) row[1]);
            }
        }

        List<Map<String, Object>> members = team.getMembers().stream().map(member -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", member.getUser().getId());
            m.put("firstName", member.getUser().getFirstName());
            m.put("lastName", member.getUser().getLastName());
            m.put("role", member.getRole());

            long conflictCount = conflictsByUserId.getOrDefault(member.getUser().getId(), 0L);
            m.put("available", conflictCount == 0);
            m.put("conflictCount", conflictCount);
            return m;
        }).collect(Collectors.toList());

        long teamConflicts = interventionRepository.countActiveByTeamIdAndDateRange(
                teamId, ACTIVE_STATUSES, rangeStart, rangeEnd, orgId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("teamId", team.getId());
        result.put("teamName", team.getName());
        result.put("interventionType", team.getInterventionType());
        result.put("memberCount", team.getMemberCount());
        result.put("members", members);
        result.put("teamConflictCount", teamConflicts);
        result.put("allAvailable", members.stream().allMatch(m -> (boolean) m.get("available")));
        result.put("rangeStart", rangeStart.toString());
        result.put("rangeEnd", rangeEnd.toString());

        return result;
    }

    public Map<String, Object> checkUserAvailability(Long userId, String date, Integer durationHours) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        User targetUser = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + userId));

        LocalDateTime rangeStart = LocalDateTime.parse(date);
        int duration = durationHours != null ? durationHours : 4;
        LocalDateTime rangeEnd = rangeStart.plusHours(duration);

        long conflictCount = interventionRepository.countActiveByUserIdAndDateRange(
                userId, ACTIVE_STATUSES, rangeStart, rangeEnd, orgId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("userId", targetUser.getId());
        result.put("firstName", targetUser.getFirstName());
        result.put("lastName", targetUser.getLastName());
        result.put("available", conflictCount == 0);
        result.put("conflictCount", conflictCount);
        result.put("rangeStart", rangeStart.toString());
        result.put("rangeEnd", rangeEnd.toString());

        return result;
    }
}
