package com.clenzy.model;

/**
 * Reponse de l'intervenant a une mission qui lui est assignee.
 *
 * <p>Jusqu'ici l'assignation etait un fait accompli : un gestionnaire designait
 * quelqu'un, et la mission apparaissait dans sa liste sans qu'il puisse dire
 * qu'il ne sera pas la. Cet enum ouvre la reponse.</p>
 *
 * <p><b>{@code null} vaut « pas de reponse attendue »</b> — c'est l'etat des
 * interventions creees avant cette fonctionnalite, et elles restent
 * exploitables telles quelles. Seules les assignations posterieures naissent en
 * {@link #PENDING}.</p>
 *
 * <p>Demarrer une mission VAUT l'accepter : l'intervenant qui se met au travail
 * n'a pas a confirmer d'abord. Sans cette regle, l'ajout du champ aurait bloque
 * tous les parcours existants.</p>
 */
public enum InterventionAssignmentResponse {
    /** Proposee, sans reponse encore. */
    PENDING,
    /** Acceptee — explicitement, ou implicitement en demarrant. */
    ACCEPTED,
    /** Refusee : la mission est desassignee et repart au gestionnaire. */
    DECLINED
}
