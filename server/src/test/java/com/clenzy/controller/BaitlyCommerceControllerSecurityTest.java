package com.clenzy.controller;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import org.springframework.security.oauth2.jwt.Jwt;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyCommerceControllerSecurityTest.Config.class)
class BaitlyCommerceControllerSecurityTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean BaitlyCommerceRefunds refunds(){return mock(BaitlyCommerceRefunds.class);}
        @Bean BaitlyAffiliateAdjustments adjustments(){return mock(BaitlyAffiliateAdjustments.class);}
        @Bean BaitlyCommerceOperations operations(){return mock(BaitlyCommerceOperations.class);}
        @Bean BaitlyHardwareInventory inventory(){return mock(BaitlyHardwareInventory.class);}
        @Bean BaitlyCommerceRefundController refundsController(TenantContext tenant,BaitlyCommerceRefunds refunds){return new BaitlyCommerceRefundController(tenant,refunds,mock(ManagedRefundReconciliation.class));}
        @Bean BaitlyAffiliateAdjustmentController affiliateController(TenantContext tenant,BaitlyAffiliateAdjustments adjustments){return new BaitlyAffiliateAdjustmentController(adjustments,tenant);}
        @Bean BaitlyCommerceOperationController operationsController(TenantContext tenant,BaitlyCommerceOperations operations){return new BaitlyCommerceOperationController(operations,tenant);}
        @Bean BaitlyHardwareInventoryController inventoryController(TenantContext tenant,BaitlyHardwareInventory inventory){return new BaitlyHardwareInventoryController(inventory,tenant);}
    }
    @Autowired TenantContext tenant;@Autowired BaitlyCommerceRefunds refunds;@Autowired BaitlyAffiliateAdjustments adjustments;
    @Autowired BaitlyCommerceOperations operations;@Autowired BaitlyHardwareInventory inventory;
    @Autowired BaitlyCommerceRefundController refundController;@Autowired BaitlyAffiliateAdjustmentController affiliate;
    @Autowired BaitlyCommerceOperationController fulfilment;@Autowired BaitlyHardwareInventoryController stock;
    @BeforeEach void setup(){reset(tenant,refunds,adjustments,operations,inventory);when(tenant.getRequiredOrganizationId()).thenReturn(7L);}
    @Test @WithMockUser(roles="HOST") void hostCannotRefundOrCorrectOrChangePlatformStock() {
        assertThatThrownBy(()->refundController.create(null,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->affiliate.correct(1L,null,null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->stock.adjust(null,null)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(refunds,adjustments,inventory);
    }
    @Test @WithMockUser(roles="HOUSEKEEPER") void unrelatedProviderCannotReadCommissionOrFulfilment() {
        assertThatThrownBy(()->affiliate.history(1L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(()->fulfilment.history("UPSELL",1L)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(adjustments,operations);
    }
    @Test @WithMockUser(roles="SUPER_MANAGER") void managerUsesServerTenantAndAuthenticatedActor() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("staff-7").build();UUID request=UUID.randomUUID();
        affiliate.correct(1L,new BaitlyAffiliateAdjustmentController.Request(request,new BigDecimal("100"),new BigDecimal("70"),"EUR","BANK-1","Correction"),jwt);
        verify(adjustments).correct(7L,1L,request,new BigDecimal("100"),new BigDecimal("70"),"EUR","BANK-1","Correction","staff-7");
        assertThatThrownBy(()->stock.list("FR")).isInstanceOf(AccessDeniedException.class);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void platformStockAdjustmentRecordsActorAndExpectedQuantity() {
        var jwt=Jwt.withTokenValue("test").header("alg","none").subject("staff-7").build();UUID request=UUID.randomUUID();
        stock.adjust(new BaitlyHardwareInventoryController.Change("FR","CLENZY-NM-01",0,2,request,"BON-1"),jwt);
        verify(inventory).adjust("FR","CLENZY-NM-01",0,2,request,"BON-1","staff-7");
    }
}
