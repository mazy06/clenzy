package com.clenzy.booking.dto;

/** Réponse du concierge IA (2.13). {@code available=false} = IA désactivée/budget atteint côté org. */
public record ConciergeAnswerDto(String answer, boolean available) {
    public static ConciergeAnswerDto unavailable() {
        return new ConciergeAnswerDto(
            "Le concierge n'est pas disponible pour le moment. Contactez l'hôte ou lancez une recherche de dates.",
            false);
    }
}
