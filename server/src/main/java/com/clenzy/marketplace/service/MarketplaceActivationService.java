package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;
import com.clenzy.marketplace.repository.MarketplaceProviderRepository;
import com.clenzy.model.User;
import com.clenzy.repository.UserRepository;
import com.clenzy.service.KeycloakService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;

/**
 * Le prestataire accepte definit son mot de passe, sur nos pages.
 *
 * <p>Meme motif que l'inscription client ({@code InscriptionService}) : un lien
 * recu par courriel, un formulaire a nous, et le serveur pose le mot de passe
 * dans Keycloak. Le prestataire ne quitte jamais le site Baitly.</p>
 *
 * <p><b>Le mot de passe traverse le serveur</b>, et c'est assume : c'est deja le
 * cas du parcours d'inscription existant, et c'est la contrepartie d'un
 * formulaire maison. Il n'est ni journalise, ni persiste — il part directement
 * vers Keycloak, qui reste la seule source d'authentification.</p>
 */
@Service
public class MarketplaceActivationService {

    private static final Logger log = LoggerFactory.getLogger(MarketplaceActivationService.class);

    /** Aligne sur {@code SetPasswordDto} du parcours client : une seule regle dans le produit. */
    static final int MIN_PASSWORD_LENGTH = 8;

    private final MarketplaceProviderRepository providerRepository;
    private final UserRepository userRepository;
    private final KeycloakService keycloakService;
    private final Clock clock;
    private final MarketplaceActivationTokenConsumer tokens;

    public MarketplaceActivationService(MarketplaceProviderRepository providerRepository,
                                        UserRepository userRepository,
                                        KeycloakService keycloakService,
                                        Clock clock, MarketplaceActivationTokenConsumer tokens) {
        this.providerRepository = providerRepository;
        this.userRepository = userRepository;
        this.keycloakService = keycloakService;
        this.clock = clock;
        this.tokens = tokens;
    }

    /**
     * Jeton inconnu, expire, ou deja consomme.
     *
     * <p>Un seul type pour les trois : distinguer « inconnu » d'« expire »
     * dirait a qui essaie des jetons lesquels ont existe.</p>
     */
    public static class InvalidActivationTokenException extends RuntimeException {
        public InvalidActivationTokenException() {
            super("Ce lien d'activation n'est plus valable. Utilisez « Mot de passe oublié » sur la page de connexion.");
        }
    }

    /** Ce que le formulaire affiche avant la saisie : a qui appartient ce lien. */
    @Transactional(readOnly = true)
    public String describe(String token) {
        return requireValidToken(token).getDisplayName();
    }

    /**
     * Pose le mot de passe et consomme le jeton.
     *
     * <p>Une seule requête consomme le lien dans une transaction indépendante.
     * Aucun verrou SQL ne reste ouvert pendant Keycloak. En cas d'échec réseau,
     * le lien n'est pas réarmé : une requête retardée pourrait encore modifier le
     * mot de passe. La récupération passe par le courriel de réinitialisation.</p>
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
    public void activate(String token, String password) {
        if (password == null || password.length() < MIN_PASSWORD_LENGTH || password.length() > 200) {
            throw new IllegalArgumentException(
                "Le mot de passe doit contenir entre " + MIN_PASSWORD_LENGTH + " et 200 caractères.");
        }
        MarketplaceProvider provider = requireValidToken(token);

        Long userId = provider.getUserId();
        if (userId == null) {
            // Ne devrait pas arriver : le jeton n'est emis qu'apres la creation
            // du compte. Si cela se produit, le dire plutot que planter plus loin.
            log.error("Jeton d'activation sur la fiche {} qui n'a aucun compte", provider.getId());
            throw new InvalidActivationTokenException();
        }
        User user = userRepository.findById(userId)
            .orElseThrow(InvalidActivationTokenException::new);
        if (user.getKeycloakId() == null) {
            throw new InvalidActivationTokenException();
        }

        if (!tokens.consume(provider.getId(), userId, MarketplaceUploadTokens.hash(token), LocalDateTime.now(clock))) {
            throw new InvalidActivationTokenException();
        }
        try {
            keycloakService.resetPassword(user.getKeycloakId(), password);
        } catch (RuntimeException failure) {
            // Ne pas journaliser l'exception externe : elle pourrait contenir des données sensibles.
            log.warn("Activation de la fiche {} interrompue ; récupération du compte nécessaire", provider.getId());
            try {
                keycloakService.sendPasswordResetEmailByKeycloakId(user.getKeycloakId());
            } catch (RuntimeException recoveryFailure) {
                throw new ActivationRecoveryException(false);
            }
            throw new ActivationRecoveryException(true);
        }
        log.info("Compte du prestataire {} active", provider.getId());
    }

    private MarketplaceProvider requireValidToken(String token) {
        if (token == null || token.isBlank()) {
            throw new InvalidActivationTokenException();
        }
        MarketplaceProvider provider = providerRepository
            .findByActivationTokenHash(MarketplaceUploadTokens.hash(token))
            .orElseThrow(InvalidActivationTokenException::new);

        LocalDateTime expiry = provider.getActivationTokenExpiresAt();
        if (expiry == null || !expiry.isAfter(LocalDateTime.now(clock))) {
            throw new InvalidActivationTokenException();
        }
        return provider;
    }

    public static class ActivationRecoveryException extends RuntimeException {
        public ActivationRecoveryException(boolean emailSent) {
            super(emailSent
                    ? "L'activation n'a pas pu être confirmée. Un courriel vous permet de définir votre mot de passe."
                    : "L'activation n'a pas pu être confirmée. Utilisez « Mot de passe oublié » sur la page de connexion lorsque le service sera rétabli.");
        }
    }
}
