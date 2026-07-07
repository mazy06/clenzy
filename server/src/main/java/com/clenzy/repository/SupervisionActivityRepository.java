package com.clenzy.repository;

import com.clenzy.model.SupervisionActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface SupervisionActivityRepository extends JpaRepository<SupervisionActivity, Long> {

    /** Dernières entrées d'une propriété (chrono inversé). Limiter via {@link Pageable}. */
    List<SupervisionActivity> findByOrganizationIdAndPropertyIdOrderByCreatedAtDesc(
            Long organizationId, Long propertyId, Pageable pageable);

    /** Nb d'actions d'un type depuis un instant (compteur « actions récentes »). */
    long countByOrganizationIdAndPropertyIdAndKindAndCreatedAtAfter(
            Long organizationId, Long propertyId, String kind, Instant since);

    /** Dernières entrées de TOUTE l'organisation (vue portefeuille, chrono inversé). */
    List<SupervisionActivity> findByOrganizationIdOrderByCreatedAtDesc(
            Long organizationId, Pageable pageable);

    /** Nb d'actions d'un type sur toute l'org depuis un instant (métrique portefeuille). */
    long countByOrganizationIdAndKindAndCreatedAtAfter(
            Long organizationId, String kind, Instant since);
}
