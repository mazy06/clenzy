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
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findAllByInterventionId(@Param("interventionId") Long interventionId);
    
    @Query("SELECT ip FROM InterventionPhoto ip WHERE ip.intervention.id = :interventionId AND ip.photoType = :photoType ORDER BY ip.createdAt ASC")
    List<InterventionPhoto> findByInterventionIdAndPhotoTypeOrderByCreatedAtAsc(
        @Param("interventionId") Long interventionId, 
        @Param("photoType") String photoType
    );
    
    void deleteByInterventionId(Long interventionId);
}
