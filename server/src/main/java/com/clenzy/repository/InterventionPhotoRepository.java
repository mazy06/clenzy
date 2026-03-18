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
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.intervention.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findAllByInterventionId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);

    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.photoType = :photoType AND ip.intervention.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
        @Param("interventionId") Long interventionId,
        @Param("photoType") String photoType,
        @Param("orgId") Long orgId
    );
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.id = :photoId AND ip.intervention.id = :interventionId AND ip.intervention.organizationId = :orgId")
    java.util.Optional<InterventionPhoto> findByIdAndInterventionId(
        @Param("photoId") Long photoId,
        @Param("interventionId") Long interventionId,
        @Param("orgId") Long orgId
    );

    @Modifying
    @Query("DELETE FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.intervention.organizationId = :orgId")
    void deleteByInterventionIdAndOrgId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(ip) FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.intervention.organizationId = :orgId")
    long countByInterventionId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);
}
