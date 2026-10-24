package com.clenzy.controller;

import com.clenzy.dto.SecurityDepositRequests;
import com.clenzy.service.*;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyDepositAuthorizationTest.Config.class)
class BaitlyDepositAuthorizationTest {
    @Configuration @EnableMethodSecurity static class Config {
        @Bean SecurityDepositService deposits() { return mock(SecurityDepositService.class); }
        @Bean SecurityDepositPaymentService payments() { return mock(SecurityDepositPaymentService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean OrganizationService access() { return mock(OrganizationService.class); }
        @Bean SecurityDepositController controller(SecurityDepositService deposits, SecurityDepositPaymentService payments,
                TenantContext tenant, OrganizationService access) { return new SecurityDepositController(deposits, payments, tenant, access); }
    }
    @Autowired SecurityDepositService deposits;
    @Autowired SecurityDepositPaymentService payments;
    @Autowired TenantContext tenant;
    @Autowired OrganizationService access;
    @Autowired SecurityDepositController controller;
    private final Jwt jwt = Jwt.withTokenValue("synthetic").header("alg", "none").subject("synthetic-manager").build();
    private final SecurityDepositRequests.Create create = new SecurityDepositRequests.Create(9L, new BigDecimal("300"), "EUR");
    private final SecurityDepositRequests.Capture capture = new SecurityDepositRequests.Capture(new BigDecimal("120"), "Synthetic damage");
    @BeforeEach void prepare() { reset(deposits, payments, tenant, access); }

    @Test void anonymousCannotCreateOrMoveFunds() {
        assertThatThrownBy(() -> controller.capture(5L, capture, jwt))
                .isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        verifyNoInteractions(deposits, payments, tenant, access);
    }
    @Test @WithMockUser(roles = "TECHNICIAN") void operationalRoleCannotMoveFunds() {
        assertAllDenied(); verifyNoInteractions(deposits, payments, tenant, access);
    }
    @Test @WithMockUser(roles = "SUPERVISOR") void supervisorCannotMoveFundsViaDepositApi() {
        assertAllDenied(); verifyNoInteractions(deposits, payments, tenant, access);
    }
    @Test @WithMockUser(roles = "HOST") void ordinaryMemberCannotMoveFunds() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("synthetic-manager", 7L);
        assertAllDenied(); verifyNoInteractions(deposits, payments);
    }
    @Test @WithMockUser(roles = "HOST") void absentTenantFailsBeforeFinancialEffect() {
        when(tenant.getRequiredOrganizationId()).thenThrow(new AccessDeniedException("Organisation requise"));
        assertAllDenied(); verifyNoInteractions(deposits, payments, access);
    }
    @Test @WithMockUser(roles = "HOST") void managerActsOnlyInTheValidatedActiveOrganization() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        controller.create(create, jwt); controller.hold(5L, jwt); controller.release(5L, jwt); controller.capture(5L, capture, jwt);
        var order = inOrder(access, deposits, payments);
        order.verify(access).validateOrgManagement("synthetic-manager", 7L);
        order.verify(deposits).create(7L, 9L, create.amount(), "EUR");
        order.verify(access).validateOrgManagement("synthetic-manager", 7L);
        order.verify(payments).placeHold(7L, 5L);
        order.verify(access).validateOrgManagement("synthetic-manager", 7L);
        order.verify(payments).releaseHold(7L, 5L);
        order.verify(access).validateOrgManagement("synthetic-manager", 7L);
        order.verify(payments).captureHold(7L, 5L, capture.amount(), capture.reason());
    }
    @Test void dashboardShortcutCannotBypassManagementPermission() {
        var context = mock(com.clenzy.service.dashboard.gesture.GestureContext.class);
        when(context.actorId()).thenReturn("synthetic-manager"); when(context.orgId()).thenReturn(7L);
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("synthetic-manager", 7L);
        var handler = new com.clenzy.service.dashboard.gesture.ReleaseDepositHandler(payments, access);
        assertThatThrownBy(() -> handler.handle(context)).isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(payments);
    }
    private void assertAllDenied() {
        assertThatThrownBy(() -> controller.create(create, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.hold(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.release(5L, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.capture(5L, capture, jwt)).isInstanceOf(AccessDeniedException.class);
    }
}
