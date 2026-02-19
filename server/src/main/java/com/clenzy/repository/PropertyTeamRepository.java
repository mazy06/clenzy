package com.clenzy.repository;

import com.clenzy.model.PropertyTeam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyTeamRepository extends JpaRepository<PropertyTeam, Long> {

    @Query("SELECT pt FROM PropertyTeam pt LEFT JOIN FETCH pt.team WHERE pt.propertyId = :propertyId")
    Optional<PropertyTeam> findByPropertyId(@Param("propertyId") Long propertyId);

    @Query("SELECT pt FROM PropertyTeam pt LEFT JOIN FETCH pt.team WHERE pt.propertyId IN :propertyIds")
    List<PropertyTeam> findByPropertyIdIn(@Param("propertyIds") List<Long> propertyIds);

    List<PropertyTeam> findByTeamId(Long teamId);

    boolean existsByPropertyId(Long propertyId);

    void deleteByPropertyId(Long propertyId);
}
