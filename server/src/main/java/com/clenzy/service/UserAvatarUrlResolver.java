package com.clenzy.service;

import org.springframework.stereotype.Service;

/**
 * URL publique de la photo de profil d'un utilisateur.
 *
 * <p>L'URL porte un ticket HMAC : une balise {@code <img>} ne peut pas envoyer
 * d'en-tete {@code Authorization}, et servir l'avatar sans jeton en ferait une
 * ressource publique. Le ticket est borne au scope {@code avatar:{id}}, donc
 * il n'ouvre rien d'autre.</p>
 *
 * <p>Ce resolveur existe pour que le format de l'URL soit ecrit UNE fois :
 * plusieurs services doivent la produire — {@link UserService} pour la fiche,
 * {@code ManagerService} pour le portefeuille — et deux copies auraient
 * divergees a la premiere evolution du chemin.</p>
 */
@Service
public class UserAvatarUrlResolver {

    private static final String SCOPE = "avatar:";

    private final MediaTicketService mediaTicketService;

    public UserAvatarUrlResolver(MediaTicketService mediaTicketService) {
        this.mediaTicketService = mediaTicketService;
    }

    /** Scope du ticket, partage avec le controleur qui le verifie. */
    public static String scopeFor(Long userId) {
        return SCOPE + userId;
    }

    /**
     * URL de la photo, ou {@code null} si l'utilisateur n'en a pas.
     *
     * @param userId    identifiant de l'utilisateur
     * @param storedRef contenu de {@code users.profile_picture_url} : une cle de
     *                  stockage, ou deja une URL absolue pour un avatar heberge
     *                  ailleurs — auquel cas on la rend telle quelle
     */
    public String publicUrl(Long userId, String storedRef) {
        if (userId == null || storedRef == null || storedRef.isBlank()) {
            return null;
        }
        if (storedRef.startsWith("http://") || storedRef.startsWith("https://")) {
            return storedRef;
        }
        return "/api/users/" + userId + "/profile-picture?ticket="
                + mediaTicketService.mint(scopeFor(userId));
    }
}
