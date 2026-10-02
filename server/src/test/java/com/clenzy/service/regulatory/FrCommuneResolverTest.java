package com.clenzy.service.regulatory;

import com.clenzy.integration.geo.BanGeocodingClient;
import com.clenzy.integration.geo.BanGeocodingClient.Match;
import com.clenzy.model.Property;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.ResourceAccessException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FrCommuneResolverTest {

    @Mock private BanGeocodingClient client;

    private Property property(String country, String address, String postcode, String city) {
        Property p = new Property();
        p.setId(1L);
        p.setCountryCode(country);
        p.setAddress(address);
        p.setPostalCode(postcode);
        p.setCity(city);
        return p;
    }

    @Test
    void parisArrondissement_isBroughtBackToTheCommune() {
        when(client.search("10 rue de la Paix 75002 Paris", "75002", false))
                .thenReturn(Optional.of(new Match("75102", "Paris", "75002", 0.96)));

        assertThat(new FrCommuneResolver(client).resolve(property("FR", "10 rue de la Paix", "75002", "Paris")))
                .contains("75056");
    }

    @Test
    void unknownStreet_fallsBackOnTheCityAlone() {
        when(client.search("Chemin inconnu 20000 Ajaccio", "20000", false)).thenReturn(Optional.empty());
        when(client.search("20000 Ajaccio", "20000", true))
                .thenReturn(Optional.of(new Match("2A004", "Ajaccio", "20000", 0.95)));

        assertThat(new FrCommuneResolver(client).resolve(property("FR", "Chemin inconnu", "20000", "Ajaccio")))
                .contains("2A004");
    }

    @Test
    void nonFrenchProperty_isNeverGeocoded() {
        assertThat(new FrCommuneResolver(client).resolve(property("MA", "Rue X", null, "Marrakech"))).isEmpty();
        verify(client, never()).search(anyString(), eq(null), eq(false));
    }

    @Test
    void unreachableBan_leavesTheCommuneUnresolvedWithoutFailing() {
        when(client.search(anyString(), eq("69001"), eq(false))).thenThrow(new ResourceAccessException("timeout"));

        assertThat(new FrCommuneResolver(client).resolve(property("FR", "1 quai", "69001", "Lyon"))).isEmpty();
    }

    @Test
    void arrondissementCodes_mapToTheirCommune() {
        assertThat(FrCommuneResolver.toCommune("75120")).isEqualTo("75056");
        assertThat(FrCommuneResolver.toCommune("69389")).isEqualTo("69123");
        assertThat(FrCommuneResolver.toCommune("13216")).isEqualTo("13055");
        assertThat(FrCommuneResolver.toCommune("06088")).isEqualTo("06088");
    }
}
