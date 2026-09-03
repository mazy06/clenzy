package com.clenzy.dto;

/**
 * Un membre d'equipe, tel qu'il s'affiche dans le portefeuille.
 *
 * <p>L'ecran annoncait « 6 membres » sans pouvoir nommer personne : le DTO
 * d'equipe ne portait qu'un compte. On ne peut pas repondre « qui compose cette
 * equipe ? » avec un nombre, et c'est la question que l'utilisateur pose.</p>
 *
 * @param id       identifiant de l'utilisateur
 * @param fullName prenom et nom, deja dechiffres et concatenes
 * @param role     role DANS l'equipe (MEMBER, SUPERVISOR, MANAGER…), qui n'est
 *                 pas le role plateforme de la personne
 */
public record TeamMemberSummaryDto(Long id, String fullName, String role) {
}
