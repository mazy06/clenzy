package com.clenzy.service;

import com.clenzy.model.Intervention;
import com.clenzy.repository.UserRepository;
import com.clenzy.repository.TeamRepository;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class BaitlyMissionReviewAccessTest {
    @Test void onlyActualManagementOfTheMissionTenantMayReview() {
        var tenant=mock(TenantContext.class);when(tenant.getOrganizationId()).thenReturn(7L);
        var organizations=mock(OrganizationService.class);
        var access=new InterventionAccessPolicy(tenant,mock(UserRepository.class),mock(TeamRepository.class),organizations);
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("concierge").claim("realm_access",Map.of("roles",List.of("HOST"))).build();
        var mission=new Intervention();mission.setOrganizationId(7L);
        when(organizations.canManageOrg("concierge",7L)).thenReturn(true);
        assertTrue(access.canReview(mission,jwt));
        when(organizations.canManageOrg("concierge",7L)).thenReturn(false);
        assertFalse(access.canReview(mission,jwt));
        // Asked as yes/no: the throwing check would mark the caller's transaction rollback-only.
        verify(organizations,never()).validateOrgManagement(any(),any());
        reset(organizations);mission.setOrganizationId(9L);
        assertFalse(access.canReview(mission,jwt));verifyNoInteractions(organizations);
    }
}
