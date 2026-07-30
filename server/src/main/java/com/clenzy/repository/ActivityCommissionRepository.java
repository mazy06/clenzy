package com.clenzy.repository;

import com.clenzy.model.ActivityCommission;
import com.clenzy.model.ActivityProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActivityCommissionRepository extends JpaRepository<ActivityCommission, Long> {

    List<ActivityCommission> findByOrganizationIdOrderByCreatedAtDesc(Long organizationId);

    /**
     * Cle d'idempotence de l'import : un rapport d'affiliation est rejoue
     * (re-telechargement, chevauchement de periodes), et une meme reservation
     * ne doit pas crediter l'hote deux fois.
     */
    Optional<ActivityCommission> findByOrganizationIdAndProviderAndExternalBookingId(
        Long organizationId, ActivityProvider provider, String externalBookingId);
}
