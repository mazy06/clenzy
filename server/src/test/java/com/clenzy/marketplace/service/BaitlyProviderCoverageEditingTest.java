package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.*;
import com.clenzy.marketplace.repository.MarketplaceProviderZoneRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;

class BaitlyProviderCoverageEditingTest {
    final MarketplaceProviderZoneRepository zones=mock(MarketplaceProviderZoneRepository.class);
    final BaitlyProviderCoverageEditing editing=new BaitlyProviderCoverageEditing(zones);
    final MarketplaceProvider provider=new MarketplaceProvider();

    @Test void linkedProfileEditsTheCanonicalPersonZonesAndKeepsItsRadius() {
        provider.setId(10L); provider.setUserId(100L); provider.setTravelRadiusKm(15);
        editing.replace(provider,List.of(new BaitlyProviderCoverageEditing.Zone("FR","75","75111",null,null,null,true)));
        var order=inOrder(zones);
        order.verify(zones).lockIndividual(100L); order.verify(zones).initializeIndividual(100L);
        order.verify(zones).deleteIndividualZones(100L);
        var saved=ArgumentCaptor.forClass(MarketplaceProviderZone.class);verify(zones).save(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(100L);
        assertThat(saved.getValue().getProvider()).isNull();
        assertThat(saved.getValue().getArrondissement()).isEqualTo("75111");
        assertThat(provider.getTravelRadiusKm()).isEqualTo(15);
    }
    @Test void unlinkedCandidateKeepsItsOwnDraft() {
        provider.setId(10L);
        editing.replace(provider,List.of(new BaitlyProviderCoverageEditing.Zone("MA",null,null,"Rabat",null,null,true)));
        verify(zones).deleteCandidateZones(10L);verify(zones,never()).deleteIndividualZones(any());
        var saved=ArgumentCaptor.forClass(MarketplaceProviderZone.class);verify(zones).save(saved.capture());
        assertThat(saved.getValue().getProvider()).isSameAs(provider);assertThat(saved.getValue().getUserId()).isNull();
    }
    @Test void invalidSectorDoesNotEraseExistingCoverage() {
        assertThatThrownBy(()->editing.replace(provider,List.of(new BaitlyProviderCoverageEditing.Zone("FR","69","75111",null,null,null,true))))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(zones);
    }
    @Test void omittedSectorsFromLegacyClientsStayUnchanged() {
        editing.replace(provider,null);verifyNoInteractions(zones);
    }
    @Test void frenchCityIsCanonicalAndValidatedBeforeDeletingSavedSectors() {
        editing.replace(provider,List.of(new BaitlyProviderCoverageEditing.Zone("FR","92",null," chatenay malabry ",null,null,true)));
        var saved=ArgumentCaptor.forClass(MarketplaceProviderZone.class);verify(zones).save(saved.capture());
        assertThat(saved.getValue().getCity()).isEqualTo("Châtenay-Malabry");
        clearInvocations(zones);
        assertThatThrownBy(()->editing.replace(provider,List.of(new BaitlyProviderCoverageEditing.Zone("FR","93",null,"Courbevoie",null,null,true))))
            .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(zones);
    }
    @Test void emptyListIntentionallyClearsOnlyThisPersonSectors() {
        provider.setId(10L);provider.setUserId(100L);editing.replace(provider,List.of());
        verify(zones).deleteIndividualZones(100L);verify(zones,never()).save(any());
    }
}
