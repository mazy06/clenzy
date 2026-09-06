package com.clenzy.dto;

import java.util.List;

/**
 * Ce qu'un geste de masse a réellement fait.
 *
 * <p>Un lot ne réussit pas « en bloc » : le fournisseur peut refuser le
 * quatorzième envoi et accepter les autres. Annoncer « c'est fait » couvrirait
 * ces échecs, et l'utilisateur ne les découvrirait qu'au balayage suivant, sans
 * savoir lesquels. Le décompte est donc rendu ligne par ligne.</p>
 *
 * @param requested lignes effectivement tentées — le lot est plafonné
 * @param succeeded gestes qui ont abouti
 * @param failed    gestes qui ont échoué ; le détail est dans {@code failures}
 * @param remaining lignes de cette nature encore ouvertes après le lot, à
 *                  relancer par un second appel
 * @param failures  les échecs, avec de quoi les retrouver dans la file
 */
public record BulkGestureResultDto(int requested,
                                   int succeeded,
                                   int failed,
                                   long remaining,
                                   List<Failure> failures) {

    /**
     * Un échec du lot.
     *
     * @param actionItemId la ligne de la file, pour la rouvrir individuellement
     * @param title        son libellé, pour la nommer sans avoir à la recharger
     * @param reason       la raison, en clair, quand elle est destinée à être lue
     */
    public record Failure(Long actionItemId, String title, String reason) {}
}
