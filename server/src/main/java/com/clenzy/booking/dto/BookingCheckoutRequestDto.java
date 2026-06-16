package com.clenzy.booking.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Requete pour creer une Stripe Checkout Session a partir d'un code de reservation.
 *
 * <p>{@code returnUrl} (B3) est OPTIONNEL : URL absolue de la page de confirmation du template
 * (resolue cote client depuis {@code data-clenzy-return}), utilisee comme {@code success_url} Stripe.
 * Elle est SOUMISE a une validation stricte cote serveur (HTTPS + host appartenant aux origines
 * autorisees de l'org) ; toute valeur non conforme est IGNOREE et le {@code success_url} par defaut
 * s'applique — jamais de redirection vers un host arbitraire fourni par le client (anti open-redirect).</p>
 */
public record BookingCheckoutRequestDto(
    @NotBlank(message = "reservationCode est obligatoire")
    String reservationCode,

    String returnUrl
) {}
