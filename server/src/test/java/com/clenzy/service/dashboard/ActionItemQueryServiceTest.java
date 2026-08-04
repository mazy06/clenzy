package com.clenzy.service.dashboard;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;
import com.clenzy.dto.DashboardOperationsDto.ActionItemsDto;
import com.clenzy.model.ActionItem;
import com.clenzy.model.UserRole;
import com.clenzy.repository.ActionItemRepository;
import com.clenzy.repository.PropertyRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Qui voit quoi.
 *
 * <p>La file est commune à toute l'organisation : une seule table, un seul
 * balayage. Tout le cloisonnement se joue donc à la <b>lecture</b>, et une
 * erreur ici expose directement les données d'un logement à quelqu'un qui n'y a
 * pas droit, ou noie un hôte sous des pannes qu'il ne peut pas réparer.</p>
 */
class ActionItemQueryServiceTest {

    private static final Long ORG = 12L;
    private static final Instant NOW = Instant.parse("2026-07-29T09:00:00Z");

    private ActionItemRepository actionItemRepository;
    private PropertyRepository propertyRepository;
    private ActionItemQueryService service;

    @BeforeEach
    void setUp() {
        actionItemRepository = mock(ActionItemRepository.class);
        propertyRepository = mock(PropertyRepository.class);
        service = new ActionItemQueryService(actionItemRepository, propertyRepository,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private static ActionItem row(ActionItemKind kind, String subjectRef, Long propertyId) {
        final ActionItem item = new ActionItem();
        item.setId((long) subjectRef.hashCode());
        item.setOrganizationId(ORG);
        item.setKind(kind.name());
        item.setSubjectRef(subjectRef);
        item.setSeverity("warning");
        item.setPropertyId(propertyId);
        return item;
    }

    private void queueContains(ActionItem... rows) {
        when(actionItemRepository.findOpenForOrg(any(), any())).thenReturn(List.of(rows));
    }

    @Test
    void whenTheViewerIsNotPlatformStaff_thenTechnicalNoiseIsHidden() {
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.OUTBOX_DEAD_LETTER, "outbox:9", null),
                row(ActionItemKind.AUTOMATION_FAILED, "automation:4", null),
                row(ActionItemKind.INTEGRATION_DISCONNECTED, "connection:airbnb:2", null));

        final ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPERVISOR, "kc-supervisor");

        // Un superviseur ne peut ni comprendre ni éteindre une file de messages
        // saturée : la lui montrer ne produirait que du bruit.
        assertThat(items.items()).extracting(item -> item.kind())
                .containsExactly(ActionItemKind.BALANCE_DUE);
        assertThat(items.total()).isEqualTo(1);
    }

    @Test
    void whenTheViewerIsPlatformStaff_thenNothingIsHidden() {
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.OUTBOX_DEAD_LETTER, "outbox:9", null));

        assertThat(service.getActionItems(ORG, UserRole.SUPER_MANAGER, "kc-staff").items())
                .hasSize(2);
    }

    @Test
    void whenTheViewerIsAHost_thenOnlyTheirPropertiesAreVisible() {
        when(propertyRepository.findIdsByOwnerKeycloakId("kc-owner", ORG))
                .thenReturn(List.of(300L));
        queueContains(
                row(ActionItemKind.BALANCE_DUE, "balance:1", 300L),
                row(ActionItemKind.BALANCE_DUE, "balance:2", 999L));

        assertThat(service.getActionItems(ORG, UserRole.HOST, "kc-owner").items())
                .extracting(item -> item.id())
                .containsExactly("balance:1");
    }

    @Test
    void whenTheViewerIsAHost_thenOrganizationWideActionsRemainVisible() {
        when(propertyRepository.findIdsByOwnerKeycloakId("kc-owner", ORG))
                .thenReturn(List.of(300L));
        // Une ligne sans logement porte une obligation de l ORGANISATION : RGPD,
        // taxe, invitation. La masquer à l exploitant revenait à lui cacher ses
        // propres échéances — un propriétaire tiers, lui, n a pas cet écran.
        queueContains(row(ActionItemKind.INVITATION_EXPIRED, "invitation:7", null));

        assertThat(service.getActionItems(ORG, UserRole.HOST, "kc-owner").items())
                .extracting(item -> item.id())
                .containsExactly("invitation:7");
    }

    @Test
    void whenTheViewerIsFieldStaff_thenNothingLeaksAtAll() {
        // Soldes, prestations et avis relèvent de la gestion : un intervenant ne
        // doit pas recevoir le carnet de l'organisation. Vérifié sans même lire
        // la table — le court-circuit fait partie du contrat.
        final ActionItemsDto items = service.getActionItems(ORG, UserRole.HOUSEKEEPER, "kc-hk");

        assertThat(items.items()).isEmpty();
        assertThat(items.total()).isZero();
        assertThat(items.totalsByKind()).isEmpty();
    }

    @Test
    void whenOneKindFloodsTheQueue_thenTheOthersStillGetSeen() {
        final ActionItem[] rows = new ActionItem[15];
        for (int i = 0; i < 14; i++) {
            rows[i] = row(ActionItemKind.REVIEW_UNANSWERED, "review:" + i, 300L);
        }
        rows[14] = row(ActionItemKind.FEED_STALE, "feed:1", 300L);
        queueContains(rows);

        final ActionItemsDto items = service.getActionItems(ORG, UserRole.SUPERVISOR, "kc");

        // Le plafond par nature existe pour ça : sans lui, quatorze avis
        // pousseraient le calendrier en panne hors de la carte.
        assertThat(items.items()).filteredOn(item -> item.kind() == ActionItemKind.FEED_STALE)
                .hasSize(1);
        assertThat(items.items()).filteredOn(item -> item.kind() == ActionItemKind.REVIEW_UNANSWERED)
                .hasSize(10);
        // Le décompte, lui, porte sur AVANT plafonnement : l'écran doit pouvoir
        // écrire « Avis sans réponse (14) » en n'en affichant que trois.
        assertThat(items.totalsByKind()).containsEntry(ActionItemKind.REVIEW_UNANSWERED, 14);
        assertThat(items.total()).isEqualTo(15);
    }

    @Test
    void whenTheTableHoldsAKindThisVersionIgnores_thenTheDashboardStillLoads() {
        // La table survit au code : après un retour arrière, elle peut contenir
        // des natures que cette version ne connaît plus. Les laisser lever une
        // exception ferait tomber tout le tableau de bord.
        final ActionItem unknown = row(ActionItemKind.BALANCE_DUE, "future:1", 300L);
        unknown.setKind("A_KIND_FROM_THE_FUTURE");
        queueContains(unknown, row(ActionItemKind.BALANCE_DUE, "balance:1", 300L));

        assertThat(service.getActionItems(ORG, UserRole.SUPERVISOR, "kc").items()).hasSize(1);
    }
}
