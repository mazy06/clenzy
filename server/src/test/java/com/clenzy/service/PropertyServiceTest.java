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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
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
                notificationService, tenantContext);
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
    }
}
