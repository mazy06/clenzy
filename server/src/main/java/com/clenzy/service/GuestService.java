package com.clenzy.service;

import com.clenzy.dto.GuestDto;
import com.clenzy.dto.GuestListDto;
import com.clenzy.dto.GuestPageDto;
import com.clenzy.model.Guest;
import com.clenzy.model.GuestChannel;
import com.clenzy.model.Organization;
import com.clenzy.repository.GuestRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.util.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service de gestion des voyageurs (guests).
 *
 * Responsabilites :
 * - Deduplication : trouver un guest existant ou en creer un nouveau
 * - Tracking : incrementer total_stays et total_spent
 * - Lectures et mise a jour pour la page Voyageurs (listing, recherche, email)
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
    private final ReservationRepository reservationRepository;
    private final OrganizationService organizationService;

    public GuestService(GuestRepository guestRepository,
                        ReservationRepository reservationRepository,
                        OrganizationService organizationService) {
        this.guestRepository = guestRepository;
        this.reservationRepository = reservationRepository;
        this.organizationService = organizationService;
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
        // Note: les emails sont chiffres en base → impossible de filtrer en SQL.
        // On utilise une pagination pour eviter de charger tous les guests en memoire d'un coup.
        if (email != null && !email.isBlank()) {
            int pageSize = 500;
            int page = 0;
            while (true) {
                org.springframework.data.domain.Page<Guest> guestPage = guestRepository.findByOrganizationId(
                        orgId, org.springframework.data.domain.PageRequest.of(page, pageSize));
                Optional<Guest> byEmail = guestPage.getContent().stream()
                        .filter(g -> email.equalsIgnoreCase(g.getEmail()))
                        .findFirst();
                if (byEmail.isPresent()) {
                    log.debug("Guest deduplique par email pour org {} (page {})", orgId, page);
                    return updateIfNeeded(byEmail.get(), firstName, lastName, null, phone);
                }
                if (!guestPage.hasNext()) break;
                page++;
            }
        }

        // 3. Creer un nouveau guest
        Guest guest = new Guest(firstName, lastName, orgId);
        guest.setEmail(email);
        guest.setPhone(phone);
        guest.setPhoneHash(StringUtils.computePhoneHash(phone, guest.getCountryCode()));
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

    /**
     * Recalcule totalStays et totalSpent pour tous les guests a partir des reservations confirmees.
     * Utile pour corriger les compteurs apres une migration ou un import.
     *
     * @return le nombre de guests mis a jour
     */
    @Transactional
    public int recalculateAllStats() {
        List<Guest> allGuests = guestRepository.findAll();
        int updated = 0;

        // 1 seule requete agregee (GROUP BY guest_id) au lieu d'1 requete
        // reservations par guest (audit perf 2026-07-21). Lignes
        // [guestId, count, totalSpent] ; guest absent = 0 sejour confirme.
        record ConfirmedStats(long stays, BigDecimal spent) {}
        Map<Long, ConfirmedStats> statsByGuest = reservationRepository.aggregateConfirmedStaysByGuest()
                .stream()
                .collect(Collectors.toMap(
                        row -> (Long) row[0],
                        row -> new ConfirmedStats(((Number) row[1]).longValue(), (BigDecimal) row[2])));

        for (Guest guest : allGuests) {
            ConfirmedStats stats = statsByGuest.getOrDefault(guest.getId(),
                    new ConfirmedStats(0L, BigDecimal.ZERO));
            long confirmedStays = stats.stays();
            BigDecimal totalSpent = stats.spent();

            if (guest.getTotalStays() != (int) confirmedStays
                    || guest.getTotalSpent().compareTo(totalSpent) != 0) {
                guest.setTotalStays((int) confirmedStays);
                guest.setTotalSpent(totalSpent);
                guestRepository.save(guest);
                updated++;
                log.info("Guest {} recalculated: stays={}, spent={}",
                        guest.getId(), confirmedStays, totalSpent);
            }
        }

        log.info("Recalculated stats for {} guests ({} updated)", allGuests.size(), updated);
        return updated;
    }

    // ================================================================
    // Lectures et mise a jour pour la page Voyageurs
    // (logique deplacee depuis GuestController — refactor T-ARCH-01)
    // ================================================================

    /**
     * Listing complet pour la page Voyageurs.
     *
     * <p>Filtres : {@code channel} et {@code organizationId} ne sont PAS chiffres
     * → filtres en SQL. Le filtre {@code search} porte sur firstName/lastName/email,
     * chiffres AES-256 en base → impossible en SQL, il reste applique en memoire.
     * C'est la limite structurelle de ce listing (assumee, audit perf 2026-07-21) :
     * la reduction se fait en amont via les filtres SQL.</p>
     *
     * @param organizationId org du requester ; {@code null} = platform staff
     *                       (SUPER_ADMIN/SUPER_MANAGER), lecture cross-org avec
     *                       resolution des noms d'organisation
     */
    public List<GuestListDto> listGuests(Long organizationId, String search, String channel) {
        boolean crossTenant = organizationId == null;

        // Filtre channel en SQL (champ non chiffre). Un libelle inconnu ne matche
        // aucun canal — meme resultat vide que l'ancien filtre memoire.
        GuestChannel channelFilter;
        try {
            channelFilter = parseChannelFilter(channel);
        } catch (IllegalArgumentException e) {
            return List.of();
        }

        List<Guest> guests = fetchScope(crossTenant, organizationId, channelFilter);
        Map<Long, String> orgNames = crossTenant ? organizationNamesById() : Map.of();
        String lowerSearch = normalizeSearch(search);

        return guests.stream()
                // Filtre search (en memoire — champs chiffres, cf. javadoc)
                .filter(g -> lowerSearch == null || matchesSearch(g, lowerSearch))
                .map(g -> toListDto(g, orgNames.getOrDefault(g.getOrganizationId(), null)))
                .toList();
    }

    /**
     * Listing pagine (opt-in) de la page Voyageurs.
     *
     * <p>Sans {@code search} : pagination SQL vraie (org + channel filtres en SQL,
     * count SQL). L'ORDER BY lastName/firstName porte sur les valeurs CHIFFREES
     * (AES) : ordre stable et deterministe mais non alphabetique — strictement le
     * meme tri que le mode non pagine ({@code findAllOrderByLastName} & co).</p>
     *
     * <p>Avec {@code search} (&ge; 2 caracteres) : le scope org/channel est charge
     * (filtres SQL), le filtre search est applique en memoire apres dechiffrement
     * (champs chiffres — limite structurelle assumee, cf. {@link #listGuests}),
     * PUIS la page est decoupee cote serveur : le payload reseau reste borne a la
     * page demandee, c'est le gain principal.</p>
     *
     * @param organizationId org du requester ; {@code null} = platform staff (cross-org)
     */
    public GuestPageDto listGuestsPage(Long organizationId, String search, String channel,
                                       int page, int size) {
        boolean crossTenant = organizationId == null;

        GuestChannel channelFilter;
        try {
            channelFilter = parseChannelFilter(channel);
        } catch (IllegalArgumentException e) {
            return new GuestPageDto(List.of(), page, size, 0);
        }

        String lowerSearch = normalizeSearch(search);
        Map<Long, String> orgNames = crossTenant ? organizationNamesById() : Map.of();

        if (lowerSearch == null) {
            Pageable pageable = PageRequest.of(page, size);
            Page<Guest> guestPage;
            if (crossTenant) {
                guestPage = channelFilter != null
                        ? guestRepository.findAllByChannel(channelFilter, pageable)
                        : guestRepository.findAllGuests(pageable);
            } else {
                guestPage = channelFilter != null
                        ? guestRepository.findByOrganizationIdAndChannel(organizationId, channelFilter, pageable)
                        : guestRepository.findByOrganizationId(organizationId, pageable);
            }
            List<GuestListDto> content = guestPage.getContent().stream()
                    .map(g -> toListDto(g, orgNames.getOrDefault(g.getOrganizationId(), null)))
                    .toList();
            return new GuestPageDto(content, page, size, guestPage.getTotalElements());
        }

        // Search : scope reduit en SQL (org + channel), filtre dechiffre en memoire,
        // puis decoupage serveur de la page.
        List<Guest> filtered = fetchScope(crossTenant, organizationId, channelFilter).stream()
                .filter(g -> matchesSearch(g, lowerSearch))
                .toList();
        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        List<GuestListDto> content = filtered.subList(from, to).stream()
                .map(g -> toListDto(g, orgNames.getOrDefault(g.getOrganizationId(), null)))
                .toList();
        return new GuestPageDto(content, page, size, filtered.size());
    }

    /**
     * Recherche par nom dans l'organisation (en memoire car firstName/lastName
     * sont chiffres en base). Limite a 20 resultats. L'appelant garantit un
     * terme d'au moins 2 caracteres.
     */
    public List<GuestDto> searchByName(Long organizationId, String search) {
        String lowerSearch = search.toLowerCase().trim();

        return guestRepository.findByOrganizationId(organizationId).stream()
                .filter(g -> {
                    String fn = g.getFirstName() != null ? g.getFirstName().toLowerCase() : "";
                    String ln = g.getLastName() != null ? g.getLastName().toLowerCase() : "";
                    String full = fn + " " + ln;
                    return fn.contains(lowerSearch) || ln.contains(lowerSearch)
                            || full.contains(lowerSearch);
                })
                .limit(20)
                .map(GuestService::toDto)
                .toList();
    }

    /**
     * Met a jour l'email d'un voyageur de l'organisation.
     * {@code findById} ne passe pas par le filtre Hibernate organizationFilter :
     * l'ownership org est valide explicitement (cross-org = introuvable).
     *
     * @return le DTO mis a jour, ou {@code Optional.empty()} si le guest
     *         n'existe pas ou appartient a une autre organisation
     */
    @Transactional
    public Optional<GuestDto> updateGuestEmail(Long guestId, Long organizationId, String email) {
        return guestRepository.findById(guestId)
                .filter(g -> g.getOrganizationId().equals(organizationId))
                .map(guest -> {
                    guest.setEmail(email.trim());
                    guestRepository.save(guest);
                    return toDto(guest);
                });
    }

    /**
     * Met à jour la fiche d'un voyageur existant (org-scopé). Applique les champs fournis :
     * prénom/nom/langue seulement si non vides ; email/téléphone/pays/notes sont écrits tels
     * quels (vidés si chaîne vide). Renvoie le DTO à jour, ou vide si le voyageur n'existe pas
     * dans l'organisation.
     */
    public Optional<GuestDto> updateGuest(Long guestId, Long organizationId, GuestDto dto) {
        return guestRepository.findById(guestId)
                .filter(g -> g.getOrganizationId().equals(organizationId))
                .map(guest -> {
                    if (dto.firstName() != null && !dto.firstName().isBlank()) guest.setFirstName(dto.firstName().trim());
                    if (dto.lastName() != null && !dto.lastName().isBlank()) guest.setLastName(dto.lastName().trim());
                    if (dto.email() != null) guest.setEmail(dto.email().isBlank() ? null : dto.email().trim());
                    if (dto.phone() != null) guest.setPhone(dto.phone().isBlank() ? null : dto.phone().trim());
                    if (dto.countryCode() != null) guest.setCountryCode(dto.countryCode().isBlank() ? null : dto.countryCode().trim());
                    if (dto.language() != null && !dto.language().isBlank()) guest.setLanguage(dto.language().trim());
                    if (dto.notes() != null) guest.setNotes(dto.notes().isBlank() ? null : dto.notes().trim());
                    guestRepository.save(guest);
                    return toDto(guest);
                });
    }

    // ================================================================
    // Mapping DTO
    // ================================================================

    public static GuestDto toDto(Guest g) {
        return new GuestDto(
                g.getId(),
                g.getFirstName(),
                g.getLastName(),
                g.getEmail(),
                g.getPhone(),
                g.getFullName(),
                g.getLanguage(),
                g.getCountryCode(),
                g.getNotes()
        );
    }

    /**
     * Crée (ou déduplique) un voyageur DIRECT puis applique les infos optionnelles
     * (langue, pays, notes) fournies au formulaire. Langue/pays sont mis à jour si
     * fournis ; les notes ne le sont que si le voyageur n'en a pas déjà (évite d'écraser
     * à la déduplication par email).
     */
    public GuestDto createDirect(GuestDto dto, Long orgId) {
        Guest guest = findOrCreate(
                dto.firstName(), dto.lastName(), dto.email(), dto.phone(),
                GuestChannel.DIRECT, null, orgId);

        boolean changed = false;
        if (dto.language() != null && !dto.language().isBlank()) {
            guest.setLanguage(dto.language().trim());
            changed = true;
        }
        if (dto.countryCode() != null && !dto.countryCode().isBlank()) {
            guest.setCountryCode(dto.countryCode().trim());
            changed = true;
        }
        if (dto.notes() != null && !dto.notes().isBlank()
                && (guest.getNotes() == null || guest.getNotes().isBlank())) {
            guest.setNotes(dto.notes().trim());
            changed = true;
        }
        if (changed) {
            guest = guestRepository.save(guest);
        }
        return toDto(guest);
    }

    private static GuestListDto toListDto(Guest g, String organizationName) {
        return new GuestListDto(
                g.getId(),
                g.getFirstName(),
                g.getLastName(),
                g.getEmail(),
                g.getPhone(),
                g.getFullName(),
                g.getChannel() != null ? g.getChannel().name() : null,
                g.getTotalStays(),
                g.getTotalSpent(),
                g.getLanguage(),
                g.getCreatedAt(),
                g.getOrganizationId(),
                organizationName
        );
    }

    // ================================================================
    // Helpers
    // ================================================================

    /**
     * Parse le filtre canal (champ non chiffre → filtrable en SQL).
     *
     * @return l'enum, ou {@code null} si le filtre est absent/blanc
     * @throws IllegalArgumentException si le libelle est inconnu (l'appelant
     *         retourne alors un resultat vide, comme l'ancien filtre memoire)
     */
    private static GuestChannel parseChannelFilter(String channel) {
        if (channel == null || channel.isBlank()) {
            return null;
        }
        return GuestChannel.valueOf(channel.trim().toUpperCase(Locale.ROOT));
    }

    /** Terme de recherche normalise (minuscules, trim), ou {@code null} si &lt; 2 caracteres. */
    private static String normalizeSearch(String search) {
        return (search != null && search.length() >= 2) ? search.toLowerCase().trim() : null;
    }

    /** Match search sur prenom/nom/nom complet/email (valeurs dechiffrees en memoire). */
    private static boolean matchesSearch(Guest g, String lowerSearch) {
        String fn = g.getFirstName() != null ? g.getFirstName().toLowerCase() : "";
        String ln = g.getLastName() != null ? g.getLastName().toLowerCase() : "";
        String email = g.getEmail() != null ? g.getEmail().toLowerCase() : "";
        String full = fn + " " + ln;
        return fn.contains(lowerSearch) || ln.contains(lowerSearch)
                || full.contains(lowerSearch) || email.contains(lowerSearch);
    }

    /** Scope SQL du listing : org (ou cross-org) + canal, tri chiffre stable. */
    private List<Guest> fetchScope(boolean crossTenant, Long organizationId, GuestChannel channelFilter) {
        if (crossTenant) {
            return channelFilter != null
                    ? guestRepository.findAllByChannelOrderByLastName(channelFilter)
                    : guestRepository.findAllOrderByLastName();
        }
        return channelFilter != null
                ? guestRepository.findByOrganizationIdAndChannel(organizationId, channelFilter)
                : guestRepository.findByOrganizationId(organizationId);
    }

    /** Lookup des noms d'organisation (vue cross-tenant platform staff). */
    private Map<Long, String> organizationNamesById() {
        return organizationService.findAll().stream()
                .collect(Collectors.toMap(Organization::getId, Organization::getName, (a, b) -> a));
    }

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
            guest.setPhoneHash(StringUtils.computePhoneHash(phone, guest.getCountryCode()));
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
