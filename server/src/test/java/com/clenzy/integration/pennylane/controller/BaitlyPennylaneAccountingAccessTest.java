package com.clenzy.integration.pennylane.controller;

import com.clenzy.integration.pennylane.service.PennylaneAccountingSyncService;
import com.clenzy.service.OrganizationService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.junit.jupiter.SpringJUnitConfig;
import java.util.List;
import java.util.Map;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Vrais proxys de sécurité ; refus d’accès avant toute requête fournisseur ou lecture de lot. */
@SpringJUnitConfig(BaitlyPennylaneAccountingAccessTest.Config.class)
class BaitlyPennylaneAccountingAccessTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean PennylaneAccountingSyncService sync() {return mock(PennylaneAccountingSyncService.class);}
        @Bean OrganizationService access() {return mock(OrganizationService.class);}
        @Bean TenantContext tenant() {return mock(TenantContext.class);}
        @Bean PennylaneAccountingController controller(PennylaneAccountingSyncService sync, TenantContext tenant, OrganizationService access) {
            return new PennylaneAccountingController(sync, tenant, access);
        }
    }
    @Autowired PennylaneAccountingController controller;
    @Autowired PennylaneAccountingSyncService sync;
    @Autowired OrganizationService access;
    @Autowired TenantContext tenant;
    final Jwt jwt = Jwt.withTokenValue("synthetic").header("alg","RS256").subject("synthetic-manager").build();
    @BeforeEach void resetMocks() {reset(sync,access,tenant);}

    @Test void anonymousCannotReadOrStartSynchronization() {
        assertThatThrownBy(() -> controller.syncInvoices(jwt)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(() -> controller.syncExpenses(jwt)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(() -> controller.syncAll(jwt)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        assertThatThrownBy(() -> controller.syncStatus(jwt)).isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        verifyNoInteractions(sync,access,tenant);
    }
    @ParameterizedTest @ValueSource(strings={"TECHNICIAN","HOUSEKEEPER","SUPERVISOR","BOOKING_GUEST","GUEST","UNKNOWN"})
    @WithMockUser
    void operationalAndUnknownRolesCannotSynchronize(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("synthetic", "unused",
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        assertAllDenied(jwt); verifyNoInteractions(sync,access,tenant);
    }
    @Test @WithMockUser(roles="HOST")
    void anotherOrganizationOrNonManagerCannotSynchronize() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        doThrow(new AccessDeniedException("Gestionnaire requis")).when(access).validateOrgManagement("synthetic-manager",7L);
        assertAllDenied(jwt); verifyNoInteractions(sync);
    }
    @Test @WithMockUser(roles="HOST")
    void absentTenantFailsBeforeAuthorizationAndSynchronization() {
        when(tenant.getRequiredOrganizationId()).thenThrow(new AccessDeniedException("Organisation requise"));
        assertAllDenied(jwt); verifyNoInteractions(sync,access);
    }
    @ParameterizedTest @NullSource @ValueSource(longs={0,-7}) @WithMockUser(roles="HOST")
    void invalidTenantFailsClosed(Long organization) {
        when(tenant.getRequiredOrganizationId()).thenReturn(organization);
        assertAllDenied(jwt); verifyNoInteractions(sync,access);
    }
    @Test @WithMockUser(roles="HOST")
    void absentPrincipalFailsBeforeTenantLookup() {
        assertAllDenied(null); verifyNoInteractions(sync,access,tenant);
    }
    @Test @WithMockUser(roles="HOST")
    void approvedManagerUsesOnlyTheActiveOrganization() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        var invoices = new PennylaneAccountingSyncService.SyncResult("invoices",0,0,0,List.of());
        var expenses = new PennylaneAccountingSyncService.SyncResult("expenses",0,0,0,List.of());
        when(sync.syncAllPendingInvoices(7L)).thenReturn(invoices);
        when(sync.syncAllPendingExpenses(7L)).thenReturn(expenses);
        when(sync.getSyncStatus(7L)).thenReturn(Map.of("connected",true));
        assertThat(controller.syncInvoices(jwt).getBody()).isSameAs(invoices);
        assertThat(controller.syncExpenses(jwt).getBody()).isSameAs(expenses);
        assertThat(controller.syncAll(jwt).getBody()).containsEntry("invoices",invoices).containsEntry("expenses",expenses);
        assertThat(controller.syncStatus(jwt).getBody()).containsEntry("connected",true);
        verify(access,times(4)).validateOrgManagement("synthetic-manager",7L);
        verify(sync,times(2)).syncAllPendingInvoices(7L);
        verify(sync,times(2)).syncAllPendingExpenses(7L);
        verify(sync).getSyncStatus(7L); verifyNoMoreInteractions(sync);
    }
    @ParameterizedTest @ValueSource(strings={"SUPER_ADMIN","SUPER_MANAGER"}) @WithMockUser
    void platformRolesStillUseTheManagementGuard(String role) {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("synthetic", "unused",
                List.of(new SimpleGrantedAuthority("ROLE_" + role))));
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(sync.getSyncStatus(7L)).thenReturn(Map.of("connected",true));
        controller.syncStatus(jwt);
        verify(access).validateOrgManagement("synthetic-manager",7L);
        verify(sync).getSyncStatus(7L);
    }
    void assertAllDenied(Jwt principal) {
        assertThatThrownBy(() -> controller.syncInvoices(principal)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.syncExpenses(principal)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.syncAll(principal)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.syncStatus(principal)).isInstanceOf(AccessDeniedException.class);
    }
}
