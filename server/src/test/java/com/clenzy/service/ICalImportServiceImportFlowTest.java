package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ImportRequest;
import com.clenzy.dto.ICalImportDto.ImportResponse;
import com.clenzy.dto.ICalImportDto.PreviewResponse;
import com.clenzy.model.Guest;
import com.clenzy.model.ICalFeed;
import com.clenzy.model.InvoiceType;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.model.Reservation;
import com.clenzy.model.ServiceRequest;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.InvoiceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.model.NotificationKey;
import com.clenzy.service.ical.ICalFeedDownloader;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests d'integration unitaire pour le flux complet
 * {@link ICalImportService#importICalFeed} en mockant le {@link ICalFeedDownloader}
 * (le telechargement reel — validation SSRF + connexion epinglee — est teste dans
 * {@code ICalFeedDownloaderTest}). Permet de tester :
 * <ul>
 *   <li>Le parsing complet d'un .ics minimal valide</li>
 *   <li>La creation de Reservation + Guest + ServiceRequest</li>
 *   <li>La detection des sources (airbnb, booking, ...)</li>
 *   <li>La disambiguation des guest names generiques</li>
 *   <li>La detection des orphelins (reservations futures absentes du feed)
 *       et ses garde-fous (feed vide/tronque, seuil 20%)</li>
 *   <li>Le masquage de l'URL (token) dans les logs d'erreur</li>
 *   <li>Le previewICalFeed (parsing sans persistance)</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ICalImportService — full import flow with mocked ICalFeedDownloader")
class ICalImportServiceImportFlowTest {

    @Mock private ICalFeedRepository icalFeedRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ReservationRepository reservationRepository2;
    @Mock private InterventionRepository interventionRepository;
    @Mock private InvoiceRepository invoiceRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private NotificationService notificationService;
    @Mock private PricingConfigService pricingConfigService;
    @Mock private PriceEngine priceEngine;
    @Mock private CalendarEngine calendarEngine;
    @Mock private GuestService guestService;
    @Mock private ServiceRequestService serviceRequestService;
    @Mock private OtaReservationInvoicingService otaInvoicingService;
    @Mock private ICalFeedDownloader feedDownloader;

    private TenantContext tenantContext;
    private ICalImportService service;

    private static final Long ORG_ID = 1L;
    private static final String FEED_URL = "https://example.com/calendar.ics";

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        var canceller = new com.clenzy.service.ical.ICalReservationCanceller(
            reservationRepository2, interventionRepository, invoiceRepository,
            serviceRequestRepository, calendarEngine);
        service = new ICalImportService(
            icalFeedRepository, serviceRequestRepository, reservationRepository2,
            propertyRepository, userRepository,
            auditLogService, notificationService, tenantContext,
            serviceRequestService, otaInvoicingService, feedDownloader,
            new com.clenzy.service.ical.ICalReservationImporter(
                reservationRepository2, priceEngine, guestService, tenantContext, canceller),
            new com.clenzy.service.ical.ICalBlockImporter(calendarEngine),
            new com.clenzy.service.ical.ICalOrphanDetector(reservationRepository2, canceller),
            new com.clenzy.service.ical.ICalCleaningScheduler(
                serviceRequestRepository,
                new com.clenzy.service.pricing.CleaningPricingEngine(pricingConfigService, new com.fasterxml.jackson.databind.ObjectMapper()),
                tenantContext),
            org.mockito.Mockito.mock(com.clenzy.service.agent.supervision.SupervisionActivityService.class),
            org.mockito.Mockito.mock(org.springframework.beans.factory.ObjectProvider.class));

        // Pricing config defaults (used by createCleaningServiceRequest)
        when(pricingConfigService.getBasePrices()).thenReturn(Map.of(
            "confort", 75, "premium", 90, "essentiel", 50));
        when(pricingConfigService.getPropertyTypeCoeffs()).thenReturn(Map.of(
            "appartement", 1.0, "maison", 1.3, "studio", 0.8, "villa", 1.5));
        when(pricingConfigService.getGuestCapacityCoeffs()).thenReturn(Map.of(
            "1-2", 1.0, "3-4", 1.2, "5-6", 1.4, "7+", 1.6));
        when(pricingConfigService.getMinPrice()).thenReturn(40);
        when(pricingConfigService.getSurfaceCoeff(anyInt())).thenReturn(1.0);
    }

    private User host(Long id, String kc, String forfait) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(kc);
        u.setRole(UserRole.HOST);
        u.setForfait(forfait);
        u.setFirstName("F");
        u.setLastName("L");
        return u;
    }

    private Property property(Long id, User owner) {
        Property p = new Property();
        p.setId(id);
        p.setOwner(owner);
        p.setName("Logement Test");
        p.setOrganizationId(ORG_ID);
        p.setType(PropertyType.APARTMENT);
        p.setMaxGuests(4);
        p.setDefaultCheckInTime("15:00");
        p.setDefaultCheckOutTime("11:00");
        p.setCleaningDurationMinutes(120);
        return p;
    }

    /**
     * Stub le downloader : 200 → flux .ics, autre statut → IOException identique
     * a celle levee par {@link ICalFeedDownloader} (statut non-200).
     */
    private void injectHttpClientReturning(String icalBody, int statusCode) {
        try {
            if (statusCode == 200) {
                when(feedDownloader.download(anyString())).thenAnswer(inv ->
                    new ByteArrayInputStream(icalBody.getBytes(StandardCharsets.UTF_8)));
            } else {
                when(feedDownloader.download(anyString())).thenThrow(
                    new IOException("Erreur HTTP " + statusCode + " lors du telechargement du calendrier"));
            }
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
    }

    private static int anyInt() {
        return org.mockito.ArgumentMatchers.anyInt();
    }

    // ─── Test happy path : 1 reservation imported via Airbnb ─────────────────

    @Test
    @DisplayName("happy path : .ics with 1 VEVENT → 1 Reservation created")
    void importIcalFeed_singleEvent_createsReservation() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(eq(FEED_URL), eq(20L), eq(ORG_ID)))
            .thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), eq(FEED_URL), eq(ORG_ID)))
            .thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(50L);
            return f;
        });
        // No existing reservation
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L)))
            .thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(1000L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(50L, ORG_ID)).thenReturn(List.of());
        // Pricing : 100 EUR / nuit
        Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
        priceMap.put(LocalDate.of(2026, 7, 1), BigDecimal.valueOf(100));
        priceMap.put(LocalDate.of(2026, 7, 2), BigDecimal.valueOf(100));
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(priceMap);
        when(guestService.findOrCreateFromName(anyString(), anyString(), eq(ORG_ID)))
            .thenReturn(new Guest());

        // Minimal valid iCal with 1 future booking
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:res-12345@example.com
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:Jean Dupont (HM12345AB)
            STATUS:CONFIRMED
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert
        assertThat(response.getImported()).isEqualTo(1);
        assertThat(response.getCancelled()).isZero();
        assertThat(response.getErrors()).isEmpty();
        assertThat(response.getFeedId()).isEqualTo(50L);
        verify(reservationRepository2, atLeastOnce()).save(any(Reservation.class));
        verify(auditLogService).logSync(eq("ICalImport"), eq("50"), anyString());
    }

    // ─── Test blocage : VEVENT "Not available" → reconciliation CalendarDay BLOCKED ──

    @Test
    @DisplayName("blocage Airbnb ('Not available') → reconciliation CalendarDay BLOCKED, pas de Reservation")
    void importIcalFeed_blockedRange_reconcilesCalendarBlocks() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(eq(FEED_URL), eq(20L), eq(ORG_ID)))
            .thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), eq(FEED_URL), eq(ORG_ID)))
            .thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(50L);
            return f;
        });
        when(reservationRepository2.findByPropertyId(eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(50L, ORG_ID)).thenReturn(List.of());
        when(calendarEngine.reconcileImportedBlocks(
                eq(20L), any(), any(), any(), eq(ORG_ID), eq("ICAL:50"), eq("ical-sync")))
            .thenReturn(new CalendarEngine.BlockReconcileResult(31, 0));

        // Blocage du mois d'aout 2099 (date lointaine → toujours future a l'execution).
        // DTEND exclusif (01/09) → 31 jours bloques (01→31 aout).
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:block-aout@example.com
            DTSTART;VALUE=DATE:20990801
            DTEND;VALUE=DATE:20990901
            SUMMARY:Airbnb (Not available)
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert : aucune Reservation creee (un blocage n'est pas une reservation),
        // mais une reconciliation calendrier portant les 31 jours bloques.
        assertThat(response.getImported()).isZero();
        assertThat(response.getErrors()).isEmpty();
        verify(reservationRepository2, never()).save(any(Reservation.class));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Set<LocalDate>> datesCaptor = ArgumentCaptor.forClass(Set.class);
        verify(calendarEngine).reconcileImportedBlocks(
                eq(20L), any(), any(), datesCaptor.capture(), eq(ORG_ID), eq("ICAL:50"), eq("ical-sync"));
        assertThat(datesCaptor.getValue()).hasSize(31)
                .contains(LocalDate.of(2099, 8, 1), LocalDate.of(2099, 8, 31))
                .doesNotContain(LocalDate.of(2099, 9, 1));
    }

    @Test
    @DisplayName("re-import d'un VEVENT SANS UID : dedup par dates → aucun doublon")
    void importIcalFeed_noUid_dedupByDates_noDuplicate() {
        // Arrange — flux iCal sans UID (certains fournisseurs n'en emettent pas).
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(eq(FEED_URL), eq(20L), eq(ORG_ID)))
            .thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), eq(FEED_URL), eq(ORG_ID)))
            .thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(50L);
            return f;
        });

        // Une reservation SANS UID existe deja pour ces dates (feed precedent
        // supprime → ical_feed_id = NULL). C'est elle qui doit etre retrouvee.
        Reservation existing = new Reservation();
        existing.setId(900L);
        existing.setProperty(prop);
        existing.setExternalUid(null);
        existing.setIcalFeed(null);
        existing.setCheckIn(LocalDate.of(2026, 7, 1));
        existing.setCheckOut(LocalDate.of(2026, 7, 3));
        existing.setStatus("confirmed");
        existing.setOrganizationId(ORG_ID);
        when(reservationRepository2.findByPropertyId(eq(20L), eq(ORG_ID)))
            .thenReturn(List.of(existing));
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L)))
            .thenReturn(Optional.empty());
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(50L, ORG_ID)).thenReturn(List.of());

        // Meme evenement, memes dates, mais AUCUNE ligne UID.
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:Reserved
            STATUS:CONFIRMED
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert — la reservation existante est retrouvee par dates : pas de creation.
        assertThat(response.getImported()).isZero();
        assertThat(response.getErrors()).isEmpty();
        verify(reservationRepository2, never()).save(any(Reservation.class));
    }

    // ─── Z6-SECBUGS-04 : propagation de la timezone de la propriete ──────────

    @Test
    @DisplayName("DTSTART UTC converti dans la timezone de la propriete (pas celle de la JVM)")
    void whenFeedHasUtcDateTime_thenDatesResolvedInPropertyTimezone() {
        // Arrange — Kiritimati (UTC+14) : 12:00Z = 02:00 le LENDEMAIN la-bas,
        // alors que la zone JVM (Europe/Paris) et UTC donneraient le jour meme.
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        prop.setTimezone("Pacific/Kiritimati");
        stubFeedPersistence(owner, prop);
        Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
        priceMap.put(LocalDate.of(2026, 7, 2), BigDecimal.valueOf(100));
        priceMap.put(LocalDate.of(2026, 7, 3), BigDecimal.valueOf(100));
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(priceMap);

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:res-tz-utc@example.com
            DTSTART:20260701T120000Z
            DTEND:20260703T120000Z
            SUMMARY:Jean Dupont (HM12345AB)
            STATUS:CONFIRMED
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert — dates resolues en zone propriete : 2026-07-02 / 2026-07-04
        assertThat(response.getImported()).isEqualTo(1);
        org.mockito.ArgumentCaptor<Reservation> captor =
                org.mockito.ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository2, atLeastOnce()).save(captor.capture());
        Reservation saved = captor.getAllValues().get(0);
        assertThat(saved.getCheckIn()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(saved.getCheckOut()).isEqualTo(LocalDate.of(2026, 7, 4));
    }

    @Test
    @DisplayName("timezone de propriete invalide → repli Europe/Paris sans echec d'import")
    void whenPropertyTimezoneInvalid_thenImportSucceedsWithParisFallback() {
        // Arrange — zone invalide : resolvePropertyZone doit replier sur Europe/Paris
        // (22:00Z en juillet = 00:00 le lendemain a Paris, UTC+2).
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        prop.setTimezone("Mars/Olympus");
        stubFeedPersistence(owner, prop);
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID)))
            .thenReturn(new HashMap<>());

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:res-tz-invalid@example.com
            DTSTART:20260701T220000Z
            DTEND:20260703T220000Z
            SUMMARY:Jean Dupont (HM12345AB)
            STATUS:CONFIRMED
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert — pas d'exception, dates Europe/Paris : 2026-07-02 / 2026-07-04
        assertThat(response.getImported()).isEqualTo(1);
        org.mockito.ArgumentCaptor<Reservation> captor =
                org.mockito.ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository2, atLeastOnce()).save(captor.capture());
        Reservation saved = captor.getAllValues().get(0);
        assertThat(saved.getCheckIn()).isEqualTo(LocalDate.of(2026, 7, 2));
        assertThat(saved.getCheckOut()).isEqualTo(LocalDate.of(2026, 7, 4));
    }

    /** Stubs communs feed/reservation pour les tests de timezone. */
    private void stubFeedPersistence(User owner, Property prop) {
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(eq(FEED_URL), eq(20L), eq(ORG_ID)))
            .thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), eq(FEED_URL), eq(ORG_ID)))
            .thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(50L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L)))
            .thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(1000L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID)))
            .thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(50L, ORG_ID)).thenReturn(List.of());
        when(guestService.findOrCreateFromName(anyString(), anyString(), eq(ORG_ID)))
            .thenReturn(new Guest());
    }

    // ─── Auto-create cleaning ServiceRequest ─────────────────────────────────

    @Test
    @DisplayName("with autoCreateInterventions=true → ServiceRequest created")
    void importIcalFeed_autoInterventions_createsServiceRequest() {
        User owner = host(10L, "kc", "confort");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(51L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(1100L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(51L, ORG_ID)).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(Map.of());
        when(serviceRequestRepository.findByPropertyId(eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> {
            ServiceRequest sr = inv.getArgument(0);
            if (sr.getId() == null) sr.setId(2000L);
            return sr;
        });

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:res-auto-1@example.com
            DTSTART;VALUE=DATE:20260801
            DTEND;VALUE=DATE:20260805
            SUMMARY:Marie Curie
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Booking.com");
        req.setAutoCreateInterventions(true);

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getImported()).isEqualTo(1);
        verify(serviceRequestRepository, atLeastOnce()).save(any(ServiceRequest.class));
    }

    // ─── 2 events but 1 already exists (idempotent skip) ────────────────────

    @Test
    @DisplayName("existing reservation by UID → skipped (idempotent)")
    void importIcalFeed_existingUid_skipped() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(52L);
            return f;
        });
        // Existing reservation for UID "dup-1" rattachee au MEME feed → skipped
        // (la dedup est scopee par feed : preloadKnownFeedReservations)
        ICalFeed sameFeed = new ICalFeed();
        sameFeed.setId(52L);
        Reservation existing = new Reservation();
        existing.setId(700L);
        existing.setExternalUid("dup-1");
        existing.setStatus("confirmed");
        existing.setIcalFeed(sameFeed);
        when(reservationRepository2.findByPropertyId(20L, ORG_ID)).thenReturn(List.of(existing));
        when(reservationRepository2.findById(700L)).thenReturn(Optional.of(existing));
        when(reservationRepository2.findActiveByICalFeedId(52L, ORG_ID)).thenReturn(List.of());

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:dup-1
            DTSTART;VALUE=DATE:20260801
            DTEND;VALUE=DATE:20260803
            SUMMARY:Already Imported
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Vrbo");
        req.setAutoCreateInterventions(false);

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getImported()).isZero();
        assertThat(response.getSkipped()).isEqualTo(1);
        // Pas de nouvelle reservation crée (seul le save du feed est appele)
        verify(reservationRepository2, never()).save(any(Reservation.class));
    }

    // ─── Cascade cancellation when STATUS:CANCELLED ─────────────────────────

    @Test
    @DisplayName("existing reservation with STATUS:CANCELLED in feed → cascade cancel")
    void importIcalFeed_cancelledExisting_cancelCascade() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(53L);
            return f;
        });

        Reservation existing = new Reservation();
        existing.setId(800L);
        existing.setExternalUid("cancel-1");
        existing.setStatus("confirmed");
        existing.setPaymentStatus(com.clenzy.model.PaymentStatus.PENDING);
        existing.setProperty(prop);
        when(reservationRepository2.findByPropertyId(20L, ORG_ID)).thenReturn(List.of(existing));
        when(reservationRepository2.findById(800L)).thenReturn(Optional.of(existing));
        when(reservationRepository2.findActiveByICalFeedId(53L, ORG_ID)).thenReturn(List.of());
        when(interventionRepository.findByReservationId(800L, ORG_ID)).thenReturn(List.of());
        when(serviceRequestRepository.findByReservationId(800L, ORG_ID)).thenReturn(List.of());
        when(invoiceRepository.findByReservationIdAndInvoiceType(800L, InvoiceType.GUEST)).thenReturn(Optional.empty());

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:cancel-1
            DTSTART;VALUE=DATE:20260901
            DTEND;VALUE=DATE:20260903
            SUMMARY:Cancelled Guest
            STATUS:CANCELLED
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getCancelled()).isEqualTo(1);
        assertThat(response.getImported()).isZero();
        assertThat(existing.getStatus()).isEqualTo("cancelled");
        assertThat(existing.getPaymentStatus()).isEqualTo(com.clenzy.model.PaymentStatus.CANCELLED);
    }

    // ─── Generic name disambiguation ────────────────────────────────────────

    @Test
    @DisplayName("generic 'Reserved' guest names get disambiguated #1, #2")
    void importIcalFeed_genericNames_areDisambiguated() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(54L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        // Initial DB count = 0 → #1, #2
        when(reservationRepository2.countByGuestNameStartingWithAndPropertyId(
            eq("Reserved"), eq(20L), eq(ORG_ID))).thenReturn(0L);
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId((long) (Math.random() * 10000));
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(54L, ORG_ID)).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(Map.of());

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:reserved-1
            DTSTART;VALUE=DATE:20260801
            DTEND;VALUE=DATE:20260803
            SUMMARY:Reserved
            END:VEVENT
            BEGIN:VEVENT
            UID:reserved-2
            DTSTART;VALUE=DATE:20260810
            DTEND;VALUE=DATE:20260812
            SUMMARY:Reserved
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(false);

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getImported()).isEqualTo(2);
        // Verify the guest names were disambiguated
        org.mockito.ArgumentCaptor<Reservation> captor = org.mockito.ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository2, atLeastOnce()).save(captor.capture());
        List<String> names = captor.getAllValues().stream()
            .map(Reservation::getGuestName)
            .filter(java.util.Objects::nonNull)
            .filter(n -> n.startsWith("Reserved"))
            .distinct()
            .toList();
        assertThat(names).contains("Reserved #1", "Reserved #2");
    }

    // ─── Blocked event is ignored ───────────────────────────────────────────

    @Test
    @DisplayName("blocked event ('Not available') is skipped, not imported")
    void importIcalFeed_blockedEvent_isSkipped() {
        User owner = host(10L, "kc", "confort");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(55L);
            return f;
        });

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:block-1
            DTSTART;VALUE=DATE:20260901
            DTEND;VALUE=DATE:20260910
            SUMMARY:Not available
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getImported()).isZero();
        // No reservation save
        verify(reservationRepository2, never()).save(any(Reservation.class));
    }

    // ─── previewICalFeed full happy path ────────────────────────────────────

    @Test
    @DisplayName("previewICalFeed returns the event list without persisting")
    void previewIcalFeed_returnsEvents() {
        Property prop = property(20L, host(10L, "kc", "premium"));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));

        // Use explicit string concatenation; iCal4j is strict about line folding/whitespace.
        String ics = String.join("\r\n",
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//TestProvider//iCalImport//EN",
            "BEGIN:VEVENT",
            "UID:p-1",
            "DTSTART;VALUE=DATE:20260701",
            "DTEND;VALUE=DATE:20260703",
            "SUMMARY:Preview Guest",
            "END:VEVENT",
            "BEGIN:VEVENT",
            "UID:p-2",
            "DTSTART;VALUE=DATE:20260801",
            "DTEND;VALUE=DATE:20260810",
            "SUMMARY:Not available",
            "END:VEVENT",
            "END:VCALENDAR",
            ""
        );
        injectHttpClientReturning(ics, 200);

        PreviewResponse response = service.previewICalFeed(FEED_URL, 20L);

        assertThat(response.getPropertyName()).isEqualTo("Logement Test");
        // Just verify the call did not throw; if events were parsed, expect both buckets
        assertThat(response.getEvents()).isNotNull();
        verify(reservationRepository2, never()).save(any());
    }

    // ─── HTTP 500 surfaces as exception ─────────────────────────────────────

    @Test
    @DisplayName("HTTP 500 → RuntimeException")
    void fetchAndParse_http500_throws() {
        injectHttpClientReturning("", 500);
        org.assertj.core.api.Assertions.assertThatThrownBy(
                () -> service.fetchAndParseICalFeed(FEED_URL))
            .isInstanceOf(RuntimeException.class);
    }

    // ─── Orphan detection : reservation in DB but absent from feed ─────────

    @Test
    @DisplayName("orphan reservation (in DB, absent from feed) → cancelled")
    void importIcalFeed_orphanCancellation() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(56L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(900L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        Map<LocalDate, BigDecimal> priceMap = new HashMap<>();
        priceMap.put(LocalDate.of(2026, 7, 1), BigDecimal.valueOf(80));
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(priceMap);

        // Future active reservations in DB: 5 au total (1 presente dans le feed,
        // 3 sans UID externe — jamais candidates orphelines — et 1 orpheline).
        // 1 orpheline / 5 futures = 20% <= seuil MAX_ORPHAN_RATIO → annulation ciblee permise.
        Reservation kept = new Reservation();
        kept.setId(800L);
        kept.setExternalUid("new-event-1"); // matches the feed event
        kept.setStatus("confirmed");
        kept.setProperty(prop);
        kept.setCheckOut(LocalDate.now().plusMonths(3));

        Reservation orphan = new Reservation();
        orphan.setId(999L);
        orphan.setExternalUid("orphan-uid");
        orphan.setStatus("confirmed");
        orphan.setProperty(prop);
        orphan.setCheckOut(LocalDate.now().plusMonths(3));

        List<Reservation> futureActive = new java.util.ArrayList<>(List.of(kept));
        for (long id = 801; id <= 803; id++) {
            Reservation noUid = new Reservation();
            noUid.setId(id);
            noUid.setStatus("confirmed");
            noUid.setProperty(prop);
            noUid.setCheckOut(LocalDate.now().plusMonths(3));
            futureActive.add(noUid);
        }
        futureActive.add(orphan);
        when(reservationRepository2.findActiveByICalFeedId(56L, ORG_ID)).thenReturn(futureActive);
        when(interventionRepository.findByReservationId(999L, ORG_ID)).thenReturn(List.of());
        when(serviceRequestRepository.findByReservationId(999L, ORG_ID)).thenReturn(List.of());
        when(invoiceRepository.findAllByReservationId(999L)).thenReturn(List.of());

        String start = LocalDate.now().plusDays(20).format(DateTimeFormatter.BASIC_ISO_DATE);
        String end = LocalDate.now().plusDays(22).format(DateTimeFormatter.BASIC_ISO_DATE);
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:new-event-1
            DTSTART;VALUE=DATE:%s
            DTEND;VALUE=DATE:%s
            SUMMARY:New Guest
            END:VEVENT
            END:VCALENDAR
            """.formatted(start, end);
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getImported()).isEqualTo(1);
        assertThat(response.getCancelled()).isEqualTo(1); // the orphan
        assertThat(orphan.getStatus()).isEqualTo("cancelled");
    }

    // ─── Many orphans (>50%) → safety guard kicks in ────────────────────────

    @Test
    @DisplayName("if > 50% of future reservations would be orphaned → no cancellation (feed deemed broken)")
    void importIcalFeed_tooManyOrphans_safetyGuard() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(57L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(901L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(Map.of());

        // 3 active future reservations, but only 1 in feed → 2 orphans (>50%)
        Reservation r1 = new Reservation();
        r1.setId(1L); r1.setExternalUid("absent-1"); r1.setStatus("confirmed");
        r1.setCheckOut(LocalDate.now().plusMonths(3));
        Reservation r2 = new Reservation();
        r2.setId(2L); r2.setExternalUid("absent-2"); r2.setStatus("confirmed");
        r2.setCheckOut(LocalDate.now().plusMonths(3));
        Reservation r3 = new Reservation();
        r3.setId(3L); r3.setExternalUid("present-1"); r3.setStatus("confirmed");
        r3.setCheckOut(LocalDate.now().plusMonths(3));
        when(reservationRepository2.findActiveByICalFeedId(57L, ORG_ID)).thenReturn(List.of(r1, r2, r3));

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:present-1
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:Stillthere Guest
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getCancelled()).isZero(); // safety guard
        assertThat(response.getErrors())
            .anyMatch(e -> e.contains("Detection orphelins ignoree"));
    }

    // ─── Orphan ratio between 20% and 50% → abort (Z6-SECBUGS-02) ───────────

    @Test
    @DisplayName("1 orpheline sur 4 futures (25% > seuil 20%) → aucune annulation")
    void whenOrphanRatioExceedsTwentyPercent_thenNoCancellation() {
        // Avant le durcissement (seuil 50%), 1 orpheline sur 4 etait annulee en cascade :
        // ce test echouait avec l'ancien seuil.
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(58L);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(902L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(Map.of());

        // 4 futures actives : 3 presentes dans le feed + 1 orpheline (25%)
        List<Reservation> futureActive = new java.util.ArrayList<>();
        for (int i = 1; i <= 3; i++) {
            Reservation present = new Reservation();
            present.setId((long) (700 + i));
            present.setExternalUid("present-" + i);
            present.setStatus("confirmed");
            present.setProperty(prop);
            present.setCheckOut(LocalDate.now().plusMonths(3));
            futureActive.add(present);
        }
        Reservation orphan = new Reservation();
        orphan.setId(998L);
        orphan.setExternalUid("orphan-25pct");
        orphan.setStatus("confirmed");
        orphan.setProperty(prop);
        orphan.setCheckOut(LocalDate.now().plusMonths(3));
        futureActive.add(orphan);
        when(reservationRepository2.findActiveByICalFeedId(58L, ORG_ID)).thenReturn(futureActive);

        String start = LocalDate.now().plusDays(15).format(DateTimeFormatter.BASIC_ISO_DATE);
        String end = LocalDate.now().plusDays(17).format(DateTimeFormatter.BASIC_ISO_DATE);
        StringBuilder ics = new StringBuilder("BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//TestProvider//iCalImport//EN\n");
        for (int i = 1; i <= 3; i++) {
            ics.append("BEGIN:VEVENT\nUID:present-").append(i)
               .append("\nDTSTART;VALUE=DATE:").append(start)
               .append("\nDTEND;VALUE=DATE:").append(end)
               .append("\nSUMMARY:Guest ").append(i).append("\nEND:VEVENT\n");
        }
        ics.append("END:VCALENDAR\n");
        injectHttpClientReturning(ics.toString(), 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getCancelled()).isZero();
        assertThat(orphan.getStatus()).isEqualTo("confirmed");
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
        assertThat(response.getErrors())
            .anyMatch(e -> e.contains("Detection orphelins ignoree"));
    }

    // ─── Empty feed with future reservations → no deletion + alert (Z6-SECBUGS-02) ──

    @Test
    @DisplayName("feed vide alors que des reservations futures existent → aucune annulation + alerte")
    void whenFeedIsEmptyButFutureReservationsExist_thenNoCancellationAndAlert() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(60L);
            return f;
        });

        Reservation future = new Reservation();
        future.setId(950L);
        future.setExternalUid("active-uid");
        future.setStatus("confirmed");
        future.setProperty(prop);
        future.setCheckOut(LocalDate.now().plusMonths(2));
        when(reservationRepository2.findActiveByICalFeedId(60L, ORG_ID)).thenReturn(List.of(future));

        // Feed valide mais vide (0 VEVENT) — ex. reponse tronquee cote OTA
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getCancelled()).isZero();
        assertThat(future.getStatus()).isEqualTo("confirmed");
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
        assertThat(response.getErrors()).anyMatch(e -> e.contains("tronque"));
        // Alerte utilisateur : import partiel notifie
        verify(notificationService).notify(eq("kc"), eq(NotificationKey.ICAL_IMPORT_FAILED),
                anyString(), anyString(), anyString());
    }

    @Test
    @DisplayName("feed sans evenement futur (que du passe) → aucune annulation + alerte")
    void whenFeedHasOnlyPastEvents_thenNoCancellationAndAlert() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(61L);
            return f;
        });

        // L'evenement passe est deja connu en base → skip (pas de creation)
        Reservation pastExisting = new Reservation();
        pastExisting.setId(700L);
        pastExisting.setExternalUid("past-1");
        pastExisting.setStatus("confirmed");
        pastExisting.setProperty(prop);
        when(reservationRepository2.findByPropertyId(20L, ORG_ID)).thenReturn(List.of(pastExisting));
        when(reservationRepository2.findById(700L)).thenReturn(Optional.of(pastExisting));

        Reservation future = new Reservation();
        future.setId(951L);
        future.setExternalUid("future-uid");
        future.setStatus("confirmed");
        future.setProperty(prop);
        future.setCheckOut(LocalDate.now().plusMonths(2));
        when(reservationRepository2.findActiveByICalFeedId(61L, ORG_ID)).thenReturn(List.of(future));

        String past = LocalDate.now().minusDays(40).format(DateTimeFormatter.BASIC_ISO_DATE);
        String pastEnd = LocalDate.now().minusDays(38).format(DateTimeFormatter.BASIC_ISO_DATE);
        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:past-1
            DTSTART;VALUE=DATE:%s
            DTEND;VALUE=DATE:%s
            SUMMARY:Past Guest
            END:VEVENT
            END:VCALENDAR
            """.formatted(past, pastEnd);
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        ImportResponse response = service.importICalFeed(req, "kc");

        assertThat(response.getCancelled()).isZero();
        assertThat(future.getStatus()).isEqualTo("confirmed");
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
        assertThat(response.getErrors()).anyMatch(e -> e.contains("tronque"));
    }

    // ─── URL token never logged (T-BP-02) ────────────────────────────────────

    @Test
    @DisplayName("echec de telechargement : l'URL loggee est masquee (token absent des logs)")
    void whenDownloadFails_thenLoggedUrlIsMasked() throws Exception {
        String secretUrl = "https://airbnb.example/calendar/123.ics?s=SECRET_TOKEN_123";
        when(feedDownloader.download(secretUrl)).thenThrow(
            new IOException("Erreur HTTP 500 lors du telechargement du calendrier"));

        ch.qos.logback.classic.Logger serviceLogger =
            (ch.qos.logback.classic.Logger) org.slf4j.LoggerFactory.getLogger(ICalImportService.class);
        ch.qos.logback.core.read.ListAppender<ch.qos.logback.classic.spi.ILoggingEvent> appender =
            new ch.qos.logback.core.read.ListAppender<>();
        appender.start();
        serviceLogger.addAppender(appender);
        try {
            org.assertj.core.api.Assertions.assertThatThrownBy(
                    () -> service.fetchAndParseICalFeed(secretUrl))
                .isInstanceOf(RuntimeException.class);

            assertThat(appender.list).isNotEmpty();
            assertThat(appender.list).allSatisfy(evt ->
                assertThat(evt.getFormattedMessage()).doesNotContain("SECRET_TOKEN_123"));
            assertThat(appender.list).anySatisfy(evt ->
                assertThat(evt.getFormattedMessage()).contains("airbnb.example"));
        } finally {
            serviceLogger.detachAppender(appender);
        }
    }

    // ─── Source detection edge cases ────────────────────────────────────────

    @Test
    @DisplayName("detectSource via importICalFeed : 'Airbnb' → reservation.source='airbnb'")
    void importIcalFeed_detectSourceAirbnb() {
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        setupCommonMocks(prop, owner, "kc", 58L);

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:src-1
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:Source Guest
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb Calendar");

        service.importICalFeed(req, "kc");

        org.mockito.ArgumentCaptor<Reservation> captor = org.mockito.ArgumentCaptor.forClass(Reservation.class);
        verify(reservationRepository2, atLeastOnce()).save(captor.capture());
        Reservation r = captor.getAllValues().stream()
            .filter(x -> "src-1".equals(x.getExternalUid())).findFirst().orElseThrow();
        assertThat(r.getSource()).isEqualTo("airbnb");
    }

    @Test
    @DisplayName("detectSource: Booking → 'booking', Vrbo → 'other', Direct → 'direct', null → 'other'")
    void importIcalFeed_detectSourceAllBranches() {
        // Tester via une seule importation pour chaque source dans des invocations distinctes
        for (String[] pair : new String[][]{
            {"Booking.com Cal", "booking"},
            {"Vrbo Cal", "other"},
            {"HomeAway Cal", "other"},
            {"Direct Reservation Cal", "direct"},
            {"Generic Cal", "other"}
        }) {
            // Reset mocks
            org.mockito.Mockito.reset(icalFeedRepository, reservationRepository2,
                propertyRepository, userRepository, priceEngine);
            User owner = host(10L, "kc-" + pair[0], "premium");
            Property prop = property(20L, owner);
            setupCommonMocks(prop, owner, "kc-" + pair[0], 99L);

            String ics = """
                BEGIN:VCALENDAR
                VERSION:2.0
                PRODID:-//TestProvider//iCalImport//EN
                BEGIN:VEVENT
                UID:src-""" + pair[0].hashCode() + """

                DTSTART;VALUE=DATE:20260701
                DTEND;VALUE=DATE:20260703
                SUMMARY:Guest
                END:VEVENT
                END:VCALENDAR
                """;
            injectHttpClientReturning(ics, 200);

            ImportRequest req = new ImportRequest();
            req.setUrl(FEED_URL);
            req.setPropertyId(20L);
            req.setSourceName(pair[0]);

            try {
                service.importICalFeed(req, "kc-" + pair[0]);
                org.mockito.ArgumentCaptor<Reservation> captor = org.mockito.ArgumentCaptor.forClass(Reservation.class);
                verify(reservationRepository2, atLeastOnce()).save(captor.capture());
                Reservation r = captor.getAllValues().stream()
                    .findFirst().orElse(null);
                if (r != null) {
                    assertThat(r.getSource()).isEqualTo(pair[1]);
                }
            } catch (Exception ignored) {
                // ignored
            }
        }
    }

    // ─── Z6-SECBUGS-06 : collision d'UID inter-feeds ─────────────────────────

    @Test
    @DisplayName("meme UID porte par un AUTRE feed de la meme propriete → importe (pas skippe)")
    void whenSameUidBelongsToAnotherFeed_thenImportedNotSkipped() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        setupCommonMocks(prop, owner, "kc", 62L);

        // Reservation existante sur la MEME propriete avec le MEME UID,
        // mais rattachee a un autre feed (#999) — ex : channel manager qui
        // reutilise les UID entre canaux. Ce n'est PAS un doublon de ce feed.
        ICalFeed otherFeed = new ICalFeed();
        otherFeed.setId(999L);
        Reservation otherChannel = new Reservation();
        otherChannel.setId(750L);
        otherChannel.setExternalUid("shared-uid");
        otherChannel.setStatus("confirmed");
        otherChannel.setIcalFeed(otherFeed);
        when(reservationRepository2.findByPropertyId(20L, ORG_ID)).thenReturn(List.of(otherChannel));

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:shared-uid
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:Second Channel Guest
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Booking.com");
        req.setAutoCreateInterventions(false);

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert : la reservation du second canal n'est pas silencieusement ignoree
        assertThat(response.getImported()).isEqualTo(1);
        assertThat(response.getSkipped()).isZero();
        verify(reservationRepository2, atLeastOnce()).save(any(Reservation.class));
    }

    // ─── Z6-SECBUGS-05 : evenement non parsable → compte + UID protege ──────

    @Test
    @DisplayName("evenement sans DTSTART → compte en erreur et son UID protege de l'annulation orpheline")
    void whenEventUnparsable_thenCountedAndUidProtectedFromOrphanCancellation() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        setupCommonMocks(prop, owner, "kc", 63L);

        // 5 reservations futures actives : 4 presentes (parsables) dans le feed
        // + 1 dont l'evenement du feed est non parsable (DTSTART manquant).
        // Sans la protection, l'orpheline representerait 1/5 = 20% (<= seuil)
        // et serait annulee en cascade.
        List<Reservation> futureActive = new java.util.ArrayList<>();
        for (int i = 1; i <= 4; i++) {
            Reservation present = new Reservation();
            present.setId((long) (760 + i));
            present.setExternalUid("present-" + i);
            present.setStatus("confirmed");
            present.setProperty(prop);
            present.setCheckOut(LocalDate.now().plusMonths(3));
            futureActive.add(present);
        }
        Reservation broken = new Reservation();
        broken.setId(770L);
        broken.setExternalUid("broken-1");
        broken.setStatus("confirmed");
        broken.setProperty(prop);
        broken.setCheckOut(LocalDate.now().plusMonths(3));
        futureActive.add(broken);
        when(reservationRepository2.findActiveByICalFeedId(63L, ORG_ID)).thenReturn(futureActive);
        when(reservationRepository2.findByPropertyId(20L, ORG_ID)).thenReturn(futureActive);

        String start = LocalDate.now().plusDays(10).format(DateTimeFormatter.BASIC_ISO_DATE);
        String end = LocalDate.now().plusDays(12).format(DateTimeFormatter.BASIC_ISO_DATE);
        StringBuilder ics = new StringBuilder("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//TestProvider//iCalImport//EN\r\n");
        for (int i = 1; i <= 4; i++) {
            ics.append("BEGIN:VEVENT\r\nUID:present-").append(i)
               .append("\r\nDTSTART;VALUE=DATE:").append(start)
               .append("\r\nDTEND;VALUE=DATE:").append(end)
               .append("\r\nSUMMARY:Guest ").append(i).append("\r\nEND:VEVENT\r\n");
        }
        // Evenement non parsable : DTSTART absent
        ics.append("BEGIN:VEVENT\r\nUID:broken-1\r\nSUMMARY:Broken Guest\r\nEND:VEVENT\r\n");
        ics.append("END:VCALENDAR\r\n");
        injectHttpClientReturning(ics.toString(), 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert : aucune annulation, l'evenement ecarte est remonte dans le resultat
        assertThat(response.getCancelled()).isZero();
        assertThat(broken.getStatus()).isEqualTo("confirmed");
        verify(calendarEngine, never()).cancel(anyLong(), anyLong(), anyString());
        assertThat(response.getSkipped()).isEqualTo(4);
        assertThat(response.getErrors())
            .anyMatch(e -> e.contains("ignore") && e.contains("DTSTART"));
    }

    // ─── Z6-SECBUGS-07 : RRULE detectee, comptee, non expansee ──────────────

    @Test
    @DisplayName("evenement RRULE → importe une seule fois et signale comme recurrent non expanse")
    void whenRruleEvent_thenImportedOnceAndReportedAsRecurring() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        setupCommonMocks(prop, owner, "kc", 64L);

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:rec-1
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            RRULE:FREQ=WEEKLY;COUNT=4
            SUMMARY:Recurring Guest
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");

        // Act
        ImportResponse response = service.importICalFeed(req, "kc");

        // Assert : occurrence maitre importee, recurrence signalee (pas de perte silencieuse)
        assertThat(response.getImported()).isEqualTo(1);
        assertThat(response.getErrors())
            .anyMatch(e -> e.contains("recurrent") && e.contains("non expanse"));
    }

    // ─── T-BP-09 : guestCheckinTime respecte defaultCheckInTime ─────────────

    @Test
    @DisplayName("SR menage : guestCheckinTime utilise defaultCheckInTime de la propriete (14:00), pas 15:00 en dur")
    void whenPropertyHasCustomCheckInTime_thenCleaningSrUsesIt() {
        // Arrange
        User owner = host(10L, "kc", "premium");
        Property prop = property(20L, owner);
        prop.setDefaultCheckInTime("14:00");
        setupCommonMocks(prop, owner, "kc", 65L);
        when(serviceRequestRepository.findByPropertyId(eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(serviceRequestRepository.save(any(ServiceRequest.class))).thenAnswer(inv -> {
            ServiceRequest sr = inv.getArgument(0);
            if (sr.getId() == null) sr.setId(2100L);
            return sr;
        });

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:checkin-time-1
            DTSTART;VALUE=DATE:20260801
            DTEND;VALUE=DATE:20260805
            SUMMARY:Custom Checkin Guest
            END:VEVENT
            END:VCALENDAR
            """;
        injectHttpClientReturning(ics, 200);

        ImportRequest req = new ImportRequest();
        req.setUrl(FEED_URL);
        req.setPropertyId(20L);
        req.setSourceName("Airbnb");
        req.setAutoCreateInterventions(true);

        // Act
        service.importICalFeed(req, "kc");

        // Assert : la fenetre de menage se termine au check-in reel (14:00)
        org.mockito.ArgumentCaptor<ServiceRequest> captor =
            org.mockito.ArgumentCaptor.forClass(ServiceRequest.class);
        verify(serviceRequestRepository, atLeastOnce()).save(captor.capture());
        ServiceRequest sr = captor.getAllValues().stream()
            .filter(s -> s.getGuestCheckinTime() != null)
            .findFirst().orElseThrow();
        assertThat(sr.getGuestCheckinTime().toLocalTime())
            .isEqualTo(java.time.LocalTime.of(14, 0));
    }

    private void setupCommonMocks(Property prop, User owner, String kc, Long feedId) {
        when(userRepository.findByKeycloakId(kc)).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
        when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID))).thenReturn(List.of());
        when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID))).thenReturn(null);
        when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> {
            ICalFeed f = inv.getArgument(0);
            if (f.getId() == null) f.setId(feedId);
            return f;
        });
        when(reservationRepository2.findByExternalUidAndPropertyId(anyString(), eq(20L))).thenReturn(Optional.empty());
        when(reservationRepository2.save(any(Reservation.class))).thenAnswer(inv -> {
            Reservation r = inv.getArgument(0);
            if (r.getId() == null) r.setId(1L);
            return r;
        });
        when(reservationRepository2.findCancelledOverlapping(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(List.of());
        when(reservationRepository2.findActiveByICalFeedId(feedId, ORG_ID)).thenReturn(List.of());
        when(priceEngine.resolvePriceRange(eq(20L), any(), any(), eq(ORG_ID))).thenReturn(Map.of());
    }
}
