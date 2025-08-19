package com.clenzy.repository;

import com.clenzy.model.Team;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamRepository extends JpaRepository<Team, Long> {
    
    @Query("SELECT t FROM Team t WHERE t.interventionType = :interventionType")
    List<Team> findByInterventionType(@Param("interventionType") String interventionType);
    
    @Query("SELECT t FROM Team t WHERE t.name LIKE %:name%")
    List<Team> findByNameContaining(@Param("name") String name);
    
    @Query("SELECT t FROM Team t JOIN t.members tm WHERE tm.user.id = :userId")
    List<Team> findByUserId(@Param("userId") Long userId);
    
    @Query("SELECT COUNT(t) FROM Team t")
    long countTeams();
    
    @Query("SELECT COUNT(t) FROM Team t WHERE t.interventionType = :interventionType")
    long countByInterventionType(@Param("interventionType") String interventionType);
}


