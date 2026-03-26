package com.clenzy.repository;

import com.clenzy.model.PropertyPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyPhotoRepository extends JpaRepository<PropertyPhoto, Long> {

    List<PropertyPhoto> findByPropertyIdOrderBySortOrderAsc(Long propertyId);

    int countByPropertyId(Long propertyId);

    @Modifying
    @Query("DELETE FROM PropertyPhoto p WHERE p.id = :id AND p.property.id = :propertyId")
    void deleteByIdAndPropertyId(@Param("id") Long id, @Param("propertyId") Long propertyId);

    @Query("SELECT p FROM PropertyPhoto p WHERE p.id = :id AND p.property.id = :propertyId")
    Optional<PropertyPhoto> findByIdAndPropertyId(@Param("id") Long id, @Param("propertyId") Long propertyId);
}
