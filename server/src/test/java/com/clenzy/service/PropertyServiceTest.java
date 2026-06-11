package com.clenzy.service;

import com.clenzy.dto.PropertyDto;
import com.clenzy.exception.NotFoundException;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PropertyServiceTest {

    @Mock private PropertyRepository propertyRepository;
    @Mock private UserRepository userRepository;
    @Mock private ManagerPropertyRepository managerPropertyRepository;
    @Mock private PortfolioClientRepository portfolioClientRepository;
    @Mock private PortfolioRepository portfolioRepository;
    @Mock private CheckInInstructionsRepository checkInInstructionsRepository;
    @Mock private com.clenzy.integration.airbnb.repository.AirbnbListingMappingRepository listingMappingRepository;
    @Mock private NotificationService notificationService;

    private TenantContext tenantContext;
    private PropertyService propertyService;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        tenantContext.setOrganizationId(ORG_ID);

        propertyService = new PropertyService(
                propertyRepository, userRepository, managerPropertyRepository,
                portfolioClientRepository, portfolioRepository,
                checkInInstructionsRepository, listingMappingRepository,
                notificationService, tenantContext,
                new com.clenzy.service.access.OrganizationAccessGuard(tenantContext));
    }

    private User buildOwner(Long id) {
        User owner = new User();
        owner.setId(id);
        owner.setFirstName("Owner");
        owner.setLastName("Test");
        owner.setEmail("owner@test.com");
        owner.setKeycloakId("kc-" + id);
        owner.setRole(UserRole.HOST);
        return owner;
    }

    private Property buildProperty(Long id, User owner) {
        Property property = new Property();
        property.setId(id);
        property.setName("Property " + id);
        property.setAddress("123 Rue Test");
        property.setCity("Paris");
        property.setOwner(owner);
        property.setType(PropertyType.APARTMENT);
        property.setStatus(PropertyStatus.ACTIVE);
        property.setBedroomCount(2);
        property.setBathroomCount(1);
        property.setOrganizationId(ORG_ID);
        return property;
    }

    // ===== CREATE =====

    @Nested
    class Create {

        @Test
        void whenValidDto_thenCreatesPropertyWithOrg() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });

            PropertyDto dto = new PropertyDto();
            dto.name = "Mon Appartement";
            dto.address = "10 Rue Test";
            dto.city = "Paris";
            dto.type = PropertyType.APARTMENT;
            dto.status = PropertyStatus.ACTIVE;
            dto.ownerId = 1L;
            dto.bedroomCount = 2;
            dto.bathroomCount = 1;

            PropertyDto result = propertyService.create(dto);

            assertThat(result).isNotNull();
            assertThat(result.name).isEqualTo("Mon Appartement");
            assertThat(result.ownerId).isEqualTo(1L);

            ArgumentCaptor<Property> captor = ArgumentCaptor.forClass(Property.class);
            verify(propertyRepository).save(captor.capture());
            assertThat(captor.getValue().getOrganizationId()).isEqualTo(ORG_ID);
        }

        @Test
        void whenOwnerNotFound_thenThrowsNotFoundException() {
            when(userRepository.findById(999L)).thenReturn(Optional.empty());

            PropertyDto dto = new PropertyDto();
            dto.name = "Test";
            dto.address = "Test";
            dto.ownerId = 999L;

            assertThatThrownBy(() -> propertyService.create(dto))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenNotificationFails_thenPropertyIsStillCreated() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });
            doThrow(new RuntimeException("Notif error")).when(notificationService)
                    .notifyAdminsAndManagers(any(), any(), any(), any());

            PropertyDto dto = new PropertyDto();
            dto.name = "Test";
            dto.address = "Test";
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            assertThat(result).isNotNull();
        }
    }

    // ===== UPDATE =====

    @Nested
    class Update {

        @Test
        void whenPropertyExists_thenUpdatesFields() {
            User owner = buildOwner(1L);
            Property existing = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "Updated Name";
            dto.city = "Lyon";
            dto.bedroomCount = 3;

            PropertyDto result = propertyService.update(10L, dto);

            assertThat(result.name).isEqualTo("Updated Name");
            assertThat(result.city).isEqualTo("Lyon");
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> propertyService.update(999L, new PropertyDto()))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== GET BY ID =====

    @Nested
    class GetById {

        @Test
        void whenPropertyExists_thenReturnsDto() {
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);
            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);

            assertThat(result.id).isEqualTo(10L);
            assertThat(result.name).isEqualTo("Property 10");
            assertThat(result.ownerName).isEqualTo("Owner Test");
        }

        @Test
        void whenSuperAdmin_thenBypassesOrgFilter() {
            tenantContext.setSuperAdmin(true);
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);
            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);

            assertThat(result.id).isEqualTo(10L);
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.findById(999L))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> propertyService.getById(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== DELETE =====

    @Nested
    class Delete {

        @Test
        void whenPropertyExists_thenDeletesAndNotifies() {
            when(propertyRepository.existsById(10L)).thenReturn(true);

            propertyService.delete(10L);

            verify(propertyRepository).deleteById(10L);
            verify(notificationService).notifyAdminsAndManagers(
                    eq(NotificationKey.PROPERTY_DELETED), any(), any(), any());
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFoundException() {
            when(propertyRepository.existsById(999L)).thenReturn(false);

            assertThatThrownBy(() -> propertyService.delete(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== LIST =====

    @Nested
    class ListProperties {

        @Test
        void whenListAll_thenReturnsDtoList() {
            User owner = buildOwner(1L);
            Property p1 = buildProperty(1L, owner);
            Property p2 = buildProperty(2L, owner);
            when(propertyRepository.findAll()).thenReturn(List.of(p1, p2));

            List<PropertyDto> results = propertyService.list();
            assertThat(results).hasSize(2);
        }

        @Test
        void whenListWithPagination_thenReturnsPage() {
            User owner = buildOwner(1L);
            Property p = buildProperty(1L, owner);
            Page<Property> page = new PageImpl<>(List.of(p), PageRequest.of(0, 10), 1);
            when(propertyRepository.findAll(any(PageRequest.class))).thenReturn(page);

            Page<PropertyDto> result = propertyService.list(PageRequest.of(0, 10));
            assertThat(result.getContent()).hasSize(1);
        }
    }

    // ===== CAN USER ASSIGN FOR PROPERTY =====

    @Nested
    class CanUserAssignForProperty {

        @Test
        void whenUserIsPlatformStaff_thenReturnsTrue() {
            User admin = buildOwner(1L);
            admin.setRole(UserRole.SUPER_ADMIN);
            User propOwner = buildOwner(2L);
            Property property = buildProperty(10L, propOwner);

            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));
            when(userRepository.findById(1L)).thenReturn(Optional.of(admin));

            assertThat(propertyService.canUserAssignForProperty(1L, 10L)).isTrue();
        }

        @Test
        void whenUserIsDirectlyAssigned_thenReturnsTrue() {
            User user = buildOwner(5L);
            user.setRole(UserRole.HOST);
            User propOwner = buildOwner(2L);
            Property property = buildProperty(10L, propOwner);

            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));
            when(managerPropertyRepository.existsByManagerIdAndPropertyId(5L, 10L, ORG_ID))
                    .thenReturn(true);

            assertThat(propertyService.canUserAssignForProperty(5L, 10L)).isTrue();
        }

        @Test
        void whenPropertyHasNoOwner_thenReturnsFalse() {
            Property property = new Property();
            property.setId(10L);
            property.setOwner(null);

            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));

            assertThat(propertyService.canUserAssignForProperty(1L, 10L)).isFalse();
        }

        @Test
        void whenUserHasNoAccess_thenReturnsFalse() {
            User user = buildOwner(5L);
            user.setRole(UserRole.HOST);
            User propOwner = buildOwner(2L);
            Property property = buildProperty(10L, propOwner);

            when(propertyRepository.findById(10L))
                    .thenReturn(Optional.of(property));
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));
            when(managerPropertyRepository.existsByManagerIdAndPropertyId(5L, 10L, ORG_ID))
                    .thenReturn(false);
            when(portfolioRepository.findByManagerId(5L, ORG_ID)).thenReturn(List.of());

            assertThat(propertyService.canUserAssignForProperty(5L, 10L)).isFalse();
        }
    }

    // ===== CLEANING DURATION COMPUTATION (via create/update) =====

    @Nested
    class CleaningDuration {

        @Test
        void whenT1WithMinimalFeatures_thenBaseDuration90Minutes() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(1L);
                return p;
            });

            PropertyDto dto = new PropertyDto();
            dto.name = "Studio";
            dto.address = "1 Rue";
            dto.bedroomCount = 1;
            dto.bathroomCount = 1;
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            // 90 (T1 base) + 10 (hasLaundry defaults to true in Property entity) = 100
            assertThat(result.cleaningDurationMinutes).isEqualTo(100);
        }

        @Test
        void whenT3WithExtras_thenDurationIncludesExtras() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(1L);
                return p;
            });

            PropertyDto dto = new PropertyDto();
            dto.name = "Grand Apt";
            dto.address = "1 Rue";
            dto.bedroomCount = 3;
            dto.bathroomCount = 2;
            dto.hasLaundry = true;
            dto.hasExterior = true;
            dto.windowCount = 4;
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            // 150 (T3) + 15 (extra bath) + 10 (hasLaundry=true) + 25 (hasExterior=true) + 20 (4 windows)
            assertThat(result.cleaningDurationMinutes).isEqualTo(220);
        }

        @Test
        void whenT5Plus_thenBaseAndAllExtrasApplied() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "Massive Villa";
            dto.address = "1 Avenue";
            dto.bedroomCount = 6;       // T5+ → 210
            dto.bathroomCount = 3;      // +30 (2 extra * 15)
            dto.squareMeters = 200;     // +24 ((200-80)/5)
            dto.windowCount = 5;        // +25
            dto.frenchDoorCount = 2;    // +16
            dto.slidingDoorCount = 1;   // +12
            dto.hasLaundry = true;      // +10
            dto.hasIroning = true;      // +20
            dto.hasDeepKitchen = true;  // +30
            dto.hasExterior = true;     // +25
            dto.hasDisinfection = true; // +40
            dto.numberOfFloors = 3;     // +30 (2 extra * 15)
            dto.type = PropertyType.VILLA; // *1.35
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            // (210+30+24+25+16+12+10+20+30+25+40+30) = 472 * 1.35 = 637.2 → 637
            assertThat(result.cleaningDurationMinutes).isEqualTo(637);
        }

        @Test
        void whenStudio_thenBaseDurationApplied() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "Studio";
            dto.address = "Studio Rue";
            dto.bedroomCount = 1;
            dto.bathroomCount = 1;
            dto.hasLaundry = false;
            dto.type = PropertyType.STUDIO;
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            // (90) * 0.85 = 76.5 → 77
            assertThat(result.cleaningDurationMinutes).isEqualTo(77);
        }

        @Test
        void whenT4Property_thenAppliesT4BaseDuration() {
            User owner = buildOwner(1L);
            when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "T4";
            dto.address = "T4";
            dto.bedroomCount = 4;
            dto.bathroomCount = 1;
            dto.hasLaundry = false;
            dto.ownerId = 1L;

            PropertyDto result = propertyService.create(dto);
            // 180 (T4) + 0 (1 bath) + 0 = 180 * 1.0 = 180
            assertThat(result.cleaningDurationMinutes).isEqualTo(180);
        }
    }

    // ===== STATUS UPDATE / DELETE branches =====

    @Nested
    class UpdateStatus {

        @Test
        void whenValidStatus_thenUpdatedAndSaved() {
            User owner = buildOwner(1L);
            Property existing = buildProperty(10L, owner);
            existing.setStatus(PropertyStatus.ACTIVE);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto result = propertyService.updateStatus(10L, "INACTIVE");
            assertThat(result.status).isEqualTo(PropertyStatus.INACTIVE);
        }

        @Test
        void whenInvalidStatus_thenThrowsIllegalArgument() {
            User owner = buildOwner(1L);
            Property existing = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> propertyService.updateStatus(10L, "BOGUS"))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Statut invalide");
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFound() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> propertyService.updateStatus(999L, "ACTIVE"))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenPropertyFromOtherOrg_thenAccessDenied() {
            // A1-AGENT-IA-02 : le tool update_property_status passe un propertyId
            // controle par le LLM/user. Sans garde org, IDOR write cross-org.
            Property existing = buildProperty(10L, buildOwner(1L));
            existing.setOrganizationId(ORG_ID + 1);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> propertyService.updateStatus(10L, "ARCHIVED"))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

            verify(propertyRepository, never()).save(any());
        }

        @Test
        void whenSuperAdminCrossOrg_thenAllowed() {
            tenantContext.setSuperAdmin(true);
            Property existing = buildProperty(10L, buildOwner(1L));
            existing.setOrganizationId(ORG_ID + 1);
            existing.setStatus(PropertyStatus.ACTIVE);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto result = propertyService.updateStatus(10L, "INACTIVE");
            assertThat(result.status).isEqualTo(PropertyStatus.INACTIVE);
        }
    }

    @Nested
    class DeleteAdditional {

        @Test
        void whenNotificationFails_thenStillDeletes() {
            when(propertyRepository.existsById(10L)).thenReturn(true);
            doThrow(new RuntimeException("Notif down")).when(notificationService)
                    .notifyAdminsAndManagers(any(), any(), any(), any());

            propertyService.delete(10L);

            verify(propertyRepository).deleteById(10L);
        }
    }

    // ===== UPDATE — additional branches (notification path) =====

    @Nested
    class UpdateBranches {

        @Test
        void whenOwnerHasKeycloakId_thenNotifies() {
            User owner = buildOwner(1L);
            Property existing = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "Updated";

            propertyService.update(10L, dto);

            verify(notificationService).notify(eq("kc-1"), eq(NotificationKey.PROPERTY_UPDATED),
                    any(), any(), any());
        }

        @Test
        void whenNotificationFails_thenUpdateStillSucceeds() {
            User owner = buildOwner(1L);
            Property existing = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            doThrow(new RuntimeException("Notif failed")).when(notificationService)
                    .notify(anyString(), any(), any(), any(), any());

            PropertyDto dto = new PropertyDto();
            dto.name = "Updated";

            PropertyDto result = propertyService.update(10L, dto);
            assertThat(result.name).isEqualTo("Updated");
        }

        @Test
        void whenOwnerHasNoKeycloakId_thenNoNotification() {
            User owner = buildOwner(1L);
            owner.setKeycloakId(null);
            Property existing = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(existing));
            when(propertyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PropertyDto dto = new PropertyDto();
            dto.name = "Updated";

            propertyService.update(10L, dto);

            verify(notificationService, never()).notify(anyString(), any(), any(), any(), any());
        }
    }

    // ===== TO DTO — additional branches (photos, amenities, check-in instructions) =====

    @Nested
    class ToDtoBranches {

        @Test
        void whenPropertyHasPhotos_thenSortedAndCoverIsFirst() {
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);

            PropertyPhoto p1 = new PropertyPhoto();
            p1.setId(100L);
            p1.setExternalUrl("https://cdn/photo1.jpg");
            p1.setSortOrder(2);

            PropertyPhoto p2 = new PropertyPhoto();
            p2.setId(101L);
            p2.setExternalUrl("https://cdn/photo2.jpg");
            p2.setSortOrder(1);

            property.setPhotos(new java.util.HashSet<>(List.of(p1, p2)));

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);
            assertThat(result.photoUrls).hasSize(2);
            assertThat(result.coverPhotoUrl).isEqualTo("https://cdn/photo2.jpg"); // sortOrder 1 first
        }

        @Test
        void whenAmenitiesValidJson_thenDeserialized() {
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);
            property.setAmenities("[\"wifi\",\"pool\"]");
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);
            assertThat(result.amenities).containsExactly("wifi", "pool");
        }

        @Test
        void whenAmenitiesInvalidJson_thenEmptyList() {
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);
            property.setAmenities("not valid json {{{");
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);
            assertThat(result.amenities).isEmpty();
        }

        @Test
        void whenOwnerIsNull_thenOwnerIdAndNameAreNull() {
            Property property = new Property();
            property.setId(10L);
            property.setName("No Owner");
            property.setAddress("addr");
            property.setBedroomCount(2);
            property.setBathroomCount(1);
            property.setType(PropertyType.APARTMENT);
            property.setStatus(PropertyStatus.ACTIVE);
            property.setOwner(null);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            PropertyDto result = propertyService.getById(10L);
            assertThat(result.ownerId).isNull();
            assertThat(result.ownerName).isNull();
        }
    }

    // ===== SEARCH =====

    @Nested
    class SearchProperties {

        @Test
        @SuppressWarnings("unchecked")
        void whenSearchWithAllFilters_thenPasses() {
            User owner = buildOwner(1L);
            Property p = buildProperty(1L, owner);
            Page<Property> page = new PageImpl<>(List.of(p));

            when(propertyRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                    any(PageRequest.class))).thenReturn(page);

            Page<PropertyDto> result = propertyService.search(
                    PageRequest.of(0, 10),
                    1L,
                    PropertyStatus.ACTIVE,
                    PropertyType.APARTMENT,
                    "Paris");

            assertThat(result.getContent()).hasSize(1);
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenSearchWithNullFilters_thenStillReturns() {
            Page<Property> page = new PageImpl<>(List.of());
            when(propertyRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                    any(PageRequest.class))).thenReturn(page);

            Page<PropertyDto> result = propertyService.search(
                    PageRequest.of(0, 10), null, null, null, null);

            assertThat(result.getContent()).isEmpty();
        }

        @Test
        @SuppressWarnings("unchecked")
        void whenSearchWithManagers_thenIncludesManagerInfo() {
            User owner = buildOwner(1L);
            Property p = buildProperty(10L, owner);

            User manager = buildOwner(99L);
            manager.setFirstName("Manager");
            manager.setLastName("X");
            manager.setEmail("mgr@test.com");
            ManagerProperty mp = new ManagerProperty(99L, 10L);
            mp.setManager(manager);

            Page<Property> page = new PageImpl<>(List.of(p));
            when(propertyRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class),
                    any(PageRequest.class))).thenReturn(page);
            when(managerPropertyRepository.findByPropertyId(10L, ORG_ID))
                    .thenReturn(List.of(mp));

            Page<PropertyDto> result = propertyService.searchWithManagers(
                    PageRequest.of(0, 10), "kc-1");

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().get(0).managerFirstName).isEqualTo("Manager");
            assertThat(result.getContent().get(0).managerEmail).isEqualTo("mgr@test.com");
        }
    }

    // ===== CAN USER ASSIGN — additional branches =====

    @Nested
    class CanUserAssignAdditionalBranches {

        @Test
        void whenUserIsInPortfolioWithOwnerClient_thenReturnsTrue() {
            User user = buildOwner(5L);
            user.setRole(UserRole.HOST);
            User propOwner = buildOwner(2L);
            Property property = buildProperty(10L, propOwner);

            Portfolio portfolio = new Portfolio();
            portfolio.setId(50L);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(userRepository.findById(5L)).thenReturn(Optional.of(user));
            when(managerPropertyRepository.existsByManagerIdAndPropertyId(5L, 10L, ORG_ID))
                    .thenReturn(false);
            when(portfolioRepository.findByManagerId(5L, ORG_ID)).thenReturn(List.of(portfolio));
            when(portfolioClientRepository.existsByPortfolioIdAndClientIdAndIsActiveTrue(
                    50L, 2L, ORG_ID)).thenReturn(true);

            assertThat(propertyService.canUserAssignForProperty(5L, 10L)).isTrue();
        }

        @Test
        void whenUserNotFound_thenThrowsNotFound() {
            User propOwner = buildOwner(2L);
            Property property = buildProperty(10L, propOwner);

            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(userRepository.findById(99L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> propertyService.canUserAssignForProperty(99L, 10L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== CREATE — Notification, owner=null handling =====

    @Nested
    class CreateAdditionalBranches {

        @Test
        void whenOwnerIdNull_thenNoLookupAndOwnerNullOnEntity() {
            when(propertyRepository.save(any(Property.class))).thenAnswer(inv -> {
                Property p = inv.getArgument(0);
                p.setId(10L);
                return p;
            });

            PropertyDto dto = new PropertyDto();
            dto.name = "No Owner";
            dto.address = "10 R";
            dto.city = "Paris";
            dto.ownerId = null;
            dto.type = PropertyType.APARTMENT;

            PropertyDto result = propertyService.create(dto);

            assertThat(result).isNotNull();
            verify(userRepository, never()).findById(anyLong());
        }
    }

    // ===== getPropertyEntityById =====

    @Nested
    class GetPropertyEntityById {

        @Test
        void whenPropertyExists_thenReturnsEntity() {
            User owner = buildOwner(1L);
            Property property = buildProperty(10L, owner);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            Property result = propertyService.getPropertyEntityById(10L);
            assertThat(result.getId()).isEqualTo(10L);
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFound() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());
            assertThatThrownBy(() -> propertyService.getPropertyEntityById(999L))
                    .isInstanceOf(NotFoundException.class);
        }
    }

    // ===== getAirbnbListingMapping (statut channel, audit regle 3 : org validee) =====

    @Nested
    class GetAirbnbListingMapping {

        @Test
        void whenPropertyInSameOrg_thenReturnsMapping() {
            Property property = buildProperty(10L, buildOwner(1L));
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(listingMappingRepository.findByPropertyId(10L))
                    .thenReturn(Optional.of(new com.clenzy.integration.airbnb.model.AirbnbListingMapping()));

            assertThat(propertyService.getAirbnbListingMapping(10L)).isPresent();
        }

        @Test
        void whenPropertyFromOtherOrg_thenAccessDenied() {
            Property property = buildProperty(10L, buildOwner(1L));
            property.setOrganizationId(ORG_ID + 1);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));

            assertThatThrownBy(() -> propertyService.getAirbnbListingMapping(10L))
                    .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);

            verify(listingMappingRepository, never()).findByPropertyId(anyLong());
        }

        @Test
        void whenPropertyNotFound_thenThrowsNotFound() {
            when(propertyRepository.findById(999L)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> propertyService.getAirbnbListingMapping(999L))
                    .isInstanceOf(NotFoundException.class);
        }

        @Test
        void whenSuperAdminCrossOrg_thenAllowed() {
            tenantContext.setSuperAdmin(true);
            Property property = buildProperty(10L, buildOwner(1L));
            property.setOrganizationId(ORG_ID + 1);
            when(propertyRepository.findById(10L)).thenReturn(Optional.of(property));
            when(listingMappingRepository.findByPropertyId(10L)).thenReturn(Optional.empty());

            assertThat(propertyService.getAirbnbListingMapping(10L)).isEmpty();
        }
    }
}
