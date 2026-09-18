package com.clenzy.service;

import com.clenzy.repository.IndividualCalendarRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

/** Calendrier de l'identité authentifiée, commun à toutes ses organisations. */
@Service
@Transactional(readOnly = true)
public class MyAvailabilityService {
    private final UserRepository users;
    private final IndividualCalendarRepository calendars;
    private final ServiceRequestRepository assignments;
    public MyAvailabilityService(UserRepository users, IndividualCalendarRepository calendars, ServiceRequestRepository assignments) {
        this.users = users;
        this.calendars = calendars;
        this.assignments = assignments;
    }
    public List<Slot> getWeekly(String subject) { return weekly(owner(subject)); }
    public boolean isWeeklyRestricted(String subject) { return calendars.restricted(owner(subject)); }
    @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
    public Calendar getMine(String subject) {
        Long userId = owner(subject);
        return new Calendar(weekly(userId), calendars.absences(userId).stream()
            .map(a -> withConflict(userId, a)).toList(), calendars.restricted(userId));
    }
    public List<Absence> getAbsences(String subject) {
        Long userId = owner(subject);
        return calendars.absences(userId).stream().map(a -> withConflict(userId, a)).toList();
    }
    @Transactional
    public List<Slot> replaceWeekly(String subject, List<WeeklySlot> slots) {
        if (slots == null || slots.size() > 100) throw new IllegalArgumentException("Semaine invalide");
        for (WeeklySlot s : slots) if (s == null || s.dayOfWeek() == null || s.dayOfWeek() < 1 || s.dayOfWeek() > 7
            || s.startTime() == null || s.endTime() == null || !s.endTime().isAfter(s.startTime()))
            throw new IllegalArgumentException("Chaque plage doit avoir un jour valide et une fin postérieure au début");
        Long userId = owner(subject);
        calendars.replaceWeekly(userId, slots.stream().map(s -> new IndividualCalendarRepository.Slot(null, s.dayOfWeek(), s.startTime(), s.endTime())).toList());
        return weekly(userId);
    }
    @Transactional
    public Absence addAbsence(String subject, LocalDate start, LocalDate end, String reason) {
        if (start == null || end == null || end.isBefore(start) || ChronoUnit.DAYS.between(start, end) > 36500
            || (reason != null && reason.length() > 200)) throw new IllegalArgumentException("Absence invalide");
        Long userId = owner(subject);
        return withConflict(userId, calendars.addAbsence(userId, start, end, reason));
    }
    @Transactional
    public void removeAbsence(String subject, Long id) { calendars.removeAbsence(owner(subject), id); }
    private List<Slot> weekly(Long userId) {
        return calendars.weekly(userId).stream()
            .map(s -> new Slot(s.id(), s.dayOfWeek(), s.startTime(), s.endTime())).toList();
    }
    private Long owner(String subject) {
        if (subject == null || subject.isBlank()) throw new org.springframework.security.access.AccessDeniedException("Identité requise");
        return users.findByKeycloakId(subject).orElseThrow(() -> new org.springframework.security.access.AccessDeniedException("Compte introuvable")).getId();
    }
    private Absence withConflict(Long userId, IndividualCalendarRepository.Absence a) {
        int hours = Math.toIntExact((ChronoUnit.DAYS.between(a.startDate(), a.endDate()) + 1) * 24);
        boolean conflict = assignments.previewAssignmentConflicts(null, null, "user", userId, a.startDate().atStartOfDay(), hours);
        return new Absence(a.id(), a.startDate(), a.endDate(), a.reason(), conflict);
    }
    public record Slot(Long id, short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
    public record WeeklySlot(Short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
    public record Absence(Long id, LocalDate startDate, LocalDate endDate, String reason, boolean assignmentConflict) {}
    public record Calendar(List<Slot> weekly, List<Absence> absences, boolean weeklyRestricted) {}
}
