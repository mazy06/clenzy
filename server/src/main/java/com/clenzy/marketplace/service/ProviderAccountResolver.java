package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.User;
import com.clenzy.service.UserService;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Quelle fiche prestataire appartient au compte connecte.
 *
 * <p>Un prestataire accepte est un utilisateur comme un autre : c'est
 * {@code MarketplaceProvider.userId} qui fait le lien, jamais un identifiant
 * passe en parametre — sinon n'importe qui repondrait aux demandes de n'importe
 * qui.</p>
 *
 * <p>Extrait dans la couche service, et non laisse dans le controller : la
 * regle d'architecture gelee du projet interdit a un controller de toucher un
 * repository, et elle a raison — c'est ici que se decide un droit d'acces.</p>
 */
@Service
public class ProviderAccountResolver {

    private final MarketplaceProviderRepository providerRepository;
    private final UserService userService;

    public ProviderAccountResolver(MarketplaceProviderRepository providerRepository,
                                   UserService userService) {
        this.providerRepository = providerRepository;
        this.userService = userService;
    }

    /** Identifiant applicatif du compte connecte, ou {@code null}. */
    @Transactional(readOnly = true)
    public Long userIdOf(String keycloakId) {
        User user = userService.findByKeycloakId(keycloakId);
        return user != null ? user.getId() : null;
    }

    /** Fiche du compte connecte, ou {@code null} s'il n'en a pas. */
    @Transactional(readOnly = true)
    public Long providerIdOrNull(String keycloakId) {
        Long userId = userIdOf(keycloakId);
        if (userId == null) {
            return null;
        }
        return providerRepository.findByUserId(userId)
            .map(MarketplaceProvider::getId)
            .orElse(null);
    }

    /**
     * Fiche du compte connecte, ou refus.
     *
     * <p>Refuse plutot que de rendre {@code null} : un compte sans fiche n'a
     * rien a faire sur ces chemins, et le laisser passer ferait chercher les
     * demandes d'un identifiant nul — qui n'appartient a personne.</p>
     */
    @Transactional(readOnly = true)
    public Long requireProviderId(String keycloakId) {
        Long providerId = providerIdOrNull(keycloakId);
        if (providerId == null) {
            throw new AccessDeniedException(
                "Votre compte n'est rattaché à aucune fiche prestataire");
        }
        return providerId;
    }
}
