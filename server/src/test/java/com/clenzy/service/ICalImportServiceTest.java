package com.clenzy.service;

import com.clenzy.model.ICalFeed;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ICalFeedRepository;
import com.clenzy.repository.InterventionRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.ReservationRepository;
import com.clenzy.repository.ServiceRequestRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
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

    @Mock
    private ICalFeedRepository icalFeedRepository;

    @Mock
    private InterventionRepository interventionRepository;

    @Mock
    private ServiceRequestRepository serviceRequestRepository;

    @Mock
    private ReservationRepository reservationRepository2;

    @Mock
    private PropertyRepository propertyRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuditLogService auditLogService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private PricingConfigService pricingConfigService;

    private TenantContext tenantContext;
    private ICalImportService icalImportService;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(1L);

        // Construct manually because the constructor also creates an HttpClient internally
        icalImportService = new ICalImportService(
                icalFeedRepository,
                interventionRepository,
                serviceRequestRepository,
                reservationRepository2,
                propertyRepository,
                userRepository,
                auditLogService,
                notificationService,
                pricingConfigService,
                tenantContext
        );
    }

    // -- isUserAllowed tests --

    @Test
    void whenUserHasValidForfait_thenIsAllowed() {
        // Arrange
        User host = new User();
        host.setId(1L);
        host.setRole(UserRole.HOST);
        host.setForfait("confort");

        when(userRepository.findByKeycloakId("kc-host-1")).thenReturn(Optional.of(host));

        // Act
        boolean allowed = icalImportService.isUserAllowed("kc-host-1");

        // Assert
        assertTrue(allowed);
    }

    @Test
    void whenUserHasNoForfait_thenIsNotAllowed() {
        // Arrange
        User host = new User();
        host.setId(2L);
        host.setRole(UserRole.HOST);
        host.setForfait(null);

        when(userRepository.findByKeycloakId("kc-host-2")).thenReturn(Optional.of(host));

        // Act
        boolean allowed = icalImportService.isUserAllowed("kc-host-2");

        // Assert
        assertFalse(allowed);
    }

    // -- deleteFeed tests --

    @Test
    void whenDeleteFeedAsOwner_thenDeletes() {
        // Arrange
        User owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.HOST);
        owner.setKeycloakId("kc-owner-10");

        Property property = new Property();
        property.setId(20L);
        property.setOwner(owner);

        ICalFeed feed = new ICalFeed(property, "https://example.com/cal.ics", "Airbnb");
        feed.setId(100L);
        feed.setPropertyId(20L); // JPA read-only column, must set manually in tests

        when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
        when(userRepository.findByKeycloakId("kc-owner-10")).thenReturn(Optional.of(owner));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

        // Act
        icalImportService.deleteFeed(100L, "kc-owner-10");

        // Assert
        verify(icalFeedRepository).delete(feed);
    }

    @Test
    void whenDeleteFeedAsNonOwner_thenThrows() {
        // Arrange
        User owner = new User();
        owner.setId(10L);
        owner.setRole(UserRole.HOST);

        User otherUser = new User();
        otherUser.setId(99L);
        otherUser.setRole(UserRole.HOST);

        Property property = new Property();
        property.setId(20L);
        property.setOwner(owner);

        ICalFeed feed = new ICalFeed(property, "https://example.com/cal.ics", "Booking");
        feed.setId(100L);
        feed.setPropertyId(20L); // JPA read-only column, must set manually in tests

        when(icalFeedRepository.findById(100L)).thenReturn(Optional.of(feed));
        when(userRepository.findByKeycloakId("kc-other-99")).thenReturn(Optional.of(otherUser));
        when(propertyRepository.findById(20L)).thenReturn(Optional.of(property));

        // Act & Assert
        assertThrows(SecurityException.class, () -> icalImportService.deleteFeed(100L, "kc-other-99"));

        verify(icalFeedRepository, never()).delete(any(ICalFeed.class));
    }
}
