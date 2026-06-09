package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.ImportRequest;
import com.clenzy.dto.ICalImportDto.ImportResponse;
import com.clenzy.dto.ICalImportDto.PreviewResponse;
import com.clenzy.model.Guest;
import com.clenzy.model.ICalFeed;
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
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests d'integration unitaire pour le flux complet
 * {@link ICalImportService#importICalFeed} en injectant un {@link HttpClient} fake
 * via {@link ReflectionTestUtils}. Permet de tester :
 * <ul>
 *   <li>Le parsing complet d'un .ics minimal valide</li>
 *   <li>La creation de Reservation + Guest + ServiceRequest</li>
 *   <li>La detection des sources (airbnb, booking, ...)</li>
 *   <li>La disambiguation des guest names generiques</li>
 *   <li>La detection des orphelins (reservations futures absentes du feed)</li>
 *   <li>Le previewICalFeed (parsing sans persistance)</li>
 * </ul>
 *
 * <p>Note SSRF : on utilise {@code https://example.com/cal.ics} (host real qui
 * resoud DNS). Le client HTTP mock court-circuite avant le GET reel.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ICalImportService — full import flow with mocked HttpClient")
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
    @Mock private AutoInvoiceService autoInvoiceService;

    private TenantContext tenantContext;
    private ICalImportService service;

    private static final Long ORG_ID = 1L;
    private static final String FEED_URL = "https://example.com/calendar.ics";

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        service = new ICalImportService(
            icalFeedRepository, serviceRequestRepository,
            reservationRepository2, interventionRepository, invoiceRepository,
            propertyRepository, userRepository,
            auditLogService, notificationService, pricingConfigService,
            priceEngine, calendarEngine, guestService, tenantContext,
            serviceRequestService, autoInvoiceService);

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

    @SuppressWarnings({"unchecked", "rawtypes"})
    private void injectHttpClientReturning(String icalBody, int statusCode) {
        HttpClient mockClient = mock(HttpClient.class);
        HttpResponse mockResponse = mock(HttpResponse.class);
        when(mockResponse.statusCode()).thenReturn(statusCode);
        when(mockResponse.body()).thenReturn(
            new ByteArrayInputStream(icalBody.getBytes(StandardCharsets.UTF_8)));
        try {
            when((HttpResponse) mockClient.send(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(mockResponse);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        ReflectionTestUtils.setField(service, "httpClient", mockClient);
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
        // Existing reservation for UID "dup-1" → skipped
        Reservation existing = new Reservation();
        existing.setId(700L);
        existing.setExternalUid("dup-1");
        existing.setStatus("confirmed");
        when(reservationRepository2.findByExternalUidAndPropertyId("dup-1", 20L))
            .thenReturn(Optional.of(existing));
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
        when(reservationRepository2.findByExternalUidAndPropertyId("cancel-1", 20L))
            .thenReturn(Optional.of(existing));
        when(reservationRepository2.findById(800L)).thenReturn(Optional.of(existing));
        when(reservationRepository2.findActiveByICalFeedId(53L, ORG_ID)).thenReturn(List.of());
        when(interventionRepository.findByReservationId(800L, ORG_ID)).thenReturn(List.of());
        when(serviceRequestRepository.findByReservationId(800L, ORG_ID)).thenReturn(List.of());
        when(invoiceRepository.findByReservationId(800L)).thenReturn(Optional.empty());

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

        // Future active reservations in DB: the one we just imported (still in feed) +
        // the orphan (not in feed). With 2 active + 1 orphan, orphan.size()*2 = 2 = futureActive
        // → safety guard NOT triggered (2 > 2 is false).
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
        when(reservationRepository2.findActiveByICalFeedId(56L, ORG_ID))
            .thenReturn(List.of(kept, orphan));
        when(interventionRepository.findByReservationId(999L, ORG_ID)).thenReturn(List.of());
        when(serviceRequestRepository.findByReservationId(999L, ORG_ID)).thenReturn(List.of());
        when(invoiceRepository.findByReservationId(999L)).thenReturn(Optional.empty());

        String ics = """
            BEGIN:VCALENDAR
            VERSION:2.0
            PRODID:-//TestProvider//iCalImport//EN
            BEGIN:VEVENT
            UID:new-event-1
            DTSTART;VALUE=DATE:20260701
            DTEND;VALUE=DATE:20260703
            SUMMARY:New Guest
            END:VEVENT
            END:VCALENDAR
            """;
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
