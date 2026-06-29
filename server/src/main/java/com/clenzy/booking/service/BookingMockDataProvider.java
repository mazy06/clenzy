package com.clenzy.booking.service;

import com.clenzy.booking.dto.AvailabilityRequestDto;
import com.clenzy.booking.dto.AvailabilityResponseDto;
import com.clenzy.booking.dto.BookingCheckoutRequestDto;
import com.clenzy.booking.dto.BookingCheckoutResponseDto;
import com.clenzy.booking.dto.BookingReserveRequestDto;
import com.clenzy.booking.dto.BookingReserveResponseDto;
import com.clenzy.booking.dto.PropertyCalendarDto;
import com.clenzy.booking.dto.PropertyCalendarDto.CalendarDayDto;
import com.clenzy.booking.dto.PropertySearchFilters;
import com.clenzy.booking.dto.PublicPropertyDetailDto;
import com.clenzy.booking.dto.PublicPropertyDto;
import com.clenzy.booking.dto.PublicSearchFiltersDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Fournisseur de <strong>données de démonstration</strong> pour le Booking Engine en mode MOCK.
 *
 * <h2>Contrat</h2>
 * <p>Composant Spring <strong>pur</strong> : aucune dépendance injectée (pas de repository, pas de
 * client HTTP/Stripe, pas de {@code TenantContext}), constructeur vide. Il renvoie EXACTEMENT les
 * mêmes types de DTO que le chemin réel ({@link PublicBookingService} /
 * {@link PublicBookingCalendarService}) afin d'être un <em>drop-in</em> pour le service appelant
 * quand l'org a choisi la source de données MOCK.</p>
 *
 * <h2>Propriétés garanties</h2>
 * <ul>
 *   <li><strong>Déterministe</strong> : aucune utilisation de {@code Math.random()}. La disponibilité
 *       et les prix sont dérivés des paramètres (dates demandées, id de logement). {@code LocalDate.now()}
 *       n'est utilisé que là où un DTO de sortie l'exige (ex. {@code expiresAt} d'une réservation).</li>
 *   <li><strong>Org-agnostique</strong> : le jeu est générique, indépendant de toute organisation.</li>
 *   <li><strong>Zéro effet de bord</strong> : aucune écriture en base, aucun appel réseau, aucun appel
 *       Stripe. {@link #reserve} et {@link #checkout} renvoient des réponses SIMULÉES de succès.</li>
 * </ul>
 *
 * <h2>Devise</h2>
 * <p>Le mock <strong>ne convertit pas</strong> les montants : quand un {@code currency} non-blank est
 * fourni, la valeur est conservée telle quelle dans les DTO de sortie (étiquette d'affichage), mais les
 * montants restent ceux du jeu de démo (devise de base {@value #DEFAULT_CURRENCY}). Aucune conversion
 * réseau n'est effectuée.</p>
 *
 * <h2>Jeu de démo</h2>
 * <p>5 logements aux ids stables {@code 9001..9006} (villa, appartement, riad, studio, loft, maison de
 * campagne), avec prix/nuit, capacités, équipements et photos placeholder variés. Voir
 * {@link #DEMO_PROPERTIES}.</p>
 */
@Component
public class BookingMockDataProvider {

    /** Devise de base du jeu de démo (les montants ne sont jamais convertis). */
    static final String DEFAULT_CURRENCY = "EUR";

    /** Pays de démo. */
    private static final String DEMO_COUNTRY = "France";

    /** Frais de ménage fixes appliqués dans {@link #checkAvailability} (jeu de démo). */
    private static final BigDecimal DEMO_CLEANING_FEE = new BigDecimal("50.00");

    /** Horaires de check-in / check-out de démo. */
    private static final String DEMO_CHECK_IN_TIME = "15:00";
    private static final String DEMO_CHECK_OUT_TIME = "11:00";

    /** Photos placeholder neutres et génériques (URLs absolues, publiques). */
    private static final String PHOTO_1 = "https://placehold.co/800x600?text=Logement";
    private static final String PHOTO_2 = "https://placehold.co/800x600?text=Interieur";

    /**
     * Périodicité du motif d'indisponibilité déterministe : un jour est BLOCKED si
     * {@code dayOfMonth % BLOCKED_EVERY == 0} (aucun hasard).
     */
    private static final int BLOCKED_EVERY = 7;

    /** Catalogue de démonstration, ids stables 9001..9006. */
    private static final List<DemoProperty> DEMO_PROPERTIES = List.of(
        new DemoProperty(9001L, "Villa Azur",
            "Villa lumineuse avec piscine privée et vue dégagée, idéale pour des vacances en famille.",
            "VILLA", "Nice", new BigDecimal("450.00"), 4, 3, 8, 220,
            List.of("wifi", "piscine", "clim", "parking", "lave-vaisselle")),
        new DemoProperty(9002L, "Appartement Le Marais",
            "Appartement de charme au cœur du quartier historique, à deux pas des commerces.",
            "APARTMENT", "Paris", new BigDecimal("180.00"), 2, 1, 4, 65,
            List.of("wifi", "clim", "ascenseur")),
        new DemoProperty(9003L, "Riad El Fenn",
            "Riad traditionnel avec patio, fontaine et terrasse panoramique sur la médina.",
            "RIAD", "Marrakech", new BigDecimal("220.00"), 5, 4, 10, 300,
            List.of("wifi", "piscine", "clim", "petit-dejeuner")),
        new DemoProperty(9004L, "Studio Vieux-Port",
            "Studio fonctionnel et bien agencé, parfait pour un séjour citadin à deux.",
            "STUDIO", "Marseille", new BigDecimal("120.00"), 1, 1, 2, 28,
            List.of("wifi", "clim")),
        new DemoProperty(9005L, "Loft Industriel",
            "Vaste loft au style industriel, hauteur sous plafond et grandes verrières.",
            "LOFT", "Lyon", new BigDecimal("260.00"), 3, 2, 6, 140,
            List.of("wifi", "parking", "lave-vaisselle", "ascenseur")),
        new DemoProperty(9006L, "Gîte des Lavandes",
            "Gîte de campagne au calme, entouré de vignes et d'oliviers, avec grand jardin.",
            "COTTAGE", "Aix-en-Provence", new BigDecimal("160.00"), 3, 2, 6, 110,
            List.of("wifi", "parking", "barbecue"))
    );

    public BookingMockDataProvider() {
        // Composant pur : aucune dépendance.
    }

    // ─── Liste & facettes ─────────────────────────────────────────────────────────

    /**
     * Liste des logements de démo, filtrée par {@code filters.matches(...)} si fourni.
     *
     * @param filters  critères de recherche (peut être {@code null} ou {@link PropertySearchFilters#NONE}).
     * @param currency devise d'affichage : si non-blank, posée telle quelle sur chaque DTO (PAS de
     *                 conversion — voir Javadoc de classe) ; sinon la devise de base est conservée.
     */
    public List<PublicPropertyDto> getProperties(PropertySearchFilters filters, String currency) {
        final String display = displayCurrency(currency);
        List<PublicPropertyDto> result = new ArrayList<>();
        for (DemoProperty d : DEMO_PROPERTIES) {
            PublicPropertyDto dto = d.toPublicDto(display);
            if (filters == null || filters.matches(dto)) {
                result.add(dto);
            }
        }
        return result;
    }

    /**
     * Facettes de recherche calculées sur l'ensemble (non filtré) du jeu de démo, à l'image de
     * {@link PublicBookingService}.
     *
     * @param currency devise d'affichage (non-blank → posée telle quelle, pas de conversion).
     */
    public PublicSearchFiltersDto getSearchFilters(String currency) {
        final String display = displayCurrency(currency);
        Map<String, Integer> typeCounts = new LinkedHashMap<>();
        Map<String, Integer> amenityCounts = new LinkedHashMap<>();
        BigDecimal priceMin = null;
        BigDecimal priceMax = null;
        int maxBedrooms = 0, maxBathrooms = 0, maxGuests = 0;
        for (DemoProperty d : DEMO_PROPERTIES) {
            typeCounts.merge(d.type, 1, Integer::sum);
            for (String a : d.amenities) {
                amenityCounts.merge(a, 1, Integer::sum);
            }
            priceMin = priceMin == null ? d.pricePerNight : priceMin.min(d.pricePerNight);
            priceMax = priceMax == null ? d.pricePerNight : priceMax.max(d.pricePerNight);
            maxBedrooms = Math.max(maxBedrooms, d.bedrooms);
            maxBathrooms = Math.max(maxBathrooms, d.bathrooms);
            maxGuests = Math.max(maxGuests, d.maxGuests);
        }
        List<PublicSearchFiltersDto.Facet> types = typeCounts.entrySet().stream()
            .map(e -> new PublicSearchFiltersDto.Facet(e.getKey(), e.getValue()))
            .toList();
        List<PublicSearchFiltersDto.Facet> amenities = amenityCounts.entrySet().stream()
            .sorted((a, b) -> Integer.compare(b.getValue(), a.getValue())) // plus fréquents d'abord
            .map(e -> new PublicSearchFiltersDto.Facet(e.getKey(), e.getValue()))
            .toList();
        return new PublicSearchFiltersDto(types, amenities, priceMin, priceMax,
            maxBedrooms, maxBathrooms, maxGuests, display);
    }

    // ─── Détail ──────────────────────────────────────────────────────────────────

    /**
     * Détail d'un logement de démo (devise de base — voir Javadoc de classe pour la non-conversion).
     *
     * @throws IllegalArgumentException si l'id ne correspond à aucun logement du jeu de démo.
     */
    public PublicPropertyDetailDto getPropertyDetail(Long propertyId) {
        return findDemo(propertyId).toDetailDto();
    }

    // ─── Calendrier ─────────────────────────────────────────────────────────────

    /**
     * Grille de calendrier d'un logement de démo sur {@code months} mois (borné à 6, à l'image du
     * service réel). Disponibilité <strong>synthétique et déterministe</strong> : tout est disponible
     * sauf les jours où {@code dayOfMonth % 7 == 0} (BLOCKED). Le prix de chaque jour disponible est le
     * prix de base du logement.
     *
     * @throws IllegalArgumentException si l'id ne correspond à aucun logement du jeu de démo.
     */
    public PropertyCalendarDto getCalendar(Long propertyId, YearMonth from, int months) {
        DemoProperty d = findDemo(propertyId);
        int span = clampMonths(months);
        LocalDate start = from.atDay(1);
        LocalDate end = from.plusMonths(span - 1L).atEndOfMonth();
        int minNights = 2;

        List<CalendarDayDto> days = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            boolean blocked = isBlocked(date);
            BigDecimal price = blocked ? null : d.pricePerNight;
            days.add(new CalendarDayDto(date, !blocked, price, minNights, false, false));
        }
        return new PropertyCalendarDto(propertyId, DEFAULT_CURRENCY, days);
    }

    /**
     * Calendrier de prix AGRÉGÉ (tous logements de démo confondus) sur {@code months} mois : par jour, le
     * prix nuitée le PLUS BAS parmi les logements disponibles ce jour-là, avec la même règle de blocage
     * déterministe que {@link #getCalendar}. {@code propertyId = 0} (agrégat, pas une propriété).
     */
    public PropertyCalendarDto getPriceCalendar(YearMonth from, int months) {
        int span = clampMonths(months);
        LocalDate start = from.atDay(1);
        LocalDate end = from.plusMonths(span - 1L).atEndOfMonth();

        // Prix de base le plus bas du catalogue (déterministe, indépendant du jour).
        BigDecimal minPrice = DEMO_PROPERTIES.stream()
            .map(p -> p.pricePerNight)
            .reduce(BigDecimal::min)
            .orElse(null);

        List<CalendarDayDto> days = new ArrayList<>();
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            boolean blocked = isBlocked(date);
            BigDecimal price = blocked ? null : minPrice;
            days.add(new CalendarDayDto(date, !blocked, price, 1, false, false));
        }
        return new PropertyCalendarDto(0L, DEFAULT_CURRENCY, days);
    }

    // ─── Disponibilité (devis) ─────────────────────────────────────────────────

    /**
     * Calcule un devis de démo : breakdown nuit par nuit au prix de base du logement, + frais de ménage
     * fixes ({@value #DEMO_CLEANING_FEE} {@value #DEFAULT_CURRENCY}). Pas de taxe de séjour, pas de remise.
     * {@code available=false} si une nuit du séjour tombe sur un jour bloqué par le motif déterministe.
     *
     * @throws IllegalArgumentException si l'id ne correspond à aucun logement du jeu de démo.
     */
    public AvailabilityResponseDto checkAvailability(AvailabilityRequestDto req) {
        DemoProperty d = findDemo(req.propertyId());
        LocalDate checkIn = req.checkIn();
        LocalDate checkOut = req.checkOut();
        int guests = req.guests() != null ? req.guests() : 1;

        // Une nuit bloquée par le motif déterministe rend le séjour indisponible.
        for (LocalDate date = checkIn; date.isBefore(checkOut); date = date.plusDays(1)) {
            if (isBlocked(date)) {
                return AvailabilityResponseDto.unavailable(req.propertyId(), checkIn, checkOut, guests,
                    List.of("Dates non disponibles (démo)"));
            }
        }

        int nights = (int) ChronoUnit.DAYS.between(checkIn, checkOut);
        List<AvailabilityResponseDto.NightBreakdown> breakdown = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (LocalDate date = checkIn; date.isBefore(checkOut); date = date.plusDays(1)) {
            breakdown.add(new AvailabilityResponseDto.NightBreakdown(date, d.pricePerNight, "BASE"));
            subtotal = subtotal.add(d.pricePerNight);
        }

        BigDecimal cleaningFee = DEMO_CLEANING_FEE;
        BigDecimal touristTax = BigDecimal.ZERO;
        BigDecimal directDiscount = BigDecimal.ZERO;
        BigDecimal total = subtotal.add(cleaningFee).add(touristTax);

        return new AvailabilityResponseDto(
            true,
            d.id,
            d.name,
            checkIn,
            checkOut,
            guests,
            nights,
            breakdown,
            subtotal.setScale(2, RoundingMode.HALF_UP),
            cleaningFee.setScale(2, RoundingMode.HALF_UP),
            touristTax.setScale(2, RoundingMode.HALF_UP),
            total.setScale(2, RoundingMode.HALF_UP),
            directDiscount.setScale(2, RoundingMode.HALF_UP),
            DEFAULT_CURRENCY,
            2,
            d.maxGuests,
            DEMO_CHECK_IN_TIME,
            DEMO_CHECK_OUT_TIME,
            List.of()
        );
    }

    // ─── Réservation & paiement (simulés) ────────────────────────────────────────

    /**
     * Réservation SIMULÉE de succès : aucun effet de bord (pas de repository, pas de paiement).
     * Le code de réservation factice est déterministe : {@code MOCK-<propertyId>-<checkIn>}.
     * {@code expiresAt} utilise {@code LocalDateTime.now()} (le DTO l'exige) ; tout le reste est dérivé
     * de la requête et du jeu de démo.
     *
     * @throws IllegalArgumentException si l'id ne correspond à aucun logement du jeu de démo.
     */
    public BookingReserveResponseDto reserve(BookingReserveRequestDto req) {
        DemoProperty d = findDemo(req.propertyId());
        int nights = (int) ChronoUnit.DAYS.between(req.checkIn(), req.checkOut());
        BigDecimal total = d.pricePerNight.multiply(BigDecimal.valueOf(Math.max(nights, 0)))
            .add(DEMO_CLEANING_FEE)
            .setScale(2, RoundingMode.HALF_UP);
        String reservationCode = mockReservationCode(req.propertyId(), req.checkIn());
        return BookingReserveResponseDto.withoutVoucher(
            reservationCode,
            "PENDING",
            d.name,
            req.checkIn(),
            req.checkOut(),
            total,
            DEFAULT_CURRENCY,
            LocalDateTime.now().plusMinutes(30),
            true
        );
    }

    /**
     * Checkout SIMULÉ : renvoie une URL de confirmation factice (PAS d'appel Stripe, aucun effet de
     * bord). {@code checkoutUrl} pointe vers une page de confirmation interne factice et {@code sessionId}
     * est dérivé du code de réservation — tout est simulé.
     */
    public BookingCheckoutResponseDto checkout(BookingCheckoutRequestDto req) {
        String code = req.reservationCode() != null ? req.reservationCode() : "MOCK";
        // URL de confirmation factice (interne) — pas de redirection Stripe en mode démo.
        String checkoutUrl = "/booking/confirmation?ref=" + code + "&mock=true";
        String sessionId = "mock_session_" + code;
        return new BookingCheckoutResponseDto(checkoutUrl, sessionId);
    }

    // ─── Helpers internes ─────────────────────────────────────────────────────────

    private static String displayCurrency(String currency) {
        return (currency != null && !currency.isBlank()) ? currency : DEFAULT_CURRENCY;
    }

    private static int clampMonths(int months) {
        return Math.max(1, Math.min(months, 6));
    }

    /** Motif d'indisponibilité déterministe (aucun hasard). */
    private static boolean isBlocked(LocalDate date) {
        return date.getDayOfMonth() % BLOCKED_EVERY == 0;
    }

    private static String mockReservationCode(Long propertyId, LocalDate checkIn) {
        return "MOCK-" + propertyId + "-" + checkIn;
    }

    private static DemoProperty findDemo(Long propertyId) {
        return DEMO_PROPERTIES.stream()
            .filter(d -> d.id.equals(propertyId))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException(
                "Logement de démo introuvable pour l'id " + propertyId));
    }

    /**
     * Modèle interne immuable d'un logement de démo. {@code type} = nom d'enum
     * {@link com.clenzy.model.PropertyType} (cohérent avec {@link PublicPropertyDto#type()}).
     */
    private record DemoProperty(
        Long id,
        String name,
        String description,
        String type,
        String city,
        BigDecimal pricePerNight,
        int bedrooms,
        int bathrooms,
        int maxGuests,
        int squareMeters,
        List<String> amenities
    ) {
        PublicPropertyDto toPublicDto(String displayCurrency) {
            return new PublicPropertyDto(
                id, name, type, city, DEMO_COUNTRY,
                bedrooms, bathrooms, maxGuests, squareMeters,
                pricePerNight, DEMO_CLEANING_FEE, 2, displayCurrency,
                PHOTO_1, List.of(PHOTO_1, PHOTO_2), amenities,
                DEMO_CHECK_IN_TIME, DEMO_CHECK_OUT_TIME,
                null, null,
                4.9, 38L,
                description
            );
        }

        PublicPropertyDetailDto toDetailDto() {
            List<PublicPropertyDetailDto.PhotoDto> photos = List.of(
                new PublicPropertyDetailDto.PhotoDto(1L, PHOTO_1, "Vue principale"),
                new PublicPropertyDetailDto.PhotoDto(2L, PHOTO_2, "Intérieur")
            );
            return new PublicPropertyDetailDto(
                id, name, description, type, city, DEMO_COUNTRY,
                null, null,
                bedrooms, bathrooms, maxGuests, squareMeters,
                pricePerNight, 2, DEFAULT_CURRENCY,
                photos, amenities,
                DEMO_CHECK_IN_TIME, DEMO_CHECK_OUT_TIME,
                new PublicPropertyDetailDto.HostPublicDto("Démo", "B.", null)
            );
        }
    }
}
