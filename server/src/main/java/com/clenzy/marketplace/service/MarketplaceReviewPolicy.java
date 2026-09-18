package com.clenzy.marketplace.service;

import com.clenzy.marketplace.model.MarketplaceProvider;

/** Condition commune aux décisions sur une candidature et ses justificatifs. */
final class MarketplaceReviewPolicy {
    private MarketplaceReviewPolicy() {}

    static void requireConfirmedEmail(MarketplaceProvider provider) {
        if (!provider.isEmailConfirmed()) {
            throw new IllegalArgumentException(
                "L'adresse du candidat doit être confirmée avant l'examen du dossier ou de ses justificatifs.");
        }
    }
}
