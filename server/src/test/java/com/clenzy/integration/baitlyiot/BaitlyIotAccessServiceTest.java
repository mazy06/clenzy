package com.clenzy.integration.baitlyiot;

import com.clenzy.model.NoiseDevice;
import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.NoiseDeviceRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.service.access.OrganizationAccessGuard;
import com.clenzy.tenant.TenantContext;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyIotAccessServiceTest {
    @Mock PropertyRepository properties;
    @Mock NoiseDeviceRepository devices;
    BaitlyIotAccessService access;

    @BeforeEach
    void setup() {
        var tenant = new TenantContext(); tenant.setOrganizationId(7L);
        access = new BaitlyIotAccessService(properties, devices, new OrganizationAccessGuard(tenant));
    }
    @AfterEach void clear() { SecurityContextHolder.clearContext(); }

    @Test
    void whenHostOwnsProperty_thenCanManageSensor() {
        Property property = property(7L, "host");
        when(properties.findByIdWithOwnerNoOrgFilter(11L)).thenReturn(Optional.of(property));
        assertThat(access.property(11, "host")).isSameAs(property);
    }

    @Test
    void whenHostDoesNotOwnPropertyInSameOrganization_thenRejects() {
        when(properties.findByIdWithOwnerNoOrgFilter(11L)).thenReturn(Optional.of(property(7L, "another-host")));
        assertThatThrownBy(() -> access.property(11, "host"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void whenPropertyBelongsToAnotherOrganization_thenRejectsEvenForOwner() {
        when(properties.findByIdWithOwnerNoOrgFilter(11L)).thenReturn(Optional.of(property(8L, "host")));
        assertThatThrownBy(() -> access.property(11, "host"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test
    void whenAdministratorManagesSameOrganization_thenOwnershipExceptionIsAllowed() {
        SecurityContextHolder.getContext().setAuthentication(UsernamePasswordAuthenticationToken.authenticated("admin", null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        when(properties.findByIdWithOwnerNoOrgFilter(11L)).thenReturn(Optional.of(property(7L, "another-host")));
        assertThat(access.property(11, "admin").getId()).isEqualTo(11);
    }

    @Test
    void whenDeviceBelongsToAnotherOrganization_thenPropertyIsNeverLoaded() {
        NoiseDevice device = new NoiseDevice(); device.setOrganizationId(8L); device.setDeviceType(NoiseDevice.DeviceType.BAITLY);
        when(devices.findById(99L)).thenReturn(Optional.of(device));
        assertThatThrownBy(() -> access.device(99, "host"))
                .isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        verifyNoInteractions(properties);
    }

    private Property property(long orgId, String ownerId) {
        User owner = new User(); owner.setKeycloakId(ownerId);
        Property property = new Property(); property.setId(11L); property.setOrganizationId(orgId); property.setOwner(owner);
        return property;
    }
}
