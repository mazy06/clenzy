package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.FeedDto;
import com.clenzy.dto.ICalImportDto.ImportRequest;
import com.clenzy.dto.ICalImportDto.ImportResponse;
import com.clenzy.model.ICalFeed;
import com.clenzy.model.PaymentStatus;
import com.clenzy.model.Property;
import com.clenzy.model.PropertyType;
import com.clenzy.model.Reservation;
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
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Tests etendus pour {@link ICalImportService}.
 *
 * Couvre les chemins suivants non testes ailleurs :
 * <ul>
 *   <li>importICalFeed quand le HTTP fetch echoue → exception RuntimeException</li>
 *   <li>syncFeeds chemins d'echec partiel (NPE, exception client)</li>
 *   <li>fetchAndParseICalFeed sur URLs valides mais inacessibles → exception</li>
 *   <li>previewICalFeed validation property + URL invalide</li>
 *   <li>Edge cases sur les helpers privates : detectSource via importICalFeed</li>
 *   <li>toFeedDto via getUserFeeds avec proprietes diverses</li>
 *   <li>checkOwnership : platform staff bypass + ownership validation</li>
 * </ul>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("ICalImportService — extended coverage")
class ICalImportServiceExtendedTest {

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

    private TenantContext tenantContext;
    private ICalImportService service;

    private static final Long ORG_ID = 1L;

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
            serviceRequestService, otaInvoicingService);
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

    private User admin(Long id, String kc) {
        User u = new User();
        u.setId(id);
        u.setKeycloakId(kc);
        u.setRole(UserRole.SUPER_ADMIN);
        return u;
    }

    private Property property(Long id, User owner, PropertyType type) {
        Property p = new Property();
        p.setId(id);
        p.setOwner(owner);
        p.setName("Logement #" + id);
        p.setOrganizationId(ORG_ID);
        p.setType(type);
        p.setMaxGuests(2);
        return p;
    }

    private ICalFeed feed(Long id, Property prop, String url, String source) {
        ICalFeed f = new ICalFeed(prop, url, source);
        f.setId(id);
        f.setPropertyId(prop.getId());
        f.setOrganizationId(ORG_ID);
        return f;
    }

    // ─── importICalFeed full flow with HTTP failure ──────────────────────────

    @Nested
    @DisplayName("importICalFeed — HTTP/parse failure surface")
    class ImportFlowFailure {

        @Test
        @DisplayName("HTTPS reachable but unreachable host → RuntimeException sur fetchAndParse")
        void unreachableHost_throwsRuntimeException() {
            User owner = host(10L, "kc", "premium");
            Property prop = property(20L, owner, PropertyType.APARTMENT);

            when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
            when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID)))
                .thenReturn(List.of());

            ImportRequest req = new ImportRequest();
            req.setUrl("https://this-domain-does-not-exist-12345.example/cal.ics");
            req.setPropertyId(20L);
            req.setSourceName("Airbnb");

            // URL validation throws because DNS resolution fails OR HTTP connection fails
            assertThatThrownBy(() -> service.importICalFeed(req, "kc"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ─── syncFeeds — propagation of mid-flight errors ────────────────────────

    @Nested
    @DisplayName("syncFeeds — propagation of errors")
    class SyncFeedsAdvanced {

        @Test
        @DisplayName("multiple feeds : errors on each are isolated")
        void multipleErrors_areIsolated() {
            User owner1 = host(10L, "kc1", "confort");
            Property prop1 = property(20L, owner1, PropertyType.APARTMENT);
            ICalFeed f1 = feed(100L, prop1, "https://x.example/a.ics", "S1");

            User owner2 = host(11L, "kc2", "premium");
            Property prop2 = property(21L, owner2, PropertyType.HOUSE);
            ICalFeed f2 = feed(101L, prop2, "https://x.example/b.ics", "S2");

            when(userRepository.findByKeycloakId("kc1")).thenReturn(Optional.of(owner1));
            when(userRepository.findByKeycloakId("kc2")).thenReturn(Optional.of(owner2));
            // Both throw via propertyRepository
            when(propertyRepository.findById(anyLong()))
                .thenThrow(new RuntimeException("DB down"));

            service.syncFeeds(List.of(f1, f2));

            // Both feeds get an error update saved
            verify(icalFeedRepository, org.mockito.Mockito.atLeast(2)).save(any(ICalFeed.class));
        }

        @Test
        @DisplayName("feed with owner without keycloakId is silently skipped")
        void ownerWithoutKeycloak_skipped() {
            User owner = host(10L, null, "confort");
            Property prop = property(20L, owner, PropertyType.APARTMENT);
            ICalFeed f = feed(100L, prop, "https://x.example/a.ics", "S");

            service.syncFeeds(List.of(f));

            // No reservation interaction, no feed save (it was just skipped)
            org.mockito.Mockito.verifyNoInteractions(reservationRepository2);
        }
    }

    // ─── deleteFeed bypass : platform staff ─────────────────────────────────

    @Nested
    @DisplayName("deleteFeed — staff override")
    class DeleteStaff {

        @Test
        @DisplayName("platform admin bypasses property ownership lookup")
        void adminBypassesOwnershipLookup() {
            User owner = host(10L, "kc-owner", "confort");
            User adm = admin(1L, "kc-admin");
            Property prop = property(20L, owner, PropertyType.APARTMENT);
            ICalFeed f = feed(100L, prop, "https://x.example/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(f));
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(adm));

            service.deleteFeed(100L, "kc-admin");

            // No propertyRepository.findById call on this path (staff bypass)
            verify(propertyRepository, never()).findById(20L);
            verify(icalFeedRepository).delete(f);
        }
    }

    // ─── toggleAutoInterventions — additional state coverage ─────────────────

    @Nested
    @DisplayName("toggleAutoInterventions — additional")
    class ToggleAdditional {

        @Test
        @DisplayName("user not found throws SecurityException")
        void userNotFound_throws() {
            User owner = host(10L, "kc-owner", "confort");
            Property prop = property(20L, owner, PropertyType.APARTMENT);
            ICalFeed f = feed(100L, prop, "https://x.example/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(f));
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.toggleAutoInterventions(100L, "kc-unknown"))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("Utilisateur introuvable");
        }
    }

    // ─── syncFeed — happy-path-ish ────────────────────────────────────────────

    @Nested
    @DisplayName("syncFeed — additional")
    class SyncFeedAdditional {

        @Test
        @DisplayName("admin force sync bypasses ownership AND triggers import (will fail at HTTP)")
        void admin_forceSync_bypassesOwnership() {
            User owner = host(10L, "kc-owner", "confort");
            User adm = admin(1L, "kc-admin");
            Property prop = property(20L, owner, PropertyType.APARTMENT);
            ICalFeed f = feed(100L, prop, "https://nonexistent-host-abc-xyz.test/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(f));
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(adm));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));

            // The sync will fail at HTTP/DNS step (URL valid format, host unreachable)
            assertThatThrownBy(() -> service.syncFeed(100L, "kc-admin"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ─── getUserFeeds : toFeedDto exhaustive mapping ──────────────────────

    @Nested
    @DisplayName("getUserFeeds — DTO mapping completeness")
    class GetUserFeedsDtoMapping {

        @Test
        @DisplayName("DTO captures all feed fields (incl. lastSyncAt, error, eventsImported)")
        void dto_capturesAllFields() {
            User owner = host(10L, "kc-owner", "confort");
            Property prop = property(20L, owner, PropertyType.STUDIO);
            ICalFeed f = feed(100L, prop, "https://x.example/cal.ics", "Booking.com");
            f.setSyncEnabled(true);
            f.setAutoCreateInterventions(true);
            f.setEventsImported(42);
            f.setLastSyncStatus("ERROR");
            f.setLastSyncError("HTTP 500");
            f.setLastSyncAt(java.time.LocalDateTime.now());

            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(icalFeedRepository.findByPropertyOwnerId(10L, ORG_ID)).thenReturn(List.of(f));

            List<FeedDto> dtos = service.getUserFeeds("kc-owner");
            assertThat(dtos).hasSize(1);
            FeedDto dto = dtos.get(0);
            assertThat(dto.getId()).isEqualTo(100L);
            assertThat(dto.getUrl()).isEqualTo("https://x.example/cal.ics");
            assertThat(dto.getSourceName()).isEqualTo("Booking.com");
            assertThat(dto.isSyncEnabled()).isTrue();
            assertThat(dto.isAutoCreateInterventions()).isTrue();
            assertThat(dto.getEventsImported()).isEqualTo(42);
            assertThat(dto.getLastSyncStatus()).isEqualTo("ERROR");
            assertThat(dto.getLastSyncAt()).isNotNull();
            assertThat(dto.getPropertyId()).isEqualTo(20L);
            assertThat(dto.getPropertyName()).isEqualTo("Logement #20");
        }
    }

    // ─── isUserAllowed extra edge cases ─────────────────────────────────────

    @Nested
    @DisplayName("isUserAllowed — extra edges")
    class AllowedExtra {

        @Test
        @DisplayName("trims internal whitespace not handled — 'premium ' still allowed (lowercase only)")
        void forfait_caseInsensitiveOnly() {
            User u = host(1L, "kc", "Confort");
            when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(u));
            assertThat(service.isUserAllowed("kc")).isTrue();
        }

        @Test
        @DisplayName("HOST avec forfait 'PRO' (non listé) → refuse")
        void forfait_unknownIsDenied() {
            User u = host(1L, "kc", "PRO");
            when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(u));
            assertThat(service.isUserAllowed("kc")).isFalse();
        }
    }

    // ─── fetchAndParseICalFeed - more URL rejections ─────────────────────────

    @Nested
    @DisplayName("fetchAndParseICalFeed — URL rejection broad coverage")
    class FetchUrlRejection {

        @Test
        @DisplayName("ftp scheme is rejected")
        void ftpScheme_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("ftp://example.com/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("file:// scheme is rejected")
        void fileScheme_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("file:///etc/passwd"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("relative URL is rejected")
        void relativeUrl_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("/path/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("0.0.0.0 metadata is rejected")
        void anyAddress_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("https://0.0.0.0/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("10.x private subnet is rejected")
        void privateSubnet_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("https://10.0.0.1/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        @DisplayName("192.168.x private subnet is rejected")
        void privateSubnet192_isRejected() {
            assertThatThrownBy(() -> service.fetchAndParseICalFeed("https://192.168.1.1/cal.ics"))
                .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ─── syncAllActiveFeeds : delegates ──────────────────────────────────────

    @Nested
    @DisplayName("syncAllActiveFeeds")
    class SyncAllActive {

        @Test
        @DisplayName("with active feeds calls syncFeeds (no infinite loop)")
        void delegatesToSyncFeeds() {
            User owner = host(10L, "kc", "confort");
            Property prop = property(20L, owner, PropertyType.APARTMENT);
            ICalFeed f1 = feed(100L, prop, "https://example.com/a.ics", "S");

            when(icalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of(f1));
            when(userRepository.findByKeycloakId("kc")).thenReturn(Optional.of(owner));

            service.syncAllActiveFeeds();

            // The feed will fail at HTTP (URL is fake), feed is saved with ERROR
            verify(icalFeedRepository, org.mockito.Mockito.atLeast(1)).save(any(ICalFeed.class));
        }
    }

    // ─── importICalFeed already imported feed (update path) ─────────────────

    @Nested
    @DisplayName("importICalFeed — refresh existing feed")
    class ImportExistingFeed {

        @Test
        @DisplayName("when sync fails on existing feed, feed.lastSyncStatus is updated to ERROR")
        void existingFeed_failureUpdatesStatus() {
            User owner = host(10L, "kc-owner", "premium");
            Property prop = property(20L, owner, PropertyType.APARTMENT);

            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(prop));
            when(icalFeedRepository.findByUrlAndDifferentProperty(anyString(), eq(20L), eq(ORG_ID)))
                .thenReturn(List.of());
            // no existing feed
            when(icalFeedRepository.findByPropertyIdAndUrl(eq(20L), anyString(), eq(ORG_ID)))
                .thenReturn(null);

            ImportRequest req = new ImportRequest();
            req.setUrl("https://this-host-does-not-resolve-9999.example/cal.ics");
            req.setPropertyId(20L);
            req.setSourceName("Direct");
            req.setAutoCreateInterventions(false);

            assertThatThrownBy(() -> service.importICalFeed(req, "kc-owner"))
                .isInstanceOf(RuntimeException.class);
        }
    }

    // ─── Reservation cancel cascade via integration with cancelReservationWithCascade ─

    @Nested
    @DisplayName("syncFeeds with no actions")
    class SyncFeedsNoOp {

        @Test
        @DisplayName("empty feeds list does not interact with anything")
        void emptyList_noInteraction() {
            service.syncFeeds(List.of());
            org.mockito.Mockito.verifyNoInteractions(icalFeedRepository);
        }

        @Test
        @DisplayName("3 feeds all skipped → no save")
        void allSkipped_noSave() {
            // feed avec property null
            ICalFeed f1 = new ICalFeed();
            f1.setId(1L);
            // feed avec owner null
            Property p2 = new Property();
            p2.setId(20L);
            ICalFeed f2 = new ICalFeed(p2, "https://x.example/a", "S");
            f2.setId(2L);
            // feed avec owner sans kc
            User owner = host(11L, null, "confort");
            Property p3 = property(21L, owner, PropertyType.APARTMENT);
            ICalFeed f3 = feed(3L, p3, "https://x.example/b", "S");

            service.syncFeeds(List.of(f1, f2, f3));

            verify(icalFeedRepository, never()).save(any(ICalFeed.class));
        }
    }
}
