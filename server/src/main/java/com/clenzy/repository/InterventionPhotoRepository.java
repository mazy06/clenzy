package com.clenzy.repository;

import com.clenzy.model.InterventionPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterventionPhotoRepository extends JpaRepository<InterventionPhoto, Long> {
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findAllByInterventionId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);

    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.phase = :phase AND ip.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findByInterventionIdAndPhaseOrderByCreatedAtAsc(
        @Param("interventionId") Long interventionId,
        @Param("phase") InterventionPhoto.PhotoPhase phase,
        @Param("orgId") Long orgId
    );

    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.id = :photoId AND ip.intervention.id = :interventionId AND ip.organizationId = :orgId")
    java.util.Optional<InterventionPhoto> findByIdAndInterventionId(
        @Param("photoId") Long photoId,
        @Param("interventionId") Long interventionId,
        @Param("orgId") Long orgId
    );

    @Modifying
    @Query("DELETE FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.organizationId = :orgId")
    void deleteByInterventionIdAndOrgId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(ip) FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.organizationId = :orgId")
    long countByInterventionId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);
}
