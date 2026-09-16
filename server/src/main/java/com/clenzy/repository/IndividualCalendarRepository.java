package com.clenzy.repository;

import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.function.Supplier;

/** Calendrier privé global : l'appelant doit avoir résolu l'identité authentifiée. */
@Repository
@org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
public class IndividualCalendarRepository {
    private final EntityManager em;
    public IndividualCalendarRepository(EntityManager em) { this.em = em; }
    public record Slot(Long id, short dayOfWeek, LocalTime startTime, LocalTime endTime) {}
    public record Absence(Long id, LocalDate startDate, LocalDate endDate, String reason) {}

    public List<Slot> weekly(Long userId) {
        return asOwner(userId, () -> rows("SELECT id, day_of_week, start_time, end_time FROM individual_weekly_availability WHERE user_id = :user ORDER BY day_of_week, start_time", userId)
            .stream().map(r -> new Slot(((Number) r[0]).longValue(), ((Number) r[1]).shortValue(),
                ((java.sql.Time) r[2]).toLocalTime(), ((java.sql.Time) r[3]).toLocalTime())).toList());
    }
    public boolean restricted(Long userId) {
        return asOwner(userId, () -> (Boolean) em.createNativeQuery("SELECT EXISTS (SELECT 1 FROM individual_calendars WHERE user_id = :user AND weekly_restricted)")
            .setParameter("user", userId).getSingleResult());
    }
    public List<Absence> absences(Long userId) {
        return asOwner(userId, () -> rows("SELECT id, start_date, end_date, reason FROM individual_absences WHERE user_id = :user ORDER BY start_date, id", userId)
            .stream().map(r -> new Absence(((Number) r[0]).longValue(), ((java.sql.Date) r[1]).toLocalDate(),
                ((java.sql.Date) r[2]).toLocalDate(), (String) r[3])).toList());
    }
    public void replaceWeekly(Long userId, List<Slot> slots) {
        asOwner(userId, () -> {
            lockAndCreate(userId);
            em.createNativeQuery("DELETE FROM individual_weekly_availability WHERE user_id = :user").setParameter("user", userId).executeUpdate();
            for (Slot s : slots) em.createNativeQuery("INSERT INTO individual_weekly_availability(user_id, day_of_week, start_time, end_time) VALUES (:user, :day, :start, :end) ON CONFLICT DO NOTHING")
                .setParameter("user", userId).setParameter("day", s.dayOfWeek()).setParameter("start", s.startTime()).setParameter("end", s.endTime()).executeUpdate();
            em.createNativeQuery("UPDATE individual_calendars SET weekly_restricted = :restricted WHERE user_id = :user")
                .setParameter("restricted", !slots.isEmpty()).setParameter("user", userId).executeUpdate();
            return null;
        });
    }
    public Absence addAbsence(Long userId, LocalDate start, LocalDate end, String reason) {
        return asOwner(userId, () -> {
            lockAndCreate(userId);
            Number id = (Number) em.createNativeQuery("INSERT INTO individual_absences(user_id, start_date, end_date, reason) VALUES (:user, :start, :end, :reason) RETURNING id")
                .setParameter("user", userId).setParameter("start", start).setParameter("end", end).setParameter("reason", reason).getSingleResult();
            return new Absence(id.longValue(), start, end, reason);
        });
    }
    public void removeAbsence(Long userId, Long id) {
        asOwner(userId, () -> {
            lockAndCreate(userId);
            em.createNativeQuery("DELETE FROM individual_absences WHERE id = :id AND user_id = :user")
                .setParameter("id", id).setParameter("user", userId).executeUpdate();
            return null;
        });
    }
    private void lockAndCreate(Long userId) {
        // Même verrou que les attributions individuelles et les équipes membres.
        em.createNativeQuery("SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(:key, 0))")
            .setParameter("key", "baitly:assignment:user:" + userId).getSingleResult();
        em.createNativeQuery("INSERT INTO individual_calendars(user_id) VALUES (:user) ON CONFLICT DO NOTHING")
            .setParameter("user", userId).executeUpdate();
    }
    @SuppressWarnings("unchecked")
    private List<Object[]> rows(String sql, Long userId) {
        return em.createNativeQuery(sql).setParameter("user", userId).getResultList();
    }
    private <T> T asOwner(Long userId, Supplier<T> operation) {
        if (userId == null || userId <= 0) throw new IllegalArgumentException("Identité requise");
        String previous = (String) em.createNativeQuery("SELECT current_setting('app.calendar_user', true)").getSingleResult();
        em.createNativeQuery("SELECT set_config('app.calendar_user', :owner, true)").setParameter("owner", userId.toString()).getSingleResult();
        T result = operation.get();
        // Une erreur SQL annule la transaction : ne pas la masquer par une requête de restauration.
        em.createNativeQuery("SELECT set_config('app.calendar_user', :owner, true)").setParameter("owner", previous == null ? "" : previous).getSingleResult();
        return result;
    }
}
