package com.clenzy.service;

import com.clenzy.dto.HomeLocationDto;
import com.clenzy.integration.openmeteo.OpenMeteoClient;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("HomeLocationService — ville du compte resolue en coordonnees")
class HomeLocationServiceTest {

    private static final String KEYCLOAK_ID = "kc-42";

    @Mock private UserRepository userRepository;
    @Mock private OpenMeteoClient openMeteoClient;
    @InjectMocks private HomeLocationService service;

    @Test
    @DisplayName("ville renseignee : renvoie le nom RESOLU et ses coordonnees")
    void whenAccountHasCity_thenReturnsResolvedCoordinates() {
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(userInCity("marrakech")));
        when(openMeteoClient.geocode("marrakech"))
                .thenReturn(Optional.of(new OpenMeteoClient.GeoCoord(31.6295, -7.9811, "Marrakesh", "MA")));

        Optional<HomeLocationDto> location = service.findForUser(KEYCLOAK_ID);

        assertThat(location).contains(new HomeLocationDto("Marrakesh", 31.6295, -7.9811));
    }

    @Test
    @DisplayName("compte sans ville : vide, et le geocodeur n'est jamais sollicite")
    void whenAccountHasNoCity_thenEmptyWithoutGeocoding() {
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(userInCity(null)));

        Optional<HomeLocationDto> location = service.findForUser(KEYCLOAK_ID);

        assertThat(location).isEmpty();
        verify(openMeteoClient, never()).geocode(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("ville blanche : traitee comme absente")
    void whenCityIsBlank_thenEmptyWithoutGeocoding() {
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(userInCity("   ")));

        assertThat(service.findForUser(KEYCLOAK_ID)).isEmpty();
        verify(openMeteoClient, never()).geocode(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("geocodeur muet : vide — centrer une carte ne doit jamais faire echouer l'ecran")
    void whenGeocoderFindsNothing_thenEmpty() {
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.of(userInCity("Atlantide")));
        when(openMeteoClient.geocode("Atlantide")).thenReturn(Optional.empty());

        assertThat(service.findForUser(KEYCLOAK_ID)).isEmpty();
    }

    @Test
    @DisplayName("utilisateur inconnu : vide")
    void whenUserIsUnknown_thenEmpty() {
        when(userRepository.findByKeycloakId(KEYCLOAK_ID)).thenReturn(Optional.empty());

        assertThat(service.findForUser(KEYCLOAK_ID)).isEmpty();
    }

    private static User userInCity(String city) {
        User user = new User();
        user.setKeycloakId(KEYCLOAK_ID);
        user.setCity(city);
        return user;
    }
}
