package com.clenzy.service.agent;

import com.clenzy.config.ai.ToolDescriptor;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifie le least-privilege par role de {@link RoleToolPolicy} : un role operationnel
 * (technicien/menage/supervisor...) ne voit QUE les outils d'intervention ; les roles
 * de gestion (HOST/SUPER_ADMIN) gardent l'acces complet. (Le scoping par assigne est
 * assure au niveau service — ici on teste l'exposition/enforcement des outils.)
 */
class RoleToolPolicyTest {

    private static Jwt jwtWithRole(String role) {
        return Jwt.withTokenValue("tok").header("alg", "none")
                .subject("kc-user")
                .claim("realm_access", Map.of("roles", List.of(role)))
                .build();
    }

    private static AgentContext ctx(String role) {
        return new AgentContext(1L, "kc-user", jwtWithRole(role), "fr", null, null);
    }

    @Test
    void technician_isOperational_andRestrictedToInterventionTools() {
        AgentContext ctx = ctx("TECHNICIAN");
        assertThat(RoleToolPolicy.isOperational(ctx)).isTrue();
        // autorise : interventions (scopees au service) + meteo + navigation
        assertThat(RoleToolPolicy.isToolAllowed("get_interventions_by_status", ctx)).isTrue();
        assertThat(RoleToolPolicy.isToolAllowed("list_cleaning_tasks", ctx)).isTrue();
        assertThat(RoleToolPolicy.isToolAllowed("update_intervention_status", ctx)).isTrue();
        assertThat(RoleToolPolicy.isToolAllowed("get_weather_forecast", ctx)).isTrue();
        // refuse : finance / reservation / tarif / autres logements
        assertThat(RoleToolPolicy.isToolAllowed("get_financial_summary", ctx)).isFalse();
        assertThat(RoleToolPolicy.isToolAllowed("list_reservations", ctx)).isFalse();
        assertThat(RoleToolPolicy.isToolAllowed("set_rate_override", ctx)).isFalse();
        assertThat(RoleToolPolicy.isToolAllowed("get_owner_payout_summary", ctx)).isFalse();
    }

    @Test
    void housekeeper_and_supervisor_areOperational() {
        assertThat(RoleToolPolicy.isOperational(ctx("HOUSEKEEPER"))).isTrue();
        assertThat(RoleToolPolicy.isOperational(ctx("SUPERVISOR"))).isTrue();
        assertThat(RoleToolPolicy.isOperational(ctx("LAUNDRY"))).isTrue();
        assertThat(RoleToolPolicy.isOperational(ctx("EXTERIOR_TECH"))).isTrue();
    }

    @Test
    void host_and_superAdmin_areNotOperational_fullAccess() {
        assertThat(RoleToolPolicy.isOperational(ctx("HOST"))).isFalse();
        assertThat(RoleToolPolicy.isOperational(ctx("SUPER_ADMIN"))).isFalse();
        assertThat(RoleToolPolicy.isToolAllowed("get_financial_summary", ctx("HOST"))).isTrue();
        assertThat(RoleToolPolicy.isToolAllowed("set_rate_override", ctx("SUPER_ADMIN"))).isTrue();
    }

    @Test
    void filterForRole_technician_keepsOnlyAllowedTools() {
        List<ToolDescriptor> all = List.of(
                ToolDescriptor.readOnly("get_interventions_by_status", "d", null),
                ToolDescriptor.write("update_intervention_status", "d", null),
                ToolDescriptor.readOnly("get_financial_summary", "d", null),
                ToolDescriptor.readOnly("list_reservations", "d", null),
                ToolDescriptor.readOnly("get_weather_forecast", "d", null));

        List<ToolDescriptor> filtered = RoleToolPolicy.filterForRole(all, ctx("TECHNICIAN"));

        assertThat(filtered).extracting(ToolDescriptor::name)
                .containsExactlyInAnyOrder(
                        "get_interventions_by_status", "update_intervention_status", "get_weather_forecast");
    }

    @Test
    void filterForRole_host_unchanged() {
        List<ToolDescriptor> all = List.of(
                ToolDescriptor.readOnly("get_financial_summary", "d", null),
                ToolDescriptor.readOnly("list_reservations", "d", null));
        assertThat(RoleToolPolicy.filterForRole(all, ctx("HOST"))).hasSize(2);
    }

    @Test
    void nullJwt_defaultsToFullAccess() {
        AgentContext ctx = AgentContext.minimal(1L, "kc-user");  // jwt null → HOST par defaut
        assertThat(RoleToolPolicy.isOperational(ctx)).isFalse();
        assertThat(RoleToolPolicy.isToolAllowed("get_financial_summary", ctx)).isTrue();
    }
}
