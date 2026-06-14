package com.clenzy.service.access;

import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("OrganizationAccessGuard — fail-closed")
class OrganizationAccessGuardTest {

    private TenantContext tenantContext;
    private OrganizationAccessGuard guard;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        guard = new OrganizationAccessGuard(tenantContext);
    }

    @Test
    void whenSameOrg_thenAllowed() {
        tenantContext.setOrganizationId(1L);

        assertThatCode(() -> guard.requireSameOrganization(1L, "msg")).doesNotThrowAnyException();
    }

    @Test
    void whenDifferentOrg_thenAccessDenied() {
        tenantContext.setOrganizationId(1L);

        assertThatThrownBy(() -> guard.requireSameOrganization(2L, "regle hors org"))
                .isInstanceOf(AccessDeniedException.class)
                .hasMessage("regle hors org");
    }

    @Test
    @DisplayName("fail-closed : org de l'entite NULL → refus")
    void whenEntityOrgNull_thenAccessDenied() {
        tenantContext.setOrganizationId(1L);

        assertThatThrownBy(() -> guard.requireSameOrganization(null, "msg"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("fail-closed : org du tenant NULL → refus")
    void whenTenantOrgNull_thenAccessDenied() {
        // tenantContext.organizationId reste NULL (legacy)

        assertThatThrownBy(() -> guard.requireSameOrganization(1L, "msg"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("fail-closed : tenant ET entite NULL → refus")
    void whenBothOrgNull_thenAccessDenied() {
        assertThatThrownBy(() -> guard.requireSameOrganization(null, "msg"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("bypass : SUPER_ADMIN cross-org autorise")
    void whenSuperAdmin_thenBypass() {
        tenantContext.setOrganizationId(1L);
        tenantContext.setSuperAdmin(true);

        assertThatCode(() -> guard.requireSameOrganization(2L, "msg")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("bypass : SUPER_ADMIN autorise meme avec orgs NULL")
    void whenSuperAdminAndOrgsNull_thenBypass() {
        tenantContext.setSuperAdmin(true);

        assertThatCode(() -> guard.requireSameOrganization(null, "msg")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("bypass : org SYSTEM cross-org autorise")
    void whenSystemOrg_thenBypass() {
        tenantContext.setOrganizationId(1L);
        tenantContext.setSystemOrg(true);

        assertThatCode(() -> guard.requireSameOrganization(2L, "msg")).doesNotThrowAnyException();
    }

    // --- Surcharge a org explicite (CLZ-P0-02 : flux HTTP ET arriere-plan CalendarEngine) ---

    @Test
    @DisplayName("explicite : orgs egales -> autorise")
    void whenExplicitOrgsMatch_thenAllowed() {
        assertThatCode(() -> guard.requireSameOrganization(7L, 7L, "ok")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("explicite : orgs differentes -> refus")
    void whenExplicitOrgsDiffer_thenAccessDenied() {
        assertThatThrownBy(() -> guard.requireSameOrganization(7L, 9L, "cross-org"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("explicite fail-closed : org entite NULL -> refus")
    void whenExplicitEntityOrgNull_thenAccessDenied() {
        assertThatThrownBy(() -> guard.requireSameOrganization(null, 7L, "msg"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("explicite fail-closed : org attendue NULL -> refus")
    void whenExplicitExpectedOrgNull_thenAccessDenied() {
        assertThatThrownBy(() -> guard.requireSameOrganization(7L, null, "msg"))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("explicite : flux arriere-plan (tenant org NULL) mais orgs explicites egales -> autorise")
    void whenBackgroundContextAndExplicitOrgsMatch_thenAllowed() {
        // TenantContext non resolu (Kafka/scheduler) : seule l'org explicite passee fait foi.
        assertThatCode(() -> guard.requireSameOrganization(5L, 5L, "bg")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("explicite bypass : SUPER_ADMIN cross-org autorise")
    void whenSuperAdminExplicitDiffer_thenBypass() {
        tenantContext.setSuperAdmin(true);
        assertThatCode(() -> guard.requireSameOrganization(7L, 9L, "msg")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("explicite bypass : org SYSTEM cross-org autorise")
    void whenSystemOrgExplicitDiffer_thenBypass() {
        tenantContext.setSystemOrg(true);
        assertThatCode(() -> guard.requireSameOrganization(7L, 9L, "msg")).doesNotThrowAnyException();
    }
}
