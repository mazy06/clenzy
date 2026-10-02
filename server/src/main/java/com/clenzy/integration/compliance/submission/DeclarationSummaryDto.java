package com.clenzy.integration.compliance.submission;

/**
 * Vue <b>sans PII</b> d'une fiche de police / déclaration voyageur, destinée à
 * l'affichage du <em>statut de soumission</em> côté host (panneau réservation).
 *
 * <p>N'expose <b>aucun</b> champ d'identité ({@code firstName}, {@code idDocumentNumber}…) :
 * uniquement l'id technique, le rang (principal vs accompagnant), le statut du cycle de vie,
 * le provider cible et la traçabilité de transmission. Le libellé voyageur est <b>générique</b>
 * côté front (« Voyageur principal » / « Accompagnant n »).</p>
 *
 * <p>Mapping explicite depuis {@code GuestDeclaration} (jamais l'entité JPA exposée — audit
 * règle T-ARCH-07).</p>
 *
 * @param id                  id technique de la déclaration (cible du retry)
 * @param primary             true = voyageur principal du séjour ; false = accompagnant
 * @param status              statut du cycle de vie (PENDING / COMPLETED / SUBMITTED)
 * @param providerType        provider de déclaration cible (CHEKIN / POLICE_MA / ABSHER_KSA), null tant que non résolu
 * @param submittedAt         horodatage ISO de transmission au provider, null si non transmise
 * @param submittedToProvider true une fois transmise au provider
 * @param retainedLocally     fiche CONSERVÉE par l'exploitant, sans téléservice (France)
 * @param exempt              voyageur dispensé de fiche (ressortissant français en France)
 * @param purgeAfter          date ISO de purge obligatoire (6 mois après le départ), France
 */
public record DeclarationSummaryDto(
        Long id,
        boolean primary,
        String status,
        String providerType,
        String submittedAt,
        boolean submittedToProvider,
        boolean retainedLocally,
        boolean exempt,
        String purgeAfter
) {
    public DeclarationSummaryDto(Long id, boolean primary, String status, String providerType,
                                 String submittedAt, boolean submittedToProvider) {
        this(id, primary, status, providerType, submittedAt, submittedToProvider, false, false, null);
    }
}
