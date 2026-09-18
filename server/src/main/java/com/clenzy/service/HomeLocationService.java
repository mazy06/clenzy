package com.clenzy.service;

import com.clenzy.dto.HomeLocationDto;
import com.clenzy.integration.openmeteo.OpenMeteoClient;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Ou les cartes doivent s'ouvrir pour l'utilisateur connecte.
 *
 * <p>Une carte qui s'ouvre toujours sur Paris demande a chacun de se
 * retrouver avant de pouvoir lire quoi que ce soit. La ville du compte est la
 * seule ancre que Baitly connaisse de facon stable — elle est saisie a
 * l'inscription — et elle ne bouge pas avec le reseau, contrairement a une
 * geolocalisation par IP.</p>
 *
 * <p>Service dedie plutot qu'une methode de plus sur {@code UserService} :
 * resoudre une ville en coordonnees est une preoccupation de geocodage, et
 * {@code UserService} porte deja quatorze dependances.</p>
 */
@Service
public class HomeLocationService {

    private final UserRepository userRepository;
    private final OpenMeteoClient openMeteoClient;

    public HomeLocationService(UserRepository userRepository, OpenMeteoClient openMeteoClient) {
        this.userRepository = userRepository;
        this.openMeteoClient = openMeteoClient;
    }

    /**
     * Resout la ville du compte en coordonnees.
     *
     * <p>Vide des que la chaine casse quelque part — compte sans ville (cree
     * par un administrateur, ou invite comme technicien), ville que le
     * geocodeur ne reconnait pas, Open-Meteo injoignable sans cache. L'appelant
     * retombe alors sur son propre defaut : centrer une carte est un CONFORT,
     * jamais une raison de faire echouer l'ecran.</p>
     *
     * @param keycloakId sujet du JWT de l'utilisateur connecte
     */
    @Transactional(readOnly = true)
    public Optional<HomeLocationDto> findForUser(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId)
                .map(User::getCity)
                .filter(StringUtils::hasText)
                .flatMap(openMeteoClient::geocode)
                .map(coord -> new HomeLocationDto(coord.resolvedName(), coord.latitude(), coord.longitude()));
    }
}
