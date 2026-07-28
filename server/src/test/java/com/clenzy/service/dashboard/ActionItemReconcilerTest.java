package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemDto;
import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.model.ActionItem;
import com.clenzy.repository.ActionItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Les trois garanties qui rendent la file persistée sûre.
 *
 * <p>Une file matérialisée est dangereuse si elle dérive : une action close qui
 * reste affichée fait perdre confiance, une action ouverte qu'on efface fait
 * perdre de l'argent. Ces tests figent exactement les trois règles qui
 * l'empêchent.</p>
 */
class ActionItemReconcilerTest {

    private static final Long ORG = 12L;
    private static final Instant NOW = Instant.parse("2026-07-29T09:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);

    private ActionItemRepository repository;
    private final List<ActionItem> saved = new ArrayList<>();

    @BeforeEach
    void setUp() {
        saved.clear();
        repository = mock(ActionItemRepository.class);
        when(repository.findDerivedForOrg(any(), anyCollection())).thenReturn(List.of());
        when(repository.saveAll(any())).thenAnswer(call -> {
            saved.addAll(call.getArgument(0));
            return call.getArgument(0);
        });
    }

    /** Source dont on choisit le comportement, y compris l'échec. */
    private record FakeSource(Set<ActionItemKind> kinds, Scope scope,
                              List<ActionItemDto> items, boolean fails)
            implements ActionItemSource {
        @Override
        public List<ActionItemDto> collect(ActionItemContext context) {
            if (fails) throw new IllegalStateException("requete en echec");
            return items;
        }
    }

    private static ActionItemDto dto(ActionItemKind kind, String id) {
        return new ActionItemDto(id, kind, "warning", "Titre", null, null,
                1L, null, null, null, null, null, null);
    }

    private ActionItemReconciler reconciler(ActionItemSource... sources) {
        return new ActionItemReconciler(List.of(sources), repository, CLOCK);
    }

    @Test
    void whenASourceReportsAnAction_thenItIsStoredWithItsIdentity() {
        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                List.of(dto(ActionItemKind.BALANCE_DUE, "balance:88")), false))
                .reconcile(ORG);

        assertThat(saved).singleElement().satisfies(item -> {
            assertThat(item.getOrganizationId()).isEqualTo(ORG);
            // L'identifiant de ligne EST l'identité de l'action : c'est lui qui
            // rend le balayage idempotent.
            assertThat(item.getSubjectRef()).isEqualTo("balance:88");
            assertThat(item.getSource()).isEqualTo(ActionItem.SOURCE_DERIVED);
            assertThat(item.getLastSeenAt()).isEqualTo(NOW);
        });
    }

    @Test
    void whenASourceNoLongerReportsAnAction_thenItsKindIsEligibleForClosing() {
        // Une source qui réussit sans rien trouver ferme ce qu'elle avait ouvert :
        // c'est ce qui remplace un événement de clôture pour les natures dérivées.
        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                List.of(), false))
                .reconcile(ORG);

        verify(repository).closeUnseen(eq(ORG), argThat(kinds ->
                kinds.contains(ActionItemKind.BALANCE_DUE.name())), eq(NOW));
    }

    @Test
    void whenASourceFails_thenItsActionsAreNotErased() {
        // Le danger d'une file matérialisée : une requête en erreur passerait
        // pour « plus rien à traiter » et effacerait des actions valides.
        reconciler(
                new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                        List.of(), true),
                new FakeSource(Set.of(ActionItemKind.FEED_STALE), ActionItemSource.Scope.BUSINESS,
                        List.of(dto(ActionItemKind.FEED_STALE, "feed:3")), false))
                .reconcile(ORG);

        verify(repository).closeUnseen(eq(ORG), argThat(kinds ->
                kinds.contains(ActionItemKind.FEED_STALE.name())
                        && !kinds.contains(ActionItemKind.BALANCE_DUE.name())), eq(NOW));
    }

    @Test
    void whenEverySourceFails_thenNothingIsClosedAtAll() {
        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE),
                ActionItemSource.Scope.BUSINESS, List.of(), true))
                .reconcile(ORG);

        verify(repository, never()).closeUnseen(any(), anyCollection(), any());
    }

    @Test
    void whenAnActionAlreadyExists_thenItKeepsItsAge() {
        // Recréer la ligne à chaque balayage lui ferait perdre son ancienneté —
        // or c'est l'ancienneté qui distingue un oubli d'un délai normal.
        final ActionItem existing = new ActionItem();
        existing.setId(5L);
        existing.setOrganizationId(ORG);
        existing.setKind(ActionItemKind.BALANCE_DUE.name());
        existing.setSubjectRef("balance:88");
        existing.setFirstSeenAt(Instant.parse("2026-07-01T09:00:00Z"));
        existing.setAssignedToUserId(42L);
        when(repository.findDerivedForOrg(any(), anyCollection())).thenReturn(List.of(existing));

        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                List.of(dto(ActionItemKind.BALANCE_DUE, "balance:88")), false))
                .reconcile(ORG);

        assertThat(saved).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(5L);
            assertThat(item.getFirstSeenAt()).isEqualTo(Instant.parse("2026-07-01T09:00:00Z"));
            // L'assignation appartient à l'humain, pas au balayage.
            assertThat(item.getAssignedToUserId()).isEqualTo(42L);
            assertThat(item.getLastSeenAt()).isEqualTo(NOW);
        });
    }

    @Test
    void whenAClosedAnomalyComesBack_thenItsRowIsReopenedRatherThanDuplicated() {
        // Un solde payé puis de nouveau dû, un flux rétabli puis retombé :
        // l'identité (org, nature, sujet) est la même. Ne relire que les lignes
        // ouvertes ferait tenter une insertion sur une clé déjà prise, et le
        // balayage s'arrêterait sur une contrainte d'unicité.
        final ActionItem closed = new ActionItem();
        closed.setId(9L);
        closed.setOrganizationId(ORG);
        closed.setKind(ActionItemKind.BALANCE_DUE.name());
        closed.setSubjectRef("balance:88");
        closed.setStatus(ActionItem.STATUS_RESOLVED);
        closed.setResolvedAt(Instant.parse("2026-07-20T09:00:00Z"));
        when(repository.findDerivedForOrg(any(), anyCollection())).thenReturn(List.of(closed));

        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                List.of(dto(ActionItemKind.BALANCE_DUE, "balance:88")), false))
                .reconcile(ORG);

        assertThat(saved).singleElement().satisfies(item -> {
            assertThat(item.getId()).isEqualTo(9L);
            assertThat(item.getStatus()).isEqualTo(ActionItem.STATUS_OPEN);
        });
    }

    @Test
    void whenSweeping_thenEventBornActionsAreNeverConsidered() {
        // Aucune requête ne peut redécouvrir un litige bancaire : si le balayage
        // le prenait en charge, il le ferait disparaître à son premier passage.
        reconciler(new FakeSource(Set.of(ActionItemKind.BALANCE_DUE), ActionItemSource.Scope.BUSINESS,
                List.of(), false))
                .reconcile(ORG);

        // Ni la relecture ni la clôture ne mentionnent la nature portée par événement.
        verify(repository).findDerivedForOrg(eq(ORG), argThat(kinds ->
                !kinds.contains(ActionItemKind.PAYMENT_INCIDENT.name())));
        verify(repository).closeUnseen(eq(ORG), argThat(kinds ->
                !kinds.contains(ActionItemKind.PAYMENT_INCIDENT.name())), eq(NOW));
    }

    private static Collection<String> argThat(java.util.function.Predicate<Collection<String>> p) {
        return org.mockito.ArgumentMatchers.argThat(p::test);
    }
}
