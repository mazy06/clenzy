package com.clenzy.repository;

import com.clenzy.model.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findByStatus(Incident.IncidentStatus status);

    Optional<Incident> findByTypeAndServiceNameAndStatus(
            Incident.IncidentType type, String serviceName, Incident.IncidentStatus status);

    @Query("SELECT AVG(i.resolutionMinutes) FROM Incident i " +
           "WHERE i.status = com.clenzy.model.Incident$IncidentStatus.RESOLVED " +
           "AND i.severity = com.clenzy.model.Incident$IncidentSeverity.P1 " +
           "AND i.resolvedAt >= :since")
    Optional<Double> avgP1ResolutionMinutesSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(i) FROM Incident i " +
           "WHERE i.status = com.clenzy.model.Incident$IncidentStatus.RESOLVED " +
           "AND i.severity = com.clenzy.model.Incident$IncidentSeverity.P1 " +
           "AND i.resolvedAt >= :since")
    long countResolvedP1Since(@Param("since") LocalDateTime since);

    List<Incident> findByStatusIn(List<Incident.IncidentStatus> statuses);

    List<Incident> findByStatusOrderByOpenedAtDesc(Incident.IncidentStatus status);

    List<Incident> findByOpenedAtAfterOrderByOpenedAtDesc(LocalDateTime since);

    List<Incident> findByStatusAndOpenedAtAfterOrderByOpenedAtDesc(
            Incident.IncidentStatus status, LocalDateTime since);

    long countByStatus(Incident.IncidentStatus status);
}
