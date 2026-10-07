package com.clenzy.controller;

import com.clenzy.dto.FiscalProfileDto;
import com.clenzy.model.FiscalProfile;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyFiscalCountrySecurityTest.Config.class)
class BaitlyFiscalCountrySecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean FiscalProfileService profiles(){return mock(FiscalProfileService.class);}
        @Bean BaitlyFiscalJurisdictions countries(){return mock(BaitlyFiscalJurisdictions.class);}
        @Bean OrganizationService access(){return mock(OrganizationService.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean FiscalProfileController controller(FiscalProfileService profiles,BaitlyFiscalJurisdictions countries,OrganizationService access,TenantContext tenant){return new FiscalProfileController(profiles,countries,access,tenant);}
    }
    @Autowired FiscalProfileController controller;
    @Autowired FiscalProfileService profiles;
    @Autowired BaitlyFiscalJurisdictions countries;
    @Autowired OrganizationService access;
    @Autowired TenantContext tenant;
    @BeforeEach void resetMocks(){reset(profiles,countries,access,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L);}
    Jwt jwt(){return Jwt.withTokenValue("test").header("alg","none").subject("host").build();}
    FiscalProfileDto dto(){return FiscalProfileDto.from(new FiscalProfile(999L,"MA","MAD"));}
    @Test void anonymousRequestsCannotReadTaxIdentities(){assertThatThrownBy(()->controller.countries()).isInstanceOf(org.springframework.security.core.AuthenticationException.class);verifyNoInteractions(countries);}
    @Test @WithMockUser(roles="HOST") void ordinaryMemberCannotEditPrimaryOrCountryProfile() {
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("host",7L);
        assertThatThrownBy(()->controller.updateProfile(jwt(),dto())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.updateCountry(jwt(),"MA",dto())).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(profiles,countries);
    }
    @Test @WithMockUser(roles="HOST") void managementGuardUsesActiveTenantInsteadOfBodyOrganization(){
        var body=dto();controller.updateCountry(jwt(),"MA",body);
        var sequence=inOrder(access,countries);sequence.verify(access).validateOrgManagement("host",7L);sequence.verify(countries).update("MA",body);
    }
    @Test @WithMockUser(roles="HOST") void legacyWriteAlsoTargetsTheCountryInsteadOfOverwritingThePrimaryProfile(){
        var body=dto();controller.updateProfile(jwt(),body);
        var sequence=inOrder(access,countries);sequence.verify(access).validateOrgManagement("host",7L);sequence.verify(countries).update("MA",body);
        verifyNoInteractions(profiles);
    }
}
