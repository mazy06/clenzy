package com.clenzy.controller;

import com.clenzy.model.TeamAbsence;
import com.clenzy.model.TeamWeeklyAvailability;
import com.clenzy.service.MyAvailabilityService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Disponibilites DECLAREES PAR L'INTERVENANT lui-meme : sa semaine type et ses
 * absences.
 *
 * <p>Comme les zones, elles vivent sur son equipe PERSONNELLE — le moteur
 * d'affectation ne raisonne qu'en equipes. Toute la logique est dans le
 * service : un controller ne touche pas de repository (regle ArchUnit gelee).</p>
 */
@RestController
@RequestMapping("/api/my-availability")
@Tag(name = "Mes disponibilites")
@PreAuthorize("isAuthenticated()")
public class MyAvailabilityController {

    private final MyAvailabilityService service;

    public MyAvailabilityController(MyAvailabilityService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(summary = "Mes disponibilites")
    public ResponseEntity<AvailabilityDto> getMine(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AvailabilityDto.from(
                service.getWeekly(jwt.getSubject()),
                service.getAbsences(jwt.getSubject())));
    }

    @PutMapping("/weekly")
    @Operation(summary = "Declarer ma semaine type")
    public ResponseEntity<List<WeeklySlotDto>> replaceWeekly(
            @Valid @RequestBody List<WeeklySlotRequest> slots,
            @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(service.replaceWeekly(jwt.getSubject(), slots.stream()
                        .map(s -> new MyAvailabilityService.WeeklySlot(s.dayOfWeek(), s.startTime(), s.endTime()))
                        .toList())
                .stream().map(WeeklySlotDto::from).toList());
    }

    @PostMapping("/absences")
    @Operation(summary = "Declarer une absence")
    public ResponseEntity<AbsenceDto> addAbsence(@Valid @RequestBody AbsenceRequest request,
                                                 @AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(AbsenceDto.from(service.addAbsence(
                jwt.getSubject(), request.startDate(), request.endDate(), request.reason())));
    }

    @DeleteMapping("/absences/{id}")
    @Operation(summary = "Retirer une absence")
    public ResponseEntity<Void> removeAbsence(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        service.removeAbsence(jwt.getSubject(), id);
        return ResponseEntity.noContent().build();
    }

    public record WeeklySlotRequest(
            @NotNull @Min(1) @Max(7) Short dayOfWeek,
            @NotNull LocalTime startTime,
            @NotNull LocalTime endTime) {}

    public record AbsenceRequest(
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @Size(max = 200) String reason) {}

    public record WeeklySlotDto(Long id, Short dayOfWeek, LocalTime startTime, LocalTime endTime) {
        static WeeklySlotDto from(TeamWeeklyAvailability slot) {
            return new WeeklySlotDto(slot.getId(), slot.getDayOfWeek(), slot.getStartTime(), slot.getEndTime());
        }
    }

    public record AbsenceDto(Long id, LocalDate startDate, LocalDate endDate, String reason) {
        static AbsenceDto from(TeamAbsence absence) {
            return new AbsenceDto(absence.getId(), absence.getStartDate(),
                    absence.getEndDate(), absence.getReason());
        }
    }

    public record AvailabilityDto(List<WeeklySlotDto> weekly, List<AbsenceDto> absences) {
        static AvailabilityDto from(List<TeamWeeklyAvailability> weekly, List<TeamAbsence> absences) {
            return new AvailabilityDto(
                    weekly.stream().map(WeeklySlotDto::from).toList(),
                    absences.stream().map(AbsenceDto::from).toList());
        }
    }
}
