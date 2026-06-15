package com.clenzy.booking.dto;

import java.util.List;

/**
 * Question d'un voyageur au concierge IA du site public (2.13). {@code history} = tours récents
 * (rôle user/assistant) pour le suivi de conversation ; borné côté serveur.
 */
public record ConciergeRequestDto(String question, List<Turn> history) {
    public record Turn(String role, String content) {}
}
