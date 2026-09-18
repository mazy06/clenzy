package com.clenzy.controller;


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
 * <p>Le calendrier appartient à la personne, indépendamment des organisations clientes.</p>
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
        var calendar = service.getMine(jwt.getSubject());
        return ResponseEntity.ok(AvailabilityDto.from(
                calendar.weekly(), calendar.absences(), calendar.weeklyRestricted()));
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
        static WeeklySlotDto from(MyAvailabilityService.Slot slot) {
            return new WeeklySlotDto(slot.id(), slot.dayOfWeek(), slot.startTime(), slot.endTime());
        }
    }

    public record AbsenceDto(Long id, LocalDate startDate, LocalDate endDate, String reason, boolean assignmentConflict) {
        static AbsenceDto from(MyAvailabilityService.Absence absence) {
            return new AbsenceDto(absence.id(), absence.startDate(),
                    absence.endDate(), absence.reason(), absence.assignmentConflict());
        }
    }

    public record AvailabilityDto(List<WeeklySlotDto> weekly, List<AbsenceDto> absences, boolean weeklyRestricted) {
        static AvailabilityDto from(List<MyAvailabilityService.Slot> weekly, List<MyAvailabilityService.Absence> absences, boolean weeklyRestricted) {
            return new AvailabilityDto(
                    weekly.stream().map(WeeklySlotDto::from).toList(),
                    absences.stream().map(AbsenceDto::from).toList(), weeklyRestricted);
        }
    }
}
