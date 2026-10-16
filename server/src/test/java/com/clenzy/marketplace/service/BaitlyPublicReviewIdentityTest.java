package com.clenzy.marketplace.service;
import com.clenzy.marketplace.repository.BaitlyPublicProfileRepository;
import com.clenzy.model.*;
import com.clenzy.repository.OrganizationRepository;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.*;
import java.time.Clock;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class BaitlyPublicReviewIdentityTest {
    final ProviderAccountResolver accounts=mock(ProviderAccountResolver.class);
    final OrganizationRepository orgs=mock(OrganizationRepository.class);
    final OrganizationService organizations=mock(OrganizationService.class);
    final TenantContext tenant=mock(TenantContext.class);
    final JdbcTemplate db=mock(JdbcTemplate.class);
    final BaitlyPublicProfiles service=new BaitlyPublicProfiles(mock(BaitlyPublicProfileRepository.class),accounts,organizations,orgs,tenant,db,null,null,Clock.systemUTC(),null);
    @BeforeEach void setup(){when(accounts.userIdOf("owner")).thenReturn(12L);when(tenant.getRequiredOrganizationId()).thenReturn(34L);var org=new Organization();org.setType(OrganizationType.INDIVIDUAL);when(orgs.findById(34L)).thenReturn(Optional.of(org));doThrow(new org.springframework.security.access.AccessDeniedException("Owner scoped")).when(organizations).validateOrgManagement("owner",34L);}
    void ownerReview(){when(db.queryForObject(anyString(),eq(Boolean.class),eq(15L),eq(34L),eq(false),eq(12L))).thenReturn(true);}
    @Test void otherOwnersReviewCannotBeReadOrEdited(){
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.ownReviewIdentity(15L,"owner"));
        assertThrows(org.springframework.security.access.AccessDeniedException.class,()->service.reviewIdentity(15L,new BaitlyPublicProfiles.ReviewIdentity("Lina",null,true,true),"owner"));
        verify(db,never()).queryForMap(anyString(),any(),any());verify(db,never()).update(anyString(),any(),any(),any(),any(),any());
    }
    @Test void publicIdentityRequiresAuthorConsent(){
        ownerReview();assertThrows(IllegalArgumentException.class,()->service.reviewIdentity(15L,new BaitlyPublicProfiles.ReviewIdentity("Lina",null,false,true),"owner"));
        verify(db,never()).update(anyString(),any(),any(),any(),any(),any());
    }
    @Test void approvedIdentityIsStoredSeparatelyWithoutReadingPrivateGuestDetails(){
        ownerReview();service.reviewIdentity(15L,new BaitlyPublicProfiles.ReviewIdentity(" Lina ",null,true,true),"owner");
        verify(db).update(anyString(),eq("Lina"),isNull(),eq(true),eq(15L),eq(34L));
    }
}
