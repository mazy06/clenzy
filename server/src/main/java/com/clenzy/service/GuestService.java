package com.clenzy.service;

import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.repository.GuestRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Service de gestion des voyageurs (guests).
 *
 * Responsabilites :
 * - Deduplication : trouver un guest existant ou en creer un nouveau
 * - Tracking : incrementer total_stays et total_spent
 *
 * La deduplication fonctionne en 2 etapes :
 * 1. Par (channel, channelGuestId) en SQL (non chiffre)
 * 2. Par email en memoire (chiffre en base → impossible en SQL)
 */
@Service
@Transactional(readOnly = true)
public class GuestService {

    private static final Logger log = LoggerFactory.getLogger(GuestService.class);

    private final GuestRepository guestRepository;

    public GuestService(GuestRepository guestRepository) {
        this.guestRepository = guestRepository;
    }

    /**
     * Trouve un guest existant ou en cree un nouveau.
     *
     * Strategie de deduplication :
     * 1. Si channel + channelGuestId fournis → recherche SQL directe
     * 2. Si email fourni → charge tous les guests de l'org et compare en memoire
     * 3. Sinon → creation d'un nouveau guest
     *
     * @param firstName     prenom (obligatoire)
     * @param lastName      nom (obligatoire)
     * @param email         email (optionnel, utilise pour dedup)
     * @param phone         telephone (optionnel)
     * @param channel       canal d'origine (optionnel)
     * @param channelGuestId ID externe du guest (optionnel)
     * @param orgId         ID de l'organisation
     * @return le guest trouve ou cree
     */
    @Transactional
    public Guest findOrCreate(String firstName, String lastName, String email, String phone,
                               GuestChannel channel, String channelGuestId, Long orgId) {

        // 1. Dedup par channel + channelGuestId (SQL direct, non chiffre)
        if (channel != null && channelGuestId != null) {
            Optional<Guest> existing = guestRepository.findByChannelAndChannelGuestId(
                    channel, channelGuestId, orgId);
            if (existing.isPresent()) {
                log.debug("Guest deduplique par channel: {} / {}", channel, channelGuestId);
                return updateIfNeeded(existing.get(), firstName, lastName, email, phone);
            }
        }

        // 2. Dedup par email (en memoire car chiffre en base)
        if (email != null && !email.isBlank()) {
            List<Guest> orgGuests = guestRepository.findByOrganizationId(orgId);
            Optional<Guest> byEmail = orgGuests.stream()
                    .filter(g -> email.equalsIgnoreCase(g.getEmail()))
                    .findFirst();
            if (byEmail.isPresent()) {
                log.debug("Guest deduplique par email pour org {}", orgId);
                return updateIfNeeded(byEmail.get(), firstName, lastName, null, phone);
            }
        }

        // 3. Creer un nouveau guest
        Guest guest = new Guest(firstName, lastName, orgId);
        guest.setEmail(email);
        guest.setPhone(phone);
        guest.setChannel(channel);
        guest.setChannelGuestId(channelGuestId);

        Guest saved = guestRepository.save(guest);
        log.info("Nouveau guest cree: {} {} (id={}, org={})", firstName, lastName, saved.getId(), orgId);
        return saved;
    }

    /**
     * Trouve un guest par son nom complet (parsing "Prenom Nom").
     * Utilise quand seul guestName est disponible (import iCal).
     *
     * @param guestName nom complet "Prenom Nom" ou "Nom"
     * @param source    source de la reservation (pour determiner le channel)
     * @param orgId     ID de l'organisation
     * @return le guest trouve ou cree
     */
    @Transactional
    public Guest findOrCreateFromName(String guestName, String source, Long orgId) {
        if (guestName == null || guestName.isBlank()) {
            return null;
        }

        String[] parts = guestName.trim().split("\\s+", 2);
        String firstName = parts[0];
        String lastName = parts.length > 1 ? parts[1] : "";

        GuestChannel channel = resolveChannel(source);
        return findOrCreate(firstName, lastName, null, null, channel, null, orgId);
    }

    /**
     * Incremente le compteur de sejours et le montant total depense.
     */
    @Transactional
    public void recordStay(Long guestId, BigDecimal amount) {
        guestRepository.findById(guestId).ifPresent(guest -> {
            guest.setTotalStays(guest.getTotalStays() + 1);
            if (amount != null) {
                guest.setTotalSpent(guest.getTotalSpent().add(amount));
            }
            guestRepository.save(guest);
            log.debug("Guest {} : total_stays={}, total_spent={}", guestId,
                    guest.getTotalStays(), guest.getTotalSpent());
        });
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Met a jour les champs d'un guest existant si les nouvelles valeurs sont non-null.
     */
    private Guest updateIfNeeded(Guest guest, String firstName, String lastName,
                                  String email, String phone) {
        boolean updated = false;
        if (firstName != null && !firstName.isBlank() && !firstName.equals(guest.getFirstName())) {
            guest.setFirstName(firstName);
            updated = true;
        }
        if (lastName != null && !lastName.isBlank() && !lastName.equals(guest.getLastName())) {
            guest.setLastName(lastName);
            updated = true;
        }
        if (email != null && !email.isBlank() && !email.equals(guest.getEmail())) {
            guest.setEmail(email);
            updated = true;
        }
        if (phone != null && !phone.isBlank() && !phone.equals(guest.getPhone())) {
            guest.setPhone(phone);
            updated = true;
        }
        if (updated) {
            guestRepository.save(guest);
        }
        return guest;
    }

    /**
     * Resout le GuestChannel a partir de la source de reservation.
     */
    private GuestChannel resolveChannel(String source) {
        if (source == null) return GuestChannel.OTHER;
        return switch (source.toLowerCase()) {
            case "airbnb" -> GuestChannel.AIRBNB;
            case "booking", "booking.com" -> GuestChannel.BOOKING;
            case "vrbo", "abritel" -> GuestChannel.VRBO;
            case "ical", "icalendar" -> GuestChannel.ICAL;
            case "manual", "direct" -> GuestChannel.DIRECT;
            default -> GuestChannel.OTHER;
        };
    }
}
