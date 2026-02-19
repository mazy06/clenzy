package com.clenzy.repository;

import com.clenzy.model.InterventionPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InterventionPhotoRepository extends JpaRepository<InterventionPhoto, Long> {
    
    List<InterventionPhoto> findByInterventionIdOrderByCreatedAtAsc(Long interventionId);
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.intervention.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findAllByInterventionId(@Param("interventionId") Long interventionId, @Param("orgId") Long orgId);

    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.photoType = :photoType AND ip.intervention.organizationId = :orgId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
        @Param("interventionId") Long interventionId,
        @Param("photoType") String photoType,
        @Param("orgId") Long orgId
    );
    
    // SAFE: parent intervention is always validated with orgId before calling this delete
    void deleteByInterventionId(Long interventionId);
}
