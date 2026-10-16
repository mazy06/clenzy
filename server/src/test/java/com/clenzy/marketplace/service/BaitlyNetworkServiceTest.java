package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.*;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyNetworkServiceTest {
    @Mock BaitlyNetworkLinkRepository links;
    @Mock MarketplaceProviderRepository providers;
    @Mock MarketplaceCatalogService catalog;
    @Mock MarketplaceExposureService exposure;
    @Mock ProviderAccountResolver accounts;
    @Mock OrganizationService organizations;
    @Mock OrganizationRepository organizationRepository;
    @Mock TenantContext tenant;
    BaitlyNetworkService service;
    Instant now=Instant.parse("2026-10-12T09:00:00Z");
    @BeforeEach void setup() {
        service=new BaitlyNetworkService(links,providers,catalog,exposure,accounts,organizations,organizationRepository,tenant,Clock.fixed(now,ZoneOffset.UTC));
    }
    BaitlyNetworkLink invitation() {
        var link=new BaitlyNetworkLink();link.setProviderId(9L);link.setOrganizationId(1L);
        link.setStatus("INVITED");link.setTokenHash("hash");link.setExpiresAt(now.plusSeconds(100));link.setUpdatedAt(now.minusSeconds(100));
        return link;
    }
    @Test void forgedRecipientCannotConsumeSecret() {
        var link=invitation();when(links.lockToken(any())).thenReturn(Optional.of(link));
        when(accounts.requireProviderId("other")).thenReturn(10L);
        assertThatThrownBy(()->service.accept("a".repeat(72),"other")).isInstanceOf(ResponseStatusException.class);
        verify(links,never()).save(any());assertThat(link.getStatus()).isEqualTo("INVITED");
    }
    @Test void expiredInvitationCannotBeAccepted() {
        var link=invitation();link.setExpiresAt(now);
        when(links.lockToken(any())).thenReturn(Optional.of(link));when(accounts.requireProviderId("recipient")).thenReturn(9L);
        assertThatThrownBy(()->service.accept("a".repeat(72),"recipient")).isInstanceOf(ResponseStatusException.class);
        verify(links,never()).save(any());
    }
    @Test void acceptedInvitationConsumesTokenWithoutPublishingProfile() {
        var link=invitation();when(links.lockToken(any())).thenReturn(Optional.of(link));
        when(accounts.requireProviderId("recipient")).thenReturn(9L);when(links.save(link)).thenReturn(link);
        when(providers.findById(9L)).thenReturn(Optional.empty());when(organizationRepository.findById(1L)).thenReturn(Optional.empty());
        service.accept("a".repeat(72),"recipient");
        assertThat(link.getStatus()).isEqualTo("ACTIVE");assertThat(link.getTokenHash()).isNull();assertThat(link.getExpiresAt()).isNull();
        verifyNoInteractions(exposure,catalog);verify(providers,never()).save(any());
    }
    @Test void crossOrganizationCannotRevokeRelation() {
        when(tenant.getRequiredOrganizationId()).thenReturn(2L);when(links.lockId(7L)).thenReturn(Optional.of(invitation()));
        assertThatThrownBy(()->service.revoke(7L,"owner")).isInstanceOf(ResponseStatusException.class);
        verify(links,never()).save(any());
    }
    @Test void memberWithoutManagementCannotInvite() {
        when(tenant.getRequiredOrganizationId()).thenReturn(1L);
        doThrow(new AccessDeniedException("denied")).when(organizations).validateOrgManagement("member",1L);
        assertThatThrownBy(()->service.invite(9L,"member")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(providers,links);
    }
    @Test void secretStoredAsDigest() {
        assertThat(BaitlyNetworkService.hash("secret")).hasSize(64).isNotEqualTo("secret");
    }
    @Test void existingMembersAreAlwaysScopedToAuthenticatedOrganization() {
        when(tenant.getRequiredOrganizationId()).thenReturn(2L);
        when(providers.findByHomeOrganizationId(eq(2L),any(org.springframework.data.domain.Pageable.class)))
            .thenReturn(org.springframework.data.domain.Page.empty());
        assertThat(service.members(0).getContent()).isEmpty();
        verify(providers).findByHomeOrganizationId(eq(2L),any(org.springframework.data.domain.Pageable.class));
        verifyNoInteractions(exposure,catalog);
    }
}
