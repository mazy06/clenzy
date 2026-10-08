package com.clenzy.controller;

import com.clenzy.service.BaitlyExternalBatchRefunds;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyExternalBatchRefundControllerTest.Config.class)
class BaitlyExternalBatchRefundControllerTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean BaitlyExternalBatchRefunds refunds(){return mock(BaitlyExternalBatchRefunds.class);}
        @Bean TenantContext tenant(){return mock(TenantContext.class);}
        @Bean BaitlyExternalBatchRefundController controller(BaitlyExternalBatchRefunds refunds,TenantContext tenant){return new BaitlyExternalBatchRefundController(refunds,tenant);}
    }
    @Autowired BaitlyExternalBatchRefundController controller;
    @Autowired BaitlyExternalBatchRefunds refunds;
    @Autowired TenantContext tenant;
    final Jwt jwt=Jwt.withTokenValue("test").header("alg","none").subject("authenticated-admin").build();
    final BaitlyExternalBatchRefundController.Assignment request=new BaitlyExternalBatchRefundController.Assignment(new BigDecimal("5.01"),"EUR","Dossier vérifié");
    final BaitlyExternalBatchRefundController.Distribution split=new BaitlyExternalBatchRefundController.Distribution(new BigDecimal("5.01"),"EUR","Dossier vérifié",
        java.util.List.of(new BaitlyExternalBatchRefunds.Portion(10L,new BigDecimal("2.00")),new BaitlyExternalBatchRefunds.Portion(20L,new BigDecimal("3.01"))));
    @BeforeEach void resetMocks(){reset(refunds,tenant);when(tenant.getRequiredOrganizationId()).thenReturn(7L);}
    @Test @WithMockUser(roles="SUPER_ADMIN") void actorAndOrganizationComeFromAuthenticatedContext(){
        controller.list(10L);assertThat(controller.assign(10L,"EXT-re_test",request,jwt).getStatusCode().value()).isEqualTo(202);
        verify(refunds).list(7L,10L);verify(refunds).assign(7L,10L,"EXT-re_test",new BigDecimal("5.01"),"EUR","Dossier vérifié","authenticated-admin");
    }
    @Test @WithMockUser(roles="HOST") void ownerCannotAssign(){denied();}
    @Test @WithMockUser(roles="SUPER_MANAGER") void splitUsesActiveTenantAndAuthenticatedActor(){
        controller.targets(10L);
        assertThat(controller.distribute(10L,"EXT-re_split",split,jwt).getStatusCode().value()).isEqualTo(202);
        verify(refunds).targets(7L,10L);
        verify(refunds).distribute(7L,10L,"EXT-re_split",split.amount(),"EUR",split.portions(),split.reason(),"authenticated-admin");
    }
    @Test @WithMockUser(roles="TECHNICIAN") void providerCannotAssign(){denied();}
    private void denied(){
        assertThatThrownBy(() -> controller.list(10L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.targets(10L)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.distribute(10L,"EXT-re_split",split,jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.assign(10L,"EXT-re_test",request,jwt)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(refunds);
    }
    @Test @WithMockUser(roles="SUPER_ADMIN") void noActiveOrganizationCannotReadOrAssign(){
        when(tenant.getRequiredOrganizationId()).thenThrow(new AccessDeniedException("Organisation absente"));
        assertThatThrownBy(() -> controller.list(10L)).isInstanceOf(AccessDeniedException.class);verifyNoInteractions(refunds);
    }
}
