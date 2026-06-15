package com.clenzy.booking.dto;

/**
 * Rattachement d'un filleul à un parrain (2.11) : le widget l'envoie après une réservation directe
 * quand un code de parrainage a été capté ({@code ?ref=}). Org explicite (le filleul peut ne pas
 * être connecté) ; la réservation valide l'identité du filleul côté serveur.
 */
public record ReferralClaimRequestDto(Long organizationId, String reservationCode, String referralCode) {
}
