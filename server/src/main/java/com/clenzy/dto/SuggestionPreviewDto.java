package com.clenzy.dto;

import java.util.List;

/**
 * Ce qui va partir, montre AVANT de partir.
 *
 * <p>Les cartes de la famille « relecture » envoient un texte a un voyageur, un
 * proprietaire ou un fournisseur. Le contenu etait compose au moment de l'envoi :
 * personne ne l'avait lu, et une fois parti il ne se rattrape pas.</p>
 *
 * @param channel      canal d'acheminement, en clair (« Email », « WhatsApp »)
 * @param recipients   destinataires resolus MAINTENANT, pas au moment du scan
 * @param subject      objet du message, quand il y en a un
 * @param body         texte reel, {@code null} quand il n'est composable qu'a
 *                     l'envoi — le champ {@code bodyRendered} le dit
 * @param bodyRendered {@code true} si {@code body} est le texte exact qui partira.
 *                     {@code false} = la modale montre les faits, pas la lettre :
 *                     mieux vaut l'avouer qu'afficher un texte approchant qui
 *                     donnerait une fausse assurance.
 * @param facts        elements determinants deja resolus (montant du, offre et
 *                     son prix, chiffres du mois...) : ce sur quoi l'operateur
 *                     doit se prononcer, meme quand le texte manque
 * @param blocked      raison pour laquelle l'envoi echouerait s'il partait
 *                     maintenant ({@code null} si rien ne s'y oppose). La carte
 *                     peut dater : le dire ici evite un refus a la validation.
 */
public record SuggestionPreviewDto(String channel,
                                   List<String> recipients,
                                   String subject,
                                   String body,
                                   boolean bodyRendered,
                                   List<String> facts,
                                   String blocked,
                                   List<PreviewOption> options) {

    /**
     * Candidat entre lesquels l'operateur doit trancher.
     *
     * <p>Certaines cartes choisissaient SEULES : laquelle des deux reservations
     * annuler, quel devis retenir, vers quel logement reloger. Le motif de la
     * carte exposait le raisonnement, mais le bouton n'offrait que de l'entériner.</p>
     *
     * @param paramName   cle d'action que ce choix renseigne (ex. {@code quoteId})
     * @param value       valeur envoyee au serveur si ce candidat est retenu
     * @param label       intitule du candidat
     * @param detail      ce qui permet de comparer (montant, dates, prestataire)
     * @param recommended candidat que l'agent proposait — un point de depart,
     *                    pas une contrainte
     */
    public record PreviewOption(String paramName,
                                Object value,
                                String label,
                                String detail,
                                boolean recommended) {}

    /** Apercu sans choix a faire — le cas de la famille « relecture ». */
    public SuggestionPreviewDto(String channel, List<String> recipients, String subject,
                                String body, boolean bodyRendered, List<String> facts,
                                String blocked) {
        this(channel, recipients, subject, body, bodyRendered, facts, blocked, List.of());
    }

    /**
     * Apercu impossible a produire.
     *
     * <p>La raison va dans {@code facts}, PAS dans {@code blocked} : ne pas
     * savoir montrer ce qui part n'est pas la meme chose que savoir que l'envoi
     * echouera. Confondre les deux interdirait une action parfaitement legitime.</p>
     */
    public static SuggestionPreviewDto unavailable(String reason) {
        return new SuggestionPreviewDto(null, List.of(), null, null, false, List.of(reason), null);
    }
}
