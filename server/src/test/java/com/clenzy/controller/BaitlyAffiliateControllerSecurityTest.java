package com.clenzy.controller;

import com.clenzy.dto.UpsertActivityConfigRequest;
import com.clenzy.model.ActivityProvider;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyAffiliateControllerSecurityTest.Config.class)
class BaitlyAffiliateControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean ActivityService activity(){return mock(ActivityService.class);}
        @Bean ActivityCommissionService commissions(){return mock(ActivityCommissionService.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean ActivityAffiliateController controller(ActivityService activity,ActivityCommissionService commissions,TenantContext tenant){
            return new ActivityAffiliateController(activity,commissions,tenant,mock(AffiliateEarningsCsvParser.class));}
    }
    @Autowired ActivityAffiliateController controller;
    @Autowired ActivityService activity;
    @Autowired ActivityCommissionService commissions;
    @Autowired TenantContext tenant;
    @BeforeEach void setup(){reset(activity,commissions,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L);}
    UpsertActivityConfigRequest request(BigDecimal fee){return new UpsertActivityConfigRequest(null,"partner",true,fee);}
    @Test @WithMockUser(roles="HOST") void ownerCannotChangeOrClearBaitlyCommission(){
        for(var fee:java.util.List.of(BigDecimal.ZERO,BigDecimal.TEN))
            assertThatThrownBy(()->controller.upsertConfig(ActivityProvider.KLOOK,request(fee))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(activity);
    }
    @Test @WithMockUser(roles="HOST") void ownerCanUpdateOwnConnectionWithoutChangingCommission(){
        controller.upsertConfig(ActivityProvider.KLOOK,request(null));
        verify(activity).upsertConfig(7L,ActivityProvider.KLOOK,null,"partner",true,null);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void staffCanChangeCommission(){
        controller.upsertConfig(ActivityProvider.KLOOK,request(BigDecimal.TEN));
        verify(activity).upsertConfig(7L,ActivityProvider.KLOOK,null,"partner",true,BigDecimal.TEN);
    }
    @Test @WithMockUser(roles="HOST") void ownerCannotImportOrDeclareReceipts(){
        assertThatThrownBy(()->controller.importEarnings(java.util.List.of())).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.cancel(1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->controller.receipt(1L,null,null)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(commissions);
    }
    @Test @WithMockUser(roles="HOUSEKEEPER") void providerCannotModifyConnection(){
        assertThatThrownBy(()->controller.upsertConfig(ActivityProvider.KLOOK,request(null))).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(activity);
    }
}
