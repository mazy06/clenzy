package com.clenzy.repository;

import com.clenzy.model.CheckInInstructions;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CheckInInstructionsRepository extends JpaRepository<CheckInInstructions, Long> {

    Optional<CheckInInstructions> findByPropertyId(Long propertyId);

    /** Chargement batch pour le mapping des listes de logements (évite le N+1 du toDto). */
    List<CheckInInstructions> findByPropertyIdIn(List<Long> propertyIds);

    Optional<CheckInInstructions> findByPropertyIdAndOrganizationId(Long propertyId, Long organizationId);

    /**
     * Tous les logements en rotation automatique de code, propriété chargée (scheduler hors session).
     * Cross-org : le scheduler n'a pas de contexte tenant (filtre Hibernate inactif).
     */
    @Query("SELECT c FROM CheckInInstructions c JOIN FETCH c.property WHERE c.accessCodeAutoRotate = true")
    List<CheckInInstructions> findAutoRotateWithProperty();
}
