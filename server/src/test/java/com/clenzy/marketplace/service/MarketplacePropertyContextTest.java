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
    final com.clenzy.repository.ManagerPropertyRepository managers=mock(com.clenzy.repository.ManagerPropertyRepository.class);
    final com.clenzy.repository.UserRepository users=mock(com.clenzy.repository.UserRepository.class);
    final com.clenzy.repository.PortfolioRepository portfolios=mock(com.clenzy.repository.PortfolioRepository.class);
    final com.clenzy.repository.PortfolioClientRepository clients=mock(com.clenzy.repository.PortfolioClientRepository.class);
    final MarketplacePropertyContext context = new MarketplacePropertyContext(properties,managers,users,portfolios,clients);
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
    @Test void conciergeCanUseAnExplicitPropertyMandate() {
        var property=new Property(); var owner=new User(); owner.setKeycloakId("owner"); property.setOwner(owner);
        var manager=new User(); manager.setId(9L);
        when(properties.findByIdWithOwner(42L,7L)).thenReturn(Optional.of(property));
        when(users.findByKeycloakId("concierge")).thenReturn(Optional.of(manager));
        when(managers.existsByManagerIdAndPropertyId(9L,42L,7L)).thenReturn(true);
        assertThat(context.require(42L,7L,jwt("concierge","HOST"))).isSameAs(property);
        assertThatThrownBy(() -> context.require(42L,7L,jwt("concierge","TECHNICIAN"))).isInstanceOf(AccessDeniedException.class);
    }
    @Test void conciergeCanUseAnActivePortfolioMandate() {
        var property=new Property(); var owner=new User(); owner.setId(8L); owner.setKeycloakId("owner"); property.setOwner(owner);
        var manager=new User(); manager.setId(9L); var portfolio=new com.clenzy.model.Portfolio(); portfolio.setId(3L);
        when(properties.findByIdWithOwner(42L,7L)).thenReturn(Optional.of(property));
        when(users.findByKeycloakId("concierge")).thenReturn(Optional.of(manager));
        when(portfolios.findByManagerIdAndIsActiveTrue(9L,7L)).thenReturn(List.of(portfolio));
        when(clients.existsByPortfolioIdAndClientIdAndIsActiveTrue(3L,8L,7L)).thenReturn(true);
        assertThat(context.require(42L,7L,jwt("concierge","HOST"))).isSameAs(property);
    }
}
