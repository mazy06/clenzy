package com.clenzy.integration.channex.service;

import com.clenzy.integration.channex.client.ChannexClient;
import com.clenzy.integration.channex.dto.ChannexConnectRequest;
import com.clenzy.integration.channex.dto.ChannexDiscoveredProperty;
import com.clenzy.integration.channex.dto.ChannexImportResult;
import com.clenzy.integration.channex.dto.ChannexRatePlanDto;
import com.clenzy.integration.channex.dto.ChannexRoomTypeDto;
import com.clenzy.integration.channex.model.ChannexPropertyMapping;
import com.clenzy.integration.channex.repository.ChannexPropertyMappingRepository;
import com.clenzy.model.Property;
import com.clenzy.repository.BookingRestrictionRepository;
import com.clenzy.repository.LengthOfStayDiscountRepository;
import com.clenzy.repository.OccupancyPricingRepository;
import com.clenzy.repository.PropertyPhotoRepository;
import com.clenzy.repository.PropertyRepository;
import com.clenzy.repository.RateOverrideRepository;
import com.clenzy.repository.RatePlanRepository;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.AmenityManagementService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Le piege deconnexion → re-import, et sa sortie.
 *
 * <p>Une deconnexion supprime le mapping mais laisse VOLONTAIREMENT la property
 * cote Channex. Celle-ci ressort donc en decouverte, ou l'import — dont le
 * metier est de creer — fabriquerait un SECOND logement Baitly : le premier
 * garderait tarifs, calendrier et reservations, le second heriterait du lien
 * vers le hub. C'est arrive le 2026-08-14 (logements 3 et 83). Ces tests
 * verrouillent la detection et le rattachement qui referment le piege.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ChannexReattachTest {

    @Mock private ChannexClient channexClient;
    @Mock private ChannexPropertyMappingRepository mappingRepository;
    @Mock private PropertyRepository propertyRepository;
    @Mock private PropertyPhotoRepository propertyPhotoRepository;
    @Mock private ChannexConnectService connectService;
    @Mock private UserRepository userRepository;
    @Mock private LengthOfStayDiscountRepository lengthOfStayDiscountRepository;
    @Mock private RatePlanRepository ratePlanRepository;
    @Mock private OccupancyPricingRepository occupancyPricingRepository;
    @Mock private RateOverrideRepository rateOverrideRepository;
    @Mock private BookingRestrictionRepository bookingRestrictionRepository;
    @Mock private AmenityManagementService amenityManagementService;
    @Mock private ChannexPricingImporter pricingImporter;
    @Mock private ChannexGroupService groupService;
    @Mock private org.springframework.beans.factory.ObjectProvider<ChannexImportService> selfProvider;

    private ObjectMapper objectMapper;
    private ChannexImportService service;

    private static final String HUB_ID = "789973a4-dabb-4a35-988b-5670ff4c103c";

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        service = new ChannexImportService(
            channexClient, mappingRepository, propertyRepository, propertyPhotoRepository,
            connectService, userRepository, lengthOfStayDiscountRepository,
            ratePlanRepository, occupancyPricingRepository, rateOverrideRepository,
            bookingRestrictionRepository, objectMapper, amenityManagementService, pricingImporter,
            groupService, selfProvider);
        when(selfProvider.getObject()).thenAnswer(inv -> service);
        when(groupService.propertyIdsOwnedByOtherOrgs(anyLong())).thenReturn(Set.of());
        when(mappingRepository.findAllByOrgId(anyLong())).thenReturn(List.of());
        when(channexClient.fetchAllChannelsRaw()).thenReturn(jn("{\"data\":[]}"));
    }

    private JsonNode jn(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    /** Un logement Baitly sans mapping — le candidat au rattachement. */
    private Property property(Long id, String name) {
        Property p = new Property();
        p.setId(id);
        p.setName(name);
        p.setOrganizationId(42L);
        return p;
    }

    /** La property du hub telle que la renvoie {@code GET /properties}. */
    private void hubHasProperty(String title) {
        when(channexClient.fetchAllPropertiesRaw()).thenReturn(jn(
            "{\"data\":[{\"id\":\"" + HUB_ID + "\",\"attributes\":{"
                + "\"title\":\"" + title + "\",\"currency\":\"USD\","
                + "\"country\":\"MA\",\"timezone\":\"Africa/Casablanca\"}}]}"));
    }

    private ChannexDiscoveredProperty discoverOne(Long orgId) {
        var items = service.discoverUnmappedProperties(orgId).items();
        assertThat(items).hasSize(1);
        return items.get(0);
    }

    // ─── Detection ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("un seul logement sans mapping porte ce nom -> rattachement propose")
    void singleNameMatch_suggestsReattach() {
        hubHasProperty("Test Property - Baitly");
        when(propertyRepository.findByOrganizationId(42L))
            .thenReturn(List.of(property(3L, "Test Property - Baitly")));

        var discovered = discoverOne(42L);

        assertThat(discovered.reattachPropertyId()).isEqualTo(3L);
        assertThat(discovered.reattachPropertyName()).isEqualTo("Test Property - Baitly");
    }

    @Test
    @DisplayName("casse et espaces multiples ne cassent pas le rapprochement")
    void nameMatchIgnoresCaseAndSpacing() {
        hubHasProperty("test property -   BAITLY");
        when(propertyRepository.findByOrganizationId(42L))
            .thenReturn(List.of(property(3L, "  Test Property -  baitly ")));

        assertThat(discoverOne(42L).reattachPropertyId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("deux logements homonymes -> aucune suggestion (choisir au hasard serait pire)")
    void ambiguousNameMatch_suggestsNothing() {
        hubHasProperty("Studio Canal");
        when(propertyRepository.findByOrganizationId(42L)).thenReturn(List.of(
            property(3L, "Studio Canal"),
            property(9L, "Studio Canal")));

        assertThat(discoverOne(42L).reattachPropertyId()).isNull();
    }

    @Test
    @DisplayName("logement Baitly deja mappe ailleurs -> pas candidat au rattachement")
    void alreadyMappedProperty_isNotACandidate() {
        hubHasProperty("Studio Canal");
        ChannexPropertyMapping other = new ChannexPropertyMapping();
        other.setClenzyPropertyId(3L);
        other.setChannexPropertyId("un-autre-uuid");
        when(mappingRepository.findAllByOrgId(42L)).thenReturn(List.of(other));
        when(propertyRepository.findById(3L)).thenReturn(java.util.Optional.of(property(3L, "Studio Canal")));
        when(propertyRepository.findByOrganizationId(42L))
            .thenReturn(List.of(property(3L, "Studio Canal")));

        assertThat(discoverOne(42L).reattachPropertyId()).isNull();
    }

    @Test
    @DisplayName("pivot dormant -> absent de la decouverte, donc aucun rattachement possible")
    void dormantPivot_isNotDiscoverableAtAll() {
        // Un pivot sans OTA actif reste cache : il n'a rien a proposer. Meme si
        // un logement Baitly portait son titre technique, il n'y a pas de ligne
        // ou afficher le rattachement — la garde !isPivot du calcul est une
        // seconde barriere, pour le jour ou un pivot AVEC OTA actif remonterait.
        hubHasProperty("[Clenzy Hub] OAuth Bridge");
        when(propertyRepository.findByOrganizationId(42L))
            .thenReturn(List.of(property(3L, "[Clenzy Hub] OAuth Bridge")));

        assertThat(service.discoverUnmappedProperties(42L).items()).isEmpty();
    }

    // ─── Rattachement ───────────────────────────────────────────────────────

    @Test
    @DisplayName("rattachement -> connect en IMPORT_EXISTING avec les IDs du hub, sans rien creer")
    void reattach_delegatesWithExistingIds() {
        when(channexClient.fetchRoomTypesForProperty(HUB_ID))
            .thenReturn(List.of(new ChannexRoomTypeDto("room-1", "Studio", null, 2)));
        when(channexClient.fetchRatePlansForProperty(HUB_ID))
            .thenReturn(List.of(new ChannexRatePlanDto("rate-1", "Standard Rate", "USD", null, null, null)));
        when(connectService.connect(anyLong(), anyLong(), any()))
            .thenReturn(new ChannexPropertyMapping());

        ChannexImportResult result = service.reattach(42L, HUB_ID, 3L);

        ArgumentCaptor<ChannexConnectRequest> captor =
            ArgumentCaptor.forClass(ChannexConnectRequest.class);
        verify(connectService).connect(eq(3L), eq(42L), captor.capture());
        assertThat(captor.getValue().mode()).isEqualTo(ChannexConnectRequest.Mode.IMPORT_EXISTING);
        assertThat(captor.getValue().channexPropertyId()).isEqualTo(HUB_ID);
        assertThat(captor.getValue().channexRoomTypeId()).isEqualTo("room-1");
        assertThat(captor.getValue().channexDefaultRatePlanId()).isEqualTo("rate-1");

        // Aucun logement Baitly cree : c'est toute la difference avec l'import.
        verify(propertyRepository, never()).save(any());
        assertThat(result.details().get(0).status()).isEqualTo("REATTACHED");
        assertThat(result.errors()).isZero();
    }

    @Test
    @DisplayName("hub sans room type -> erreur explicite, on n'invente pas de mapping")
    void reattach_withoutRoomType_refuses() {
        when(channexClient.fetchRoomTypesForProperty(HUB_ID)).thenReturn(List.of());
        when(channexClient.fetchRatePlansForProperty(HUB_ID))
            .thenReturn(List.of(new ChannexRatePlanDto("rate-1", "Standard Rate", "USD", null, null, null)));

        ChannexImportResult result = service.reattach(42L, HUB_ID, 3L);

        assertThat(result.errors()).isEqualTo(1);
        assertThat(result.details().get(0).status()).isEqualTo("ERROR");
        assertThat(result.details().get(0).message()).contains("importez-le");
        verify(connectService, never()).connect(anyLong(), anyLong(), any());
    }
}
