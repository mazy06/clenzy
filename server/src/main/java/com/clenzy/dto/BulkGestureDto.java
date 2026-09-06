package com.clenzy.dto;

import com.clenzy.dto.DashboardOperationsDto.ActionItemKind;

/**
 * Une nature de la file dont le geste s'applique à toute la rubrique.
 *
 * <p>C'est le serveur qui en tient la liste, pas l'écran : la décision « ce
 * geste est répétable sans dommage » appartient au gestionnaire qui le porte.
 * Un écran qui la dupliquerait finirait par proposer un bouton que le serveur
 * refuse — ou, pire, par ne plus le proposer là où il est devenu légitime.</p>
 *
 * @param kind   la nature concernée
 * @param action le nom du geste, celui qu'attend {@code /bulk}
 */
public record BulkGestureDto(ActionItemKind kind, String action) {}
