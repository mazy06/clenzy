package com.clenzy.repository;

import com.clenzy.model.WelcomeGuide;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WelcomeGuideRepository extends JpaRepository<WelcomeGuide, Long> {

    /** Vrai si le logement a un livret d'accueil PUBLIÉ (un brouillon ne s'ouvre pas). */
    @Query("SELECT COUNT(g) > 0 FROM WelcomeGuide g WHERE g.propertyId = :propertyId "
        + "AND g.organizationId = :orgId AND g.published = true")
    boolean existsPublishedForProperty(@Param("propertyId") Long propertyId, @Param("orgId") Long orgId);


    List<WelcomeGuide> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    List<WelcomeGuide> findByPropertyIdAndOrganizationId(Long propertyId, Long organizationId);

    Optional<WelcomeGuide> findByPropertyIdAndLanguage(Long propertyId, String language);

    Optional<WelcomeGuide> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Livret rattaché à une réservation (1 livret/réservation, garanti par index unique). */
    Optional<WelcomeGuide> findByReservationId(Long reservationId);
}
