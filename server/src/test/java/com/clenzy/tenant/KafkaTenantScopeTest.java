package com.clenzy.tenant;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Caractérise la politique unique de scoping tenant des consommateurs Kafka.
 *
 * <h2>Pourquoi ce composant existe</h2>
 * <p>Audit 2026-07 : les 18 {@code @KafkaListener} résolvaient l'organisation de
 * <b>sept manières différentes</b> ({@code resolveOrganizationId}, {@code resolveOrgId},
 * {@code parseOrgId}, {@code asLong(event…)}, {@code extractLong(event, "orgId")}, …) et,
 * plus grave, selon <b>deux politiques opposées</b> : certains la re-dérivaient de la base
 * (correct), d'autres la lisaient dans le payload — ce qui laissait l'émetteur d'un événement
 * choisir le tenant sous lequel il s'exécutait (P1-03, P1-04, P1-19).</p>
 *
 * <p>CLAUDE.md désigne {@code TenantScopedExecutor} comme composant canonique du contexte
 * tenant hors HTTP, mais rien n'exprimait la <b>politique</b> : d'où vient l'organisation, et
 * que faire si elle est absente ou contredite. Ce vide a produit les sept variantes. Ce
 * composant comble ce manque et <b>délègue</b> l'exécution à {@code TenantScopedExecutor} —
 * il ne le remplace pas.</p>
 *
 * <p>Ce qui reste volontairement propre à chaque listener : la <b>façon</b> de résoudre
 * l'organisation (mapping de channel, device, transaction…), intrinsèque au canal. Conforme
 * à « un peu de duplication vaut mieux que la mauvaise abstraction ».</p>
 */
@ExtendWith(MockitoExtension.class)
class KafkaTenantScopeTest {

    @Mock private TenantScopedExecutor tenantScopedExecutor;

    private KafkaTenantScope scope;
    private AtomicBoolean executed;

    @BeforeEach
    void setUp() {
        scope = new KafkaTenantScope(tenantScopedExecutor);
        executed = new AtomicBoolean(false);
    }

    private void executorRunsInline() {
        doAnswer(invocation -> {
            ((Runnable) invocation.getArgument(1)).run();
            return null;
        }).when(tenantScopedExecutor).runAsOrganization(anyLong(), any(Runnable.class));
    }

    @Nested
    @DisplayName("organisation de confiance")
    class TrustedOrganization {

        @Test
        @DisplayName("exécute l'action dans le contexte de l'organisation résolue")
        void runsWithinResolvedOrganization() {
            executorRunsInline();

            boolean ran = scope.run("payment.events", 42L, () -> executed.set(true));

            assertThat(ran).isTrue();
            assertThat(executed).isTrue();
            verify(tenantScopedExecutor).runAsOrganization(eq(42L), any(Runnable.class));
        }

        @Test
        @DisplayName("organisation introuvable : refus, action jamais exécutée (fail-closed)")
        void refusesWhenOrganizationCannotBeResolved() {
            boolean ran = scope.run("payment.events", null, () -> executed.set(true));

            assertThat(ran)
                    .as("sans organisation de confiance, on refuse plutot que d'executer hors scope")
                    .isFalse();
            assertThat(executed).isFalse();
            verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any());
        }
    }

    @Nested
    @DisplayName("contrôle de cohérence du payload")
    class PayloadCrossCheck {

        @Test
        @DisplayName("payload cohérent : exécution normale")
        void consistentPayloadRuns() {
            executorRunsInline();

            boolean ran = scope.run("expedia.calendar.sync", 42L, 42L, () -> executed.set(true));

            assertThat(ran).isTrue();
            assertThat(executed).isTrue();
        }

        @Test
        @DisplayName("payload absent : l'organisation de confiance suffit")
        void absentPayloadOrganizationIsTolerated() {
            executorRunsInline();

            boolean ran = scope.run("expedia.calendar.sync", 42L, null, () -> executed.set(true));

            assertThat(ran).isTrue();
            assertThat(executed).isTrue();
        }

        /**
         * Le cas d'attaque : l'événement annonce une organisation qui n'est pas celle de
         * l'entité. C'est la signature d'une forge — on refuse, on ne « corrige » pas.
         */
        @Test
        @DisplayName("payload contradictoire : refus (P1-03, P1-04, P1-19)")
        void contradictoryPayloadOrganizationIsRejected() {
            boolean ran = scope.run("expedia.calendar.sync", 42L, 999L, () -> executed.set(true));

            assertThat(ran).isFalse();
            assertThat(executed).isFalse();
            verify(tenantScopedExecutor, never()).runAsOrganization(anyLong(), any());
        }
    }
}
