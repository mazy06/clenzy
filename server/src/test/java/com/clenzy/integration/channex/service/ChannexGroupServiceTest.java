package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.model.ChannexOrganizationGroup;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexOrganizationGroupRepository;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Cloisonnement du hub Channex par organisation.
 *
 * <p>La cle API Channex etant unique pour toute la plateforme, ces tests
 * verifient la seule chose qui empeche une organisation de voir — ou de
 * s'approprier — les logements d'une autre.</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ChannexGroupService — cloisonnement du hub par organisation")
class ChannexGroupServiceTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexOrganizationGroupRepository groupRepository;
    @Mock private ChannexPropertyMappingRepository mappingRepository;

    private ChannexGroupService service;

    @BeforeEach
    void setUp() {
        service = new ChannexGroupService(channexClient, groupRepository, mappingRepository);
    }

    private ChannexOrganizationGroup row(Long orgId, String groupId) {
        ChannexOrganizationGroup g = new ChannexOrganizationGroup();
        g.setOrganizationId(orgId);
        g.setChannexGroupId(groupId);
        g.setTitle(ChannexGroupService.canonicalTitle(orgId));
        return g;
    }

    private ChannexPropertyMapping mapping(Long orgId, String channexPropertyId) {
        ChannexPropertyMapping m = new ChannexPropertyMapping();
        m.setOrganizationId(orgId);
        m.setChannexPropertyId(channexPropertyId);
        return m;
    }

    // ─── resolveGroupId ─────────────────────────────────────────────────────

    @Test
    @DisplayName("whenGroupAlreadyKnownLocally_thenNoHubCall")
    void resolve_usesLocalRow() {
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));

        assertThat(service.resolveGroupId(7L)).contains("grp-7");
        verify(channexClient, never()).createGroup(anyString());
    }

    @Test
    @DisplayName("whenGroupExistsOnHubButNotLocally_thenReattachedInsteadOfDuplicated")
    void resolve_reattachesExistingGroup() {
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(channexClient.fetchGroupsByTitle())
            .thenReturn(Map.of(ChannexGroupService.canonicalTitle(7L), "grp-existant"));

        assertThat(service.resolveGroupId(7L)).contains("grp-existant");
        verify(channexClient, never()).createGroup(anyString());
        verify(groupRepository).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("whenNoGroupAnywhere_thenCreatedAndPersisted")
    void resolve_createsGroup() {
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(channexClient.fetchGroupsByTitle()).thenReturn(Map.of());
        when(channexClient.createGroup(ChannexGroupService.canonicalTitle(7L))).thenReturn("grp-neuf");

        assertThat(service.resolveGroupId(7L)).contains("grp-neuf");
        verify(groupRepository).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("whenHubRefusesToProvision_thenEmptyRatherThanThrow")
    void resolve_failsOpen() {
        // Fail-open assume : l'isolation ne doit pas bloquer l'onboarding.
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(channexClient.fetchGroupsByTitle()).thenThrow(new RuntimeException("hub down"));

        assertThat(service.resolveGroupId(7L)).isEmpty();
    }

    // ─── propertyIdsOwnedByOtherOrgs ────────────────────────────────────────

    @Test
    @DisplayName("whenListingForeignProperties_thenOwnGroupExcluded")
    void foreign_excludesOwnGroup() {
        when(groupRepository.findAllBy()).thenReturn(List.of(row(7L, "grp-7"), row(9L, "grp-9")));
        when(channexClient.fetchPropertyIdsInGroup("grp-9")).thenReturn(Set.of("p-9a", "p-9b"));

        assertThat(service.propertyIdsOwnedByOtherOrgs(7L)).containsExactlyInAnyOrder("p-9a", "p-9b");
        verify(channexClient, never()).fetchPropertyIdsInGroup("grp-7");
    }

    @Test
    @DisplayName("whenOneForeignGroupUnreadable_thenOthersStillHidden")
    void foreign_bestEffortPerGroup() {
        // Un group injoignable ne doit pas rouvrir la visibilite sur les autres.
        when(groupRepository.findAllBy()).thenReturn(List.of(row(9L, "grp-9"), row(11L, "grp-11")));
        when(channexClient.fetchPropertyIdsInGroup("grp-9")).thenThrow(new RuntimeException("timeout"));
        when(channexClient.fetchPropertyIdsInGroup("grp-11")).thenReturn(Set.of("p-11"));

        assertThat(service.propertyIdsOwnedByOtherOrgs(7L)).containsExactly("p-11");
    }

    // ─── assignPropertyToOrgGroup ───────────────────────────────────────────

    @Test
    @DisplayName("whenAssigning_thenAttachedFirstThenDetachedFromOthers")
    void assign_attachesThenDetaches() {
        // Channex refuse de retirer une property de son unique group : l'ordre
        // rattacher-puis-detacher est impose par l'API.
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));
        when(channexClient.fetchPropertyGroupIds("p-1")).thenReturn(List.of("grp-defaut"));

        assertThat(service.assignPropertyToOrgGroup(7L, "p-1")).isTrue();

        var inOrder = org.mockito.Mockito.inOrder(channexClient);
        inOrder.verify(channexClient).addPropertyToGroup("grp-7", "p-1");
        inOrder.verify(channexClient).removePropertyFromGroup("grp-defaut", "p-1");
    }

    @Test
    @DisplayName("whenAlreadyInTargetGroupOnly_thenNoWrite")
    void assign_isIdempotent() {
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));
        when(channexClient.fetchPropertyGroupIds("p-1")).thenReturn(List.of("grp-7"));

        assertThat(service.assignPropertyToOrgGroup(7L, "p-1")).isTrue();
        verify(channexClient, never()).addPropertyToGroup(anyString(), anyString());
        verify(channexClient, never()).removePropertyFromGroup(anyString(), anyString());
    }

    @Test
    @DisplayName("whenGroupUnavailable_thenAssignmentReportsFailure")
    void assign_reportsFailureWhenNoGroup() {
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.empty());
        when(channexClient.fetchGroupsByTitle()).thenThrow(new RuntimeException("hub down"));

        assertThat(service.assignPropertyToOrgGroup(7L, "p-1")).isFalse();
        verify(channexClient, never()).addPropertyToGroup(anyString(), anyString());
    }

    // ─── backfillExistingProperties ─────────────────────────────────────────

    @Test
    @DisplayName("whenBackfilling_thenEachMappingJoinsItsOrgGroup")
    void backfill_assignsAcrossOrgs() {
        when(mappingRepository.findAllAcrossOrgs())
            .thenReturn(List.of(mapping(7L, "p-7"), mapping(9L, "p-9")));
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));
        when(groupRepository.findByOrganizationId(9L)).thenReturn(Optional.of(row(9L, "grp-9")));
        when(channexClient.fetchPropertyIdsInGroup("grp-7")).thenReturn(Set.of());
        when(channexClient.fetchPropertyIdsInGroup("grp-9")).thenReturn(Set.of());
        when(channexClient.fetchPropertyGroupIds(anyString())).thenReturn(List.of());

        var report = service.backfillExistingProperties();

        assertThat(report.propertiesAssigned()).isEqualTo(2);
        assertThat(report.failures()).isZero();
        verify(channexClient).addPropertyToGroup("grp-7", "p-7");
        verify(channexClient).addPropertyToGroup("grp-9", "p-9");
    }

    @Test
    @DisplayName("whenAlreadyIsolated_thenBackfillCountsWithoutRewriting")
    void backfill_isIdempotent() {
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mapping(7L, "p-7")));
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));
        when(channexClient.fetchPropertyIdsInGroup("grp-7")).thenReturn(Set.of("p-7"));

        var report = service.backfillExistingProperties();

        assertThat(report.propertiesAlreadyIsolated()).isEqualTo(1);
        assertThat(report.propertiesAssigned()).isZero();
        verify(channexClient, never()).addPropertyToGroup(anyString(), anyString());
    }

    // ─── purgeUngroupedHubProperties ────────────────────────────────────────

    private com.fasterxml.jackson.databind.JsonNode jn(String json) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    @DisplayName("whenMappedPropertyIsNotYetGrouped_thenPurgeRefusedEntirely")
    void purge_blockedUntilBackfillHasRun() {
        // Le verrou : avant backfill, « sans group » peut vouloir dire « cree
        // avant les groups ». Purger la detruirait des logements de production.
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[
              {"id":"p-mappee","attributes":{"title":"Logement connecte"}},
              {"id":"p-inconnue","attributes":{"title":"Venue d'ailleurs"}}
            ]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of());
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mapping(7L, "p-mappee")));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        var report = service.purgeUngroupedHubProperties(false);

        assertThat(report.blockedByPendingBackfill()).isTrue();
        assertThat(report.deleted()).isZero();
        verify(channexClient, never()).deleteProperty(anyString());
    }

    @Test
    @DisplayName("whenDryRun_thenCandidatesListedButNothingDeleted")
    void purge_dryRunDeletesNothing() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[{"id":"p-orpheline","attributes":{"title":"Sans organisation"}}]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of());
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of());
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        var report = service.purgeUngroupedHubProperties(true);

        assertThat(report.candidates()).isEqualTo(1);
        assertThat(report.deleted()).isZero();
        verify(channexClient, never()).deleteProperty(anyString());
    }

    @Test
    @DisplayName("whenConfirmed_thenOnlyUnownedPropertiesAreDeleted")
    void purge_sparesEverythingOwned() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[
              {"id":"p-groupee","attributes":{"title":"Rattachee a une org"}},
              {"id":"p-avec-channel","attributes":{"title":"Distribuee"}},
              {"id":"p-pivot","attributes":{"title":"[Clenzy Hub] OAuth Bridge"}},
              {"id":"p-orpheline","attributes":{"title":"Sans organisation"}}
            ]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of(row(7L, "grp-7")));
        when(channexClient.fetchPropertyIdsInGroup("grp-7")).thenReturn(Set.of("p-groupee"));
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of(mapping(7L, "p-groupee")));
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("""
            {"data":[{"id":"c-1","attributes":{"properties":["p-avec-channel"]}}]}"""));

        var report = service.purgeUngroupedHubProperties(false);

        assertThat(report.blockedByPendingBackfill()).isFalse();
        assertThat(report.deleted()).isEqualTo(1);
        verify(channexClient).deleteProperty("p-orpheline");
        verify(channexClient, never()).deleteProperty("p-groupee");
        verify(channexClient, never()).deleteProperty("p-avec-channel");
        // La pivot active peut porter un OAuth en cours : on ne la touche pas.
        verify(channexClient, never()).deleteProperty("p-pivot");
    }

    @Test
    @DisplayName("whenConsumedPivotIsOrphan_thenPurged")
    void purge_removesConsumedPivots() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[{"id":"p-vieille-pivot",
              "attributes":{"title":"[Clenzy] OAuth Container 2026-01-02 10:00"}}]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of());
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of());
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));

        var report = service.purgeUngroupedHubProperties(false);

        assertThat(report.deleted()).isEqualTo(1);
        verify(channexClient).deleteProperty("p-vieille-pivot");
    }

    @Test
    @DisplayName("whenAGroupIsUnreadable_thenPurgeAbortsRatherThanGuess")
    void purge_abortsOnPartialView() {
        // Un group illisible ferait passer son contenu pour orphelin.
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[{"id":"p-1","attributes":{"title":"Un logement"}}]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of(row(9L, "grp-9")));
        when(channexClient.fetchPropertyIdsInGroup("grp-9")).thenThrow(new RuntimeException("timeout"));

        var report = service.purgeUngroupedHubProperties(false);

        assertThat(report.blockedByPendingBackfill()).isTrue();
        assertThat(report.deleted()).isZero();
        verify(channexClient, never()).deleteProperty(anyString());
    }

    @Test
    @DisplayName("whenDeletionFails_thenReportedWithoutStoppingTheRest")
    void purge_reportsFailuresPerProperty() {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn("""
            {"data":[
              {"id":"p-ko","attributes":{"title":"Recalcitrante"}},
              {"id":"p-ok","attributes":{"title":"Sans organisation"}}
            ]}"""));
        when(groupRepository.findAllBy()).thenReturn(List.of());
        when(mappingRepository.findAllAcrossOrgs()).thenReturn(List.of());
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
        org.mockito.Mockito.doThrow(new RuntimeException("409"))
            .when(channexClient).deleteProperty("p-ko");

        var report = service.purgeUngroupedHubProperties(false);

        assertThat(report.failures()).isEqualTo(1);
        assertThat(report.deleted()).isEqualTo(1);
        verify(channexClient).deleteProperty("p-ok");
    }

    @Test
    @DisplayName("whenGroupContentIsReadOnce_thenNotRefetchedPerProperty")
    void backfill_readsGroupContentOncePerGroup() {
        when(mappingRepository.findAllAcrossOrgs())
            .thenReturn(List.of(mapping(7L, "p-a"), mapping(7L, "p-b")));
        when(groupRepository.findByOrganizationId(7L)).thenReturn(Optional.of(row(7L, "grp-7")));
        when(channexClient.fetchPropertyIdsInGroup("grp-7")).thenReturn(Set.of());
        when(channexClient.fetchPropertyGroupIds(anyString())).thenReturn(List.of());

        service.backfillExistingProperties();

        verify(channexClient, org.mockito.Mockito.times(1)).fetchPropertyIdsInGroup(eq("grp-7"));
    }
}
