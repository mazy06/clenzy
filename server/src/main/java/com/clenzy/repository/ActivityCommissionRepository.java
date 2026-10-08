package com.clenzy.repository;

import com.clenzy.model.ActivityCommission;
import com.clenzy.model.ActivityProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityCommissionRepository extends JpaRepository<ActivityCommission, Long> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from ActivityCommission c where c.id = :id and c.organizationId = :orgId")
    Optional<ActivityCommission> lockByIdAndOrganizationId(@org.springframework.data.repository.query.Param("id") Long id,
            @org.springframework.data.repository.query.Param("orgId") Long orgId);

    List<ActivityCommission> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Cle d'idempotence de l'import : un rapport d'affiliation est rejoue
     * (re-telechargement, chevauchement de periodes), et une meme reservation
     * ne doit pas crediter l'hote deux fois.
     */
    Optional<ActivityCommission> findByOrganizationIdAndProviderAndExternalBookingId(
        Long organizationId, ActivityProvider provider, String externalBookingId);
}
