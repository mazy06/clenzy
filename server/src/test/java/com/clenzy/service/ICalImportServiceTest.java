package com.clenzy.service;

import com.clenzy.dto.ICalImportDto.*;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ICalImportService.
 * Focuses on business logic methods that do not require the internal HttpClient.
 * HTTP-dependent methods (fetchAndParseICalFeed, importICalFeed) are tested
 * in integration tests with Testcontainers.
 */
@ExtendWith(MockitoExtension.class)
class ICalImportServiceTest {

    @Mock private ICalFeedRepository icalFeedRepository;
    @Mock private InterventionRepository interventionRepository;
    @Mock private ServiceRequestRepository serviceRequestRepository;
    @Mock private ReservationRepository reservationRepository2;
    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private AuditLogService auditLogService;
    @Mock private NotificationService notificationService;
    @Mock private PricingConfigService pricingConfigService;

    private TenantContext tenantContext;
    private ICalImportService icalImportService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        icalImportService = new ICalImportService(
                icalFeedRepository, interventionRepository, serviceRequestRepository,
                reservationRepository2, propertyRepository, userRepository,
                auditLogService, notificationService, pricingConfigService, tenantContext
        );
    }

    private User buildHost(Long id, String keycloakId, String forfait) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setRole(UserRole.HOST);
        user.setForfait(forfait);
        user.setFirstName("Host");
        user.setLastName("User");
        return user;
    }

    private User buildAdmin(Long id, String keycloakId) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setRole(UserRole.SUPER_ADMIN);
        user.setFirstName("Admin");
        user.setLastName("User");
        return user;
    }

    private User buildManager(Long id, String keycloakId) {
        User user = new User();
        user.setId(id);
        user.setKeycloakId(keycloakId);
        user.setRole(UserRole.SUPER_MANAGER);
        user.setFirstName("Manager");
        user.setLastName("User");
        return user;
    }

    private Property buildProperty(Long id, User owner) {
        Property property = new Property();
        property.setId(id);
        property.setOwner(owner);
        property.setName("Test Property");
        return property;
    }

    private ICalFeed buildFeed(Long id, Property property, String url, String source) {
        ICalFeed feed = new ICalFeed(property, url, source);
        feed.setId(id);
        feed.setPropertyId(property.getId());
        return feed;
    }

    // ===== isUserAllowed =====

    @Nested
    @DisplayName("isUserAllowed")
    class IsUserAllowed {

        @Test
        @DisplayName("should allow host with confort forfait")
        void whenHostWithConfort_thenAllowed() {
            // Arrange
            User host = buildHost(1L, "kc-host-1", "confort");
            when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-host-1")).isTrue();
        }

        @Test
        @DisplayName("should allow host with premium forfait")
        void whenHostWithPremium_thenAllowed() {
            // Arrange
            User host = buildHost(1L, "kc-host-1", "premium");
            when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-host-1")).isTrue();
        }

        @Test
        @DisplayName("should deny host with essentiel forfait")
        void whenHostWithEssentiel_thenDenied() {
            // Arrange
            User host = buildHost(1L, "kc-host-1", "essentiel");
            when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-host-1")).isFalse();
        }

        @Test
        @DisplayName("should deny host with null forfait")
        void whenHostWithNullForfait_thenDenied() {
            // Arrange
            User host = buildHost(1L, "kc-host-1", null);
            when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-host-1")).isFalse();
        }

        @Test
        @DisplayName("should allow SUPER_ADMIN regardless of forfait")
        void whenSuperAdmin_thenAlwaysAllowed() {
            // Arrange
            User admin = buildAdmin(1L, "kc-admin-1");
            admin.setForfait(null); // No forfait
            when(userRepository.findByKeycloakId("kc-admin-1")).thenReturn(Optional.of(admin));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-admin-1")).isTrue();
        }

        @Test
        @DisplayName("should allow SUPER_MANAGER regardless of forfait")
        void whenSuperManager_thenAlwaysAllowed() {
            // Arrange
            User manager = buildManager(1L, "kc-manager-1");
            manager.setForfait(null);
            when(userRepository.findByKeycloakId("kc-manager-1")).thenReturn(Optional.of(manager));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-manager-1")).isTrue();
        }

        @Test
        @DisplayName("should return false when user not found")
        void whenUserNotFound_thenReturnsFalse() {
            // Arrange
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-unknown")).isFalse();
        }

        @Test
        @DisplayName("should handle case-insensitive forfait check")
        void whenHostWithUpperCaseForfait_thenAllowed() {
            // Arrange
            User host = buildHost(1L, "kc-host-1", "CONFORT");
            when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

            // Act & Assert
            assertThat(icalImportService.isUserAllowed("kc-host-1")).isTrue();
        }
    }

    // ===== getUserFeeds =====

    @Nested
    @DisplayName("getUserFeeds")
    class GetUserFeeds {

        @Test
        @DisplayName("should return list of feed DTOs for user")
        void whenUserHasFeeds_thenReturnsList() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");
            feed.setSyncEnabled(true);
            feed.setAutoCreateInterventions(false);

            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(icalFeedRepository.findByPropertyOwnerId(10L, ORG_ID)).thenReturn(List.of(feed));

            // Act
            List<FeedDto> result = icalImportService.getUserFeeds("kc-owner");

            // Assert
            assertThat(result).hasSize(1);
            assertThat(result.get(0).getId()).isEqualTo(100L);
            assertThat(result.get(0).getSourceName()).isEqualTo("Airbnb");
            assertThat(result.get(0).getPropertyName()).isEqualTo("Test Property");
        }

        @Test
        @DisplayName("should throw when user not found")
        void whenUserNotFound_thenThrows() {
            // Arrange
            when(userRepository.findByKeycloakId("kc-unknown")).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.getUserFeeds("kc-unknown"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("should return empty list when user has no feeds")
        void whenNoFeeds_thenReturnsEmpty() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(icalFeedRepository.findByPropertyOwnerId(10L, ORG_ID)).thenReturn(List.of());

            // Act
            List<FeedDto> result = icalImportService.getUserFeeds("kc-owner");

            // Assert
            assertThat(result).isEmpty();
        }
    }

    // ===== deleteFeed =====

    @Nested
    @DisplayName("deleteFeed")
    class DeleteFeed {

        @Test
        @DisplayName("should delete feed when user is the owner")
        void whenOwner_thenDeletes() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

            // Act
            icalImportService.deleteFeed(100L, "kc-owner");

            // Assert
            verify(icalFeedRepository).delete(feed);
        }

        @Test
        @DisplayName("should throw SecurityException when user is not the owner")
        void whenNonOwner_thenThrows() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            User other = buildHost(99L, "kc-other", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Booking");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.deleteFeed(100L, "kc-other"))
                    .isInstanceOf(SecurityException.class);
            verify(icalFeedRepository, never()).delete(any(ICalFeed.class));
        }

        @Test
        @DisplayName("should allow admin to delete any feed")
        void whenAdmin_thenDeletesAnyFeed() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            User admin = buildAdmin(1L, "kc-admin");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));

            // Act
            icalImportService.deleteFeed(100L, "kc-admin");

            // Assert
            verify(icalFeedRepository).delete(feed);
        }

        @Test
        @DisplayName("should allow manager to delete any feed")
        void whenManager_thenDeletesAnyFeed() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            User manager = buildManager(2L, "kc-manager");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-manager")).thenReturn(Optional.of(manager));

            // Act
            icalImportService.deleteFeed(100L, "kc-manager");

            // Assert
            verify(icalFeedRepository).delete(feed);
        }

        @Test
        @DisplayName("should throw when feed not found")
        void whenFeedNotFound_thenThrows() {
            // Arrange
            when(icalFeedRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.deleteFeed(999L, "kc-owner"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("should still delete when notification fails")
        void whenNotificationFails_thenStillDeletes() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            doThrow(new RuntimeException("Notification error"))
                    .when(notificationService).notify(anyString(), any(), anyString(), anyString(), anyString());

            // Act
            icalImportService.deleteFeed(100L, "kc-owner");

            // Assert
            verify(icalFeedRepository).delete(feed);
        }
    }

    // ===== toggleAutoInterventions =====

    @Nested
    @DisplayName("toggleAutoInterventions")
    class ToggleAutoInterventions {

        @Test
        @DisplayName("should toggle from false to true and return updated DTO")
        void whenFalse_thenTogglesTrue() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");
            feed.setAutoCreateInterventions(false);

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            FeedDto result = icalImportService.toggleAutoInterventions(100L, "kc-owner");

            // Assert
            assertThat(result.isAutoCreateInterventions()).isTrue();
            verify(icalFeedRepository).save(feed);
        }

        @Test
        @DisplayName("should toggle from true to false")
        void whenTrue_thenTogglesFalse() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");
            feed.setAutoCreateInterventions(true);

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));
            when(icalFeedRepository.save(any(ICalFeed.class))).thenAnswer(inv -> inv.getArgument(0));

            // Act
            FeedDto result = icalImportService.toggleAutoInterventions(100L, "kc-owner");

            // Assert
            assertThat(result.isAutoCreateInterventions()).isFalse();
        }

        @Test
        @DisplayName("should throw when user forfait not allowed")
        void whenForfaitNotAllowed_thenThrows() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "essentiel");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Airbnb");

            when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.toggleAutoInterventions(100L, "kc-owner"))
                    .isInstanceOf(SecurityException.class);
        }

        @Test
        @DisplayName("should throw when feed not found")
        void whenFeedNotFound_thenThrows() {
            // Arrange
            when(icalFeedRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.toggleAutoInterventions(999L, "kc-owner"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    // ===== syncFeeds =====

    @Nested
    @DisplayName("syncFeeds")
    class SyncFeeds {

        @Test
        @DisplayName("should skip feed when property is null")
        void whenPropertyIsNull_thenSkipsFeed() {
            // Arrange
            ICalFeed feed = new ICalFeed();
            feed.setId(1L);
            // property is null

            // Act
            icalImportService.syncFeeds(List.of(feed));

            // Assert - no exception thrown, no further processing
            verifyNoInteractions(reservationRepository2);
        }

        @Test
        @DisplayName("should skip feed when owner is null")
        void whenOwnerIsNull_thenSkipsFeed() {
            // Arrange
            Property property = new Property();
            property.setId(20L);
            property.setOwner(null);

            ICalFeed feed = new ICalFeed(property, "https://example.com/cal.ics", "Test");
            feed.setId(1L);

            // Act
            icalImportService.syncFeeds(List.of(feed));

            // Assert
            verifyNoInteractions(reservationRepository2);
        }

        @Test
        @DisplayName("should skip feed when owner has no keycloakId")
        void whenOwnerHasNoKeycloakId_thenSkipsFeed() {
            // Arrange
            User owner = buildHost(10L, null, "confort");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Test");

            // Act
            icalImportService.syncFeeds(List.of(feed));

            // Assert
            verifyNoInteractions(reservationRepository2);
        }

        @Test
        @DisplayName("should skip feed when owner forfait is not allowed")
        void whenOwnerForfaitNotAllowed_thenSkipsFeed() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "essentiel");
            Property property = buildProperty(20L, owner);
            ICalFeed feed = buildFeed(100L, property, "https://example.com/cal.ics", "Test");

            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));

            // Act
            icalImportService.syncFeeds(List.of(feed));

            // Assert
            verifyNoInteractions(reservationRepository2);
        }

        @Test
        @DisplayName("should handle exception on a feed without stopping others")
        void whenOneFeedFails_thenContinuesOthers() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            Property property = buildProperty(20L, owner);
            property.setOrganizationId(ORG_ID);

            ICalFeed failingFeed = buildFeed(100L, property, "https://bad-url.com/cal.ics", "Bad");
            ICalFeed otherFeed = buildFeed(101L, property, "https://other-url.com/cal.ics", "Other");

            when(userRepository.findByKeycloakId("kc-owner")).thenReturn(Optional.of(owner));

            // Both feeds will fail at fetchAndParseICalFeed due to URL validation,
            // but the service should continue processing
            // Act
            icalImportService.syncFeeds(List.of(failingFeed, otherFeed));

            // Assert - both feeds should have been attempted (error status set)
            verify(icalFeedRepository, atLeast(1)).save(any(ICalFeed.class));
        }

        @Test
        @DisplayName("should handle empty feed list gracefully")
        void whenEmptyList_thenDoesNothing() {
            // Act
            icalImportService.syncFeeds(List.of());

            // Assert
            verifyNoInteractions(reservationRepository2);
        }
    }

    // ===== syncAllActiveFeeds =====

    @Nested
    @DisplayName("syncAllActiveFeeds")
    class SyncAllActiveFeeds {

        @Test
        @DisplayName("should delegate to syncFeeds with active feeds from repository")
        void whenCalled_thenFetchesAndSyncs() {
            // Arrange
            when(icalFeedRepository.findBySyncEnabledTrue()).thenReturn(List.of());

            // Act
            icalImportService.syncAllActiveFeeds();

            // Assert
            verify(icalFeedRepository).findBySyncEnabledTrue();
        }
    }

    // ===== previewICalFeed - validation =====

    @Nested
    @DisplayName("previewICalFeed - validation")
    class PreviewICalFeed {

        @Test
        @DisplayName("should throw when property not found")
        void whenPropertyNotFound_thenThrows() {
            // Arrange
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.previewICalFeed("https://example.com/cal.ics", 999L))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }
    }

    // ===== importICalFeed - validation =====

    @Nested
    @DisplayName("importICalFeed - validation")
    class ImportICalFeedValidation {

        @Test
        @DisplayName("should throw when user forfait not allowed")
        void whenForfaitNotAllowed_thenThrows() {
            // Arrange
            User host = buildHost(1L, "kc-host", "essentiel");
            when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(host));

            ImportRequest request = new ImportRequest();
            request.setUrl("https://example.com/cal.ics");
            request.setPropertyId(20L);

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.importICalFeed(request, "kc-host"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("forfait");
        }

        @Test
        @DisplayName("should throw when property not found")
        void whenPropertyNotFound_thenThrows() {
            // Arrange
            User host = buildHost(1L, "kc-host", "confort");
            when(userRepository.findByKeycloakId("kc-host")).thenReturn(Optional.of(host));
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            ImportRequest request = new ImportRequest();
            request.setUrl("https://example.com/cal.ics");
            request.setPropertyId(999L);

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.importICalFeed(request, "kc-host"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("introuvable");
        }

        @Test
        @DisplayName("should throw when host does not own the property")
        void whenNotOwner_thenThrows() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            User other = buildHost(99L, "kc-other", "confort");
            Property property = buildProperty(20L, owner);

            when(userRepository.findByKeycloakId("kc-other")).thenReturn(Optional.of(other));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

            ImportRequest request = new ImportRequest();
            request.setUrl("https://example.com/cal.ics");
            request.setPropertyId(20L);

            // Act & Assert
            assertThatThrownBy(() -> icalImportService.importICalFeed(request, "kc-other"))
                    .isInstanceOf(SecurityException.class)
                    .hasMessageContaining("proprietaire");
        }

        @Test
        @DisplayName("should allow admin to import on any property")
        void whenAdminImports_thenNoOwnershipCheck() {
            // Arrange
            User owner = buildHost(10L, "kc-owner", "confort");
            User admin = buildAdmin(1L, "kc-admin");
            Property property = buildProperty(20L, owner);

            when(userRepository.findByKeycloakId("kc-admin")).thenReturn(Optional.of(admin));
            when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

            ImportRequest request = new ImportRequest();
            request.setUrl("https://invalid-url-for-test.com/cal.ics");
            request.setPropertyId(20L);
            request.setSourceName("Test");

            // Act & Assert - will fail at fetchAndParse, not at ownership check
            assertThatThrownBy(() -> icalImportService.importICalFeed(request, "kc-admin"))
                    .isNotInstanceOf(SecurityException.class);
        }
    }
}
