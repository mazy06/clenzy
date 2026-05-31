package com.clenzy.service;

import com.clenzy.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Self-healing minimal pour les references d'avatar peripherique.
 *
 * <p>Extrait dans un component dedie (au lieu d'une methode de {@link UserService})
 * pour eviter le piege classique {@code @Transactional} sur self-invocation :
 * Spring AOP n'intercepte pas les appels dans la meme classe, donc la tx
 * {@code REQUIRES_NEW} ne serait pas appliquee. Avec un bean separe injecte,
 * l'appel passe par le proxy Spring et la nouvelle tx est bien creee.</p>
 *
 * <p>Cas d'usage : {@code UserService.streamProfilePicture} detecte qu'un
 * {@code User.profilePictureUrl} pointe vers un fichier physiquement absent
 * (storage local vide en dev, objet S3 supprime hors workflow Clenzy, etc.)
 * et delegue ici pour cleaner la reference.</p>
 */
@Component
public class AvatarSelfHealer {

    private static final Logger log = LoggerFactory.getLogger(AvatarSelfHealer.class);

    private final UserRepository userRepository;

    public AvatarSelfHealer(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Clear {@code profilePictureUrl} pour un user dont le fichier physique
     * est introuvable. {@code REQUIRES_NEW} pour ne pas polluer la tx
     * read-only de l'appelant.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void clearStaleReference(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setProfilePictureUrl(null);
            userRepository.save(u);
            log.info("Self-healed stale avatar reference for user {}", userId);
        });
    }
}
