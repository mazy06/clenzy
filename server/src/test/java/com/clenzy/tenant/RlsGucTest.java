package com.clenzy.tenant;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Verifie quelles GUC {@link RlsGuc} pose, et surtout <b>quand il accorde un bypass</b>.
 *
 * <h2>Le defaut R3 de l'audit 2026-07</h2>
 * <p>La regle d'origine etait {@code bypass = isSuperAdmin || isSystemOrg || org == null}.
 * Le troisieme terme est le plus large : <b>tout thread sans contexte tenant</b> obtient une
 * exemption complete de RLS. Cela couvre exactement les surfaces les plus exposees —
 * l'integralite de {@code /api/public/**} (exclu du {@code TenantFilter}, donc contexte
 * vide), les 18 consumers Kafka et les schedulers financiers. Autrement dit : le filet
 * prevu pour rattraper un {@code findById} non garde ne couvrait <b>pas</b> les chemins
 * ou l'audit a trouve P1-03, P1-04 et P1-06.</p>
 *
 * <h2>Pourquoi le comportement par defaut reste inchange</h2>
 * <p>Fermer ce bypass sans avoir d'abord donne un contexte tenant a ces chemins
 * (REM-S1-05 : {@code TenantScopedExecutor} sur les consumers, scoping de la surface
 * publique) ne produirait pas une fuite mais un <b>outage</b> : sans
 * {@code app.current_org}, la policy ne matche rien. Le mode strict est donc <b>opt-in</b>
 * ({@code clenzy.security.rls.strict-context}, defaut {@code false}) : le mecanisme de
 * fermeture existe et est teste, son activation attend que les chemins soient scopes.</p>
 */
class RlsGucTest {

    private EntityManager entityManager;
    private TenantContext tenantContext;

    /** Couples (GUC, valeur) reellement emis vers PostgreSQL. */
    private List<String[]> emitted;

    @BeforeEach
    void setUp() {
        tenantContext = new TenantContext();
        emitted = new ArrayList<>();
        entityManager = mock(EntityManager.class);

        // Un seul mock de Query : les deux GUC se distinguent par le NOM du parametre lie
        // (:org et :bypass), ce qui evite de discriminer sur le texte SQL.
        // Le stub est construit AVANT d'etre passe a when(...) : un when() imbrique dans un
        // when()/thenAnswer() corrompt l'etat de Mockito.
        Query query = mock(Query.class);
        when(query.setParameter(anyString(), any())).thenAnswer(call -> {
            // Typer explicitement : getArgument() est generique, et String.valueOf(...) resoudrait
            // sinon vers la surcharge char[] — ClassCastException avalee par le catch de RlsGuc.
            String parameterName = call.getArgument(0);
            Object parameterValue = call.getArgument(1);
            emitted.add(new String[]{parameterName, String.valueOf(parameterValue)});
            return query;
        });
        when(query.getSingleResult()).thenReturn(1);

        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
    }

    @AfterEach
    void tearDown() {
        tenantContext.clear();
        RlsGuc.setStrictContext(false);
    }

    private String guc(String name) {
        return emitted.stream()
                .filter(e -> e[0].equals(name))
                .map(e -> e[1])
                .reduce((first, last) -> last)
                .orElse(null);
    }

    @Nested
    @DisplayName("comportement par defaut (strict-context = false)")
    class DefaultBehaviour {

        @Test
        @DisplayName("organisation presente : pas de bypass, GUC posee")
        void withOrganization_noBypass() {
            tenantContext.setOrganizationId(77L);

            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("org")).isEqualTo("77");
            assertThat(guc("bypass")).isEqualTo("off");
        }

        @Test
        @DisplayName("staff plateforme : bypass explicite")
        void superAdmin_bypasses() {
            tenantContext.setOrganizationId(77L);
            tenantContext.setSuperAdmin(true);

            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("bypass")).isEqualTo("on");
        }

        @Test
        @DisplayName("organisation SYSTEM : bypass explicite")
        void systemOrg_bypasses() {
            tenantContext.setOrganizationId(77L);
            tenantContext.setSystemOrg(true);

            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("bypass")).isEqualTo("on");
        }

        /**
         * Le defaut R3 lui-meme : documente tel qu'il se comporte aujourd'hui, pour que toute
         * modification de cette regle soit un choix visible et non un effet de bord.
         */
        @Test
        @DisplayName("aucun contexte tenant : bypass IMPLICITE (defaut R3, comportement conserve)")
        void noTenantContext_bypassesImplicitly() {
            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("org")).isEmpty();
            assertThat(guc("bypass"))
                    .as("surface /api/public/**, consumers Kafka et schedulers passent par ici")
                    .isEqualTo("on");
        }
    }

    @Nested
    @DisplayName("mode strict (strict-context = true)")
    class StrictBehaviour {

        @BeforeEach
        void enableStrict() {
            RlsGuc.setStrictContext(true);
        }

        @Test
        @DisplayName("aucun contexte tenant : PLUS de bypass — fail-closed")
        void noTenantContext_doesNotBypass() {
            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("org")).isEmpty();
            assertThat(guc("bypass"))
                    .as("sans org ET sans bypass, la policy ne matche rien : 0 ligne, pas de fuite")
                    .isEqualTo("off");
        }

        @Test
        @DisplayName("le bypass EXPLICITE reste accorde (staff plateforme, org SYSTEM)")
        void explicitBypass_stillGranted() {
            tenantContext.setSuperAdmin(true);

            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("bypass"))
                    .as("le mode strict ne ferme que le bypass accidentel, jamais l'intentionnel")
                    .isEqualTo("on");
        }

        @Test
        @DisplayName("une organisation resolue fonctionne normalement")
        void withOrganization_unaffected() {
            tenantContext.setOrganizationId(77L);

            RlsGuc.apply(entityManager, tenantContext);

            assertThat(guc("org")).isEqualTo("77");
            assertThat(guc("bypass")).isEqualTo("off");
        }
    }
}
