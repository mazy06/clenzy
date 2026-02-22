package com.clenzy.repository;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

public interface GuestRepository extends JpaRepository<Guest, Long> {

    /**
     * Deduplication par canal et ID guest externe.
     * Utilisable en SQL car ces champs ne sont pas chiffres.
     */
    @Query("SELECT g FROM Guest g WHERE g.channel = :channel " +
           "AND g.channelGuestId = :channelGuestId AND g.organizationId = :orgId")
    Optional<Guest> findByChannelAndChannelGuestId(
            @Param("channel") GuestChannel channel,
            @Param("channelGuestId") String channelGuestId,
            @Param("orgId") Long orgId);

    /**
     * Tous les guests d'une organisation.
     * Utilise pour la deduplication par email en memoire
     * (l'email est chiffre en base, pas de recherche SQL possible).
     */
    @Query("SELECT g FROM Guest g WHERE g.organizationId = :orgId ORDER BY g.lastName, g.firstName")
    List<Guest> findByOrganizationId(@Param("orgId") Long orgId);

    /**
     * Version paginee pour la deduplication par email en memoire.
     * Evite de charger tous les guests en memoire d'un coup.
     */
    @Query("SELECT g FROM Guest g WHERE g.organizationId = :orgId ORDER BY g.lastName, g.firstName")
    Page<Guest> findByOrganizationId(@Param("orgId") Long orgId, Pageable pageable);

    /**
     * Guest par ID avec verification organisation.
     */
    @Query("SELECT g FROM Guest g WHERE g.id = :id AND g.organizationId = :orgId")
    Optional<Guest> findByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long orgId);
}
