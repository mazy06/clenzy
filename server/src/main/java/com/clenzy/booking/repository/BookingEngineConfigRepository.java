package com.clenzy.booking.repository;

import com.clenzy.booking.model.BookingEngineConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BookingEngineConfigRepository extends JpaRepository<BookingEngineConfig, Long> {

    /** Legacy — retourne le premier config d'une org (safe en multi-template). */
    Optional<BookingEngineConfig> findFirstByOrganizationId(Long organizationId);

    Optional<BookingEngineConfig> findByApiKey(String apiKey);

    boolean existsByOrganizationId(Long organizationId);

    /** Multi-template : tous les configs d'une org. */
    List<BookingEngineConfig> findAllByOrganizationId(Long organizationId);

    /** Recuperer un config par ID + org (securite tenant). */
    Optional<BookingEngineConfig> findByIdAndOrganizationId(Long id, Long organizationId);

    /** Verifier l'unicite du nom par org. */
    boolean existsByOrganizationIdAndName(Long organizationId, String name);
}
