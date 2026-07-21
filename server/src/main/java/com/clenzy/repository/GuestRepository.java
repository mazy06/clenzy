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
     * Guests d'une organisation filtres par canal (non chiffre — filtrable en SQL).
     * Pre-filtre SQL de la page Voyageurs : seuls search (champs chiffres) reste
     * filtre en memoire.
     */
    @Query("SELECT g FROM Guest g WHERE g.organizationId = :orgId AND g.channel = :channel " +
           "ORDER BY g.lastName, g.firstName")
    List<Guest> findByOrganizationIdAndChannel(
            @Param("orgId") Long orgId, @Param("channel") GuestChannel channel);

    /**
     * Guests toutes organisations filtres par canal (vue platform staff).
     */
    @Query("SELECT g FROM Guest g WHERE g.channel = :channel ORDER BY g.lastName, g.firstName")
    List<Guest> findAllByChannelOrderByLastName(@Param("channel") GuestChannel channel);

    /**
     * Version paginee du listing org + canal (mode pagine sans search de la page
     * Voyageurs). NB : lastName/firstName sont chiffres AES en base → l'ORDER BY
     * porte sur le chiffre : ordre stable et deterministe mais PAS alphabetique,
     * identique au tri des variantes non paginees ci-dessus.
     */
    @Query("SELECT g FROM Guest g WHERE g.organizationId = :orgId AND g.channel = :channel " +
           "ORDER BY g.lastName, g.firstName")
    Page<Guest> findByOrganizationIdAndChannel(
            @Param("orgId") Long orgId, @Param("channel") GuestChannel channel, Pageable pageable);

    /**
     * Version paginee cross-org (platform staff). Meme remarque : tri sur les
     * valeurs chiffrees (stable, non alphabetique).
     */
    @Query("SELECT g FROM Guest g ORDER BY g.lastName, g.firstName")
    Page<Guest> findAllGuests(Pageable pageable);

    /**
     * Version paginee cross-org filtree par canal (platform staff). Tri sur les
     * valeurs chiffrees (stable, non alphabetique).
     */
    @Query("SELECT g FROM Guest g WHERE g.channel = :channel ORDER BY g.lastName, g.firstName")
    Page<Guest> findAllByChannel(@Param("channel") GuestChannel channel, Pageable pageable);

    /**
     * Guest par ID avec verification organisation.
     */
    @Query("SELECT g FROM Guest g WHERE g.id = :id AND g.organizationId = :orgId")
    Optional<Guest> findByIdAndOrganizationId(@Param("id") Long id, @Param("orgId") Long orgId);

    /**
     * Tous les guests toutes organisations confondues (super admin).
     */
    @Query("SELECT g FROM Guest g ORDER BY g.lastName, g.firstName")
    List<Guest> findAllOrderByLastName();

    /**
     * Recherche cross-org par hash de numero (relais WhatsApp entrant). Le webhook
     * est public => le filtre tenant n'est pas actif => lookup sur toutes les orgs.
     * Plusieurs resultats possibles (meme numero dans des orgs differentes).
     */
    @Query("SELECT g FROM Guest g WHERE g.phoneHash = :phoneHash")
    List<Guest> findByPhoneHash(@Param("phoneHash") String phoneHash);

    /**
     * Guests dont le phone_hash n'est pas encore calcule (backfill au boot).
     */
    @Query("SELECT g FROM Guest g WHERE g.phoneHash IS NULL")
    List<Guest> findByPhoneHashIsNull();
}
