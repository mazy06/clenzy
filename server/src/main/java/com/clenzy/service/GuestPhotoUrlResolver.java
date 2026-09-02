package com.clenzy.service;

import org.springframework.stereotype.Component;

/**
 * Construit l'URL publique de la photo d'un voyageur.
 *
 * <p>La base ne stocke qu'une cle de stockage opaque
 * ({@code guests/{id}/{uuid}.jpg}) : c'est ICI qu'elle devient une URL servable,
 * et nulle part ailleurs. Deux consommateurs la reclament — la fiche voyageur et
 * la brique du planning — et le peripherique de securite (le nom du flux signe)
 * doit rester le meme des deux cotes, sans quoi un ticket emis d'un cote serait
 * refuse de l'autre.</p>
 *
 * <p>L'URL porte un ticket HMAC plutot qu'un en-tete d'autorisation : un
 * {@code <img src>} n'en envoie aucun. Le ticket est stable sur une fenetre
 * d'environ quinze minutes, donc l'URL reste cachable par le navigateur.</p>
 */
@Component
public class GuestPhotoUrlResolver {

    /** Nom du flux signe. Distinct de {@code avatar:{id}} des utilisateurs :
     *  les deux tables ont leurs propres identifiants, un ticket voyageur ne
     *  doit pas ouvrir la photo de l'utilisateur portant le meme numero. */
    private static final String SCOPE = "guest-photo:";

    private final MediaTicketService mediaTicketService;

    public GuestPhotoUrlResolver(MediaTicketService mediaTicketService) {
        this.mediaTicketService = mediaTicketService;
    }

    /** Nom du flux signe pour ce voyageur, cote emission comme cote verification. */
    public static String scopeFor(Long guestId) {
        return SCOPE + guestId;
    }

    /**
     * URL relative signee, ou {@code null} quand le voyageur n'a pas de photo —
     * l'interface retombe alors sur ses initiales.
     *
     * <p>Une valeur qui est deja une URL absolue (photo importee d'un canal) est
     * renvoyee telle quelle : elle ne transite pas par nos routes.</p>
     */
    public String publicUrl(Long guestId, String storageKey) {
        if (guestId == null || storageKey == null || storageKey.isBlank()) return null;
        if (storageKey.startsWith("http://") || storageKey.startsWith("https://")) return storageKey;
        return "/api/guests/" + guestId + "/photo?ticket=" + mediaTicketService.mint(scopeFor(guestId));
    }
}
