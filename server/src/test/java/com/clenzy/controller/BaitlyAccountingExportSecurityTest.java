package com.clenzy.controller;

import com.clenzy.service.AccountingExportService;
import com.clenzy.service.OrganizationService;
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
import java.time.LocalDate;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringJUnitConfig(BaitlyAccountingExportSecurityTest.Config.class)
class BaitlyAccountingExportSecurityTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean AccountingExportService exports() { return mock(AccountingExportService.class); }
        @Bean OrganizationService access() { return mock(OrganizationService.class); }
        @Bean TenantContext tenant() { return mock(TenantContext.class); }
        @Bean AccountingExportController controller(AccountingExportService exports,
                TenantContext tenant, OrganizationService access) {
            return new AccountingExportController(exports, tenant, access);
        }
    }
    @Autowired AccountingExportService exports;
    @Autowired OrganizationService access;
    @Autowired TenantContext tenant;
    @Autowired AccountingExportController controller;
    private final Jwt jwt = Jwt.withTokenValue("synthetic").header("alg", "none")
            .subject("synthetic-manager").build();
    private final LocalDate from = LocalDate.of(2026, 1, 1);
    private final LocalDate to = LocalDate.of(2026, 1, 31);

    @BeforeEach void prepare() { reset(exports, access, tenant); }

    @Test void anonymousCannotExport() {
        assertThatThrownBy(() -> controller.exportFec(from, to, jwt))
                .isInstanceOf(org.springframework.security.core.AuthenticationException.class);
        verifyNoInteractions(exports, access, tenant);
    }
    @Test @WithMockUser(roles = "TECHNICIAN")
    void operationalRoleCannotExportAccountingData() {
        assertAllExportsDenied();
        verifyNoInteractions(exports, access, tenant);
    }
    @Test @WithMockUser(roles = "SUPERVISOR")
    void supervisorCannotExportAccountingData() {
        assertAllExportsDenied();
        verifyNoInteractions(exports, access, tenant);
    }
    @Test @WithMockUser(roles = "HOST")
    void memberOrManagerOfAnotherOrganizationCannotExport() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        doThrow(new AccessDeniedException("Gestionnaire requis"))
                .when(access).validateOrgManagement("synthetic-manager", 7L);
        assertAllExportsDenied();
        verifyNoInteractions(exports);
    }
    @Test @WithMockUser(roles = "HOST")
    void missingTenantFailsBeforeReadingAccountingData() {
        when(tenant.getRequiredOrganizationId()).thenThrow(new AccessDeniedException("Organisation requise"));
        assertAllExportsDenied();
        verifyNoInteractions(exports, access);
    }
    @Test @WithMockUser(roles = "HOST")
    void managerExportsOnlyTheActiveOrganizationWithoutCaching() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(exports.exportFec(7L, from, to)).thenReturn("synthetic");
        when(exports.exportReservationsCsv(7L, from, to)).thenReturn("synthetic");
        when(exports.exportPayoutsCsv(7L, from, to)).thenReturn("synthetic");
        when(exports.exportExpensesCsv(7L, from, to)).thenReturn("synthetic");
        when(exports.exportInvoicesCsv(7L, from, to)).thenReturn("synthetic");
        var responses = List.of(controller.exportFec(from, to, jwt),
                controller.exportReservationsCsv(from, to, jwt), controller.exportPayoutsCsv(from, to, jwt),
                controller.exportExpensesCsv(from, to, jwt), controller.exportInvoicesCsv(from, to, jwt));
        assertThat(responses).allSatisfy(response ->
                assertThat(response.getHeaders().getCacheControl()).contains("no-store"));
        verify(access, times(5)).validateOrgManagement("synthetic-manager", 7L);
        verify(exports).exportFec(7L, from, to);
        verify(exports).exportReservationsCsv(7L, from, to);
        verify(exports).exportPayoutsCsv(7L, from, to);
        verify(exports).exportExpensesCsv(7L, from, to);
        verify(exports).exportInvoicesCsv(7L, from, to);
        verifyNoMoreInteractions(exports);
    }
    @Test @WithMockUser(roles = "HOST")
    void organizationManagerStillCannotGenerateSepa() {
        assertThatThrownBy(() -> controller.exportSepaXml(List.of(1L), jwt))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(exports, access, tenant);
    }
    @Test @WithMockUser(roles = "SUPER_ADMIN")
    void platformSepaExportStillValidatesTheActiveOrganization() {
        when(tenant.getRequiredOrganizationId()).thenReturn(7L);
        when(exports.generateSepaXml(List.of(1L), 7L)).thenReturn("<synthetic/>");
        assertThat(controller.exportSepaXml(List.of(1L), jwt).getHeaders().getCacheControl()).contains("no-store");
        verify(access).validateOrgManagement("synthetic-manager", 7L);
        verify(exports).generateSepaXml(List.of(1L), 7L);
    }
    private void assertAllExportsDenied() {
        assertThatThrownBy(() -> controller.exportFec(from, to, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.exportReservationsCsv(from, to, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.exportPayoutsCsv(from, to, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.exportExpensesCsv(from, to, jwt)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> controller.exportInvoicesCsv(from, to, jwt)).isInstanceOf(AccessDeniedException.class);
    }
}
