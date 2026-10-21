package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.BaitlyPublicProfile;
import com.clenzy.marketplace.repository.BaitlyPublicProfileRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.time.Clock;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyPublicProfilesTest {
    final BaitlyPublicProfileRepository profiles=mock(BaitlyPublicProfileRepository.class);
    final ProviderAccountResolver accounts=mock(ProviderAccountResolver.class);
    final TenantContext tenant=mock(TenantContext.class);
    final BaitlyPublicProfiles service=new BaitlyPublicProfiles(profiles,accounts,null,null,tenant,null,null,null,Clock.systemUTC(),null);

    @Test void publicDetailContainsOnlyMaskedName() {
        var p=new BaitlyPublicProfile(); p.id=UUID.randomUUID(); p.published=true;
        p.role="OWNER"; p.name="Toufik Mazy"; p.hideLastName=true;
        when(profiles.findById(p.id)).thenReturn(Optional.of(p));
        var detail=service.detail(p.id).orElseThrow();
        assertThat(detail.get("name")).isEqualTo("Toufik M.");
        assertThat(detail.values()).doesNotContain("Toufik Mazy");
    }

    @Test void authenticatedEditorKeepsOriginalNameAndChoice() {
        var p=new BaitlyPublicProfile(); p.id=UUID.randomUUID(); p.role="OWNER";
        p.name="Toufik Mazy"; p.hideLastName=true;
        when(accounts.userIdOf("subject")).thenReturn(12L);
        when(tenant.getRequiredOrganizationId()).thenReturn(34L);
        when(profiles.findByOrganizationIdAndAuthorUserId(34L,12L)).thenReturn(Optional.of(p));
        var own=service.own("subject").orElseThrow();
        assertThat(own.get("name")).isEqualTo("Toufik Mazy");
        assertThat(own.get("hideLastName")).isEqualTo(true);
    }

    @Test void withdrawalUsesCurrentOrganizationAndAuthorOnly() {
        when(accounts.userIdOf("subject")).thenReturn(12L);
        when(tenant.getRequiredOrganizationId()).thenReturn(34L);
        var p=new BaitlyPublicProfile(); p.published=true;
        when(profiles.findByOrganizationIdAndAuthorUserId(34L,12L)).thenReturn(Optional.of(p));
        service.withdraw("subject");
        assertThat(p.published).isFalse();
        verify(profiles).save(p);
        verify(profiles,never()).findById(any());
    }
    @Test void unknownAuthorCannotPublishOrReadOwnProfile() {
        when(accounts.userIdOf("missing")).thenReturn(null);
        assertThatThrownBy(() -> service.own("missing")).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(profiles);
    }
    @Test void withdrawnPublicProfileDoesNotLoadProperties() {
        var p=new BaitlyPublicProfile(); p.published=false;
        var id=UUID.randomUUID(); when(profiles.findById(id)).thenReturn(Optional.of(p));
        assertThat(service.detail(id)).isEmpty();
        assertThat(service.photo(id,1L)).isEmpty();
    }
    @Test void publicUrlsRejectCredentialsAndPrivateOrInsecureAddresses() {
        for(String url:List.of("http://example.com", "https://127.0.0.1", "https://user:secret@example.com", "https://example.com?token=secret"))
            assertThatThrownBy(() -> BaitlyPublicProfiles.publicUrl(url)).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void platformStaffPublishTheInternalIntakeProfileWithoutChangingOrganizationType() {
        var organizations=mock(com.clenzy.service.OrganizationService.class);
        var orgs=mock(com.clenzy.repository.OrganizationRepository.class);
        var db=mock(org.springframework.jdbc.core.JdbcTemplate.class);
        var organization=new com.clenzy.model.Organization();organization.setType(com.clenzy.model.OrganizationType.SYSTEM);organization.setName("Baitly");
        when(tenant.getRequiredOrganizationId()).thenReturn(34L);when(tenant.isSuperAdmin()).thenReturn(true);
        when(accounts.userIdOf("staff")).thenReturn(12L);when(orgs.findById(34L)).thenReturn(Optional.of(organization));
        var service=new BaitlyPublicProfiles(profiles,accounts,organizations,orgs,tenant,db,null,null,Clock.systemUTC(),null);
        var result=service.publish(new BaitlyPublicProfiles.Publish(false,"Baitly","Paris",null,null,null,List.of(),List.of("CLEANING"),false,false,false,null),"staff");
        assertThat(result).containsEntry("role","CONCIERGE").containsEntry("managementServices",List.of("CLEANING"));
        assertThat(organization.getType()).isEqualTo(com.clenzy.model.OrganizationType.SYSTEM);
        verify(organizations).validateOrgManagement("staff",34L);
        verify(profiles).saveAndFlush(argThat(profile->profile.organizationId.equals(34L)&&profile.authorUserId.equals(12L)));
    }
}
