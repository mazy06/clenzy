package com.clenzy.dto;

/**
 * Resultat d'une fermeture en masse de l'inventaire RLS — plan REM-T-01.
 *
 * <p>{@code enAttente} n'est pas un detail d'affichage : les constats encore en memoire ne
 * sont pas couverts par la fermeture. Au prochain vidage, ceux qui portent sur un chemin
 * qu'on vient de fermer le rouvriront — et l'ecran les montrera « reapparus apres
 * correction », alors qu'ils n'ont fait qu'arriver en retard. Rapporter ce nombre permet a
 * l'appelant de dire ce qui vient de se passer plutot que de le laisser deviner.
 *
 * @param traites    chemins effectivement passes de ouvert a traite
 * @param enAttente  constats encore dans le tampon au moment de l'action
 */
public record RlsAuditBulkResolveDto(int traites, int enAttente) {}
