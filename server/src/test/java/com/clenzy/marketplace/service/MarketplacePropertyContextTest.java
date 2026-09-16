package com.clenzy.marketplace.service;

import com.clenzy.model.Property;
import com.clenzy.model.User;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.AccessDeniedException;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class MarketplacePropertyContextTest {
    final PropertyRepository properties = mock(PropertyRepository.class);
    final MarketplacePropertyContext context = new MarketplacePropertyContext(properties);
    Jwt jwt(String subject, String role) {
        return Jwt.withTokenValue("test").header("alg","none").subject(subject)
            .claim("realm_access", Map.of("roles", List.of(role))).build();
    }
    @Test void ownerCanSearchForOwnProperty() {
        var property = new Property(); var owner = new User(); owner.setKeycloakId("owner"); property.setOwner(owner);
        when(properties.findByIdWithOwner(42L,7L)).thenReturn(Optional.of(property));
        assertThat(context.require(42L,7L,jwt("owner","HOST"))).isSameAs(property);
    }
    @Test void anotherOwnerAndAFieldWorkerCannotProbePropertyEligibility() {
        var property = new Property(); var owner = new User(); owner.setKeycloakId("owner"); property.setOwner(owner);
        when(properties.findByIdWithOwner(42L,7L)).thenReturn(Optional.of(property));
        for (String role : List.of("HOST","TECHNICIAN")) {
            assertThatThrownBy(() -> context.require(42L,7L,jwt("other",role))).isInstanceOf(AccessDeniedException.class);
        }
    }
    @Test void staffStillCannotSelectPropertyOutsideRequestingOrganization() {
        when(properties.findByIdWithOwner(42L,7L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> context.require(42L,7L,jwt("staff","SUPER_ADMIN"))).isInstanceOf(AccessDeniedException.class);
    }
    @Test void generalRequestRequiresNoProperty() {
        assertThat(context.require(null,7L,jwt("owner","HOST"))).isNull();
        verifyNoInteractions(properties);
    }
}
