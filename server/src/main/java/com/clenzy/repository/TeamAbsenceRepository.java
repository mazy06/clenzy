package com.clenzy.repository;

import com.clenzy.model.TeamAbsence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TeamAbsenceRepository extends JpaRepository<TeamAbsence, Long> {

    List<TeamAbsence> findByTeamIdOrderByStartDateAsc(Long teamId);

    /**
     * Absences d'une equipe couvrant une date. Bornes INCLUSES des deux cotes —
     * une absence « du 12 au 19 » couvre le 19 entier.
     */
    @Query("SELECT a FROM TeamAbsence a WHERE a.teamId = :teamId "
            + "AND a.startDate <= :date AND a.endDate >= :date")
    List<TeamAbsence> findCovering(@Param("teamId") Long teamId, @Param("date") LocalDate date);
}
