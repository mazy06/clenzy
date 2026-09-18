package com.clenzy.dto;

/**
 * Point d'ancrage des cartes pour l'utilisateur connecte : la ville de son
 * compte Baitly, resolue en coordonnees.
 *
 * <p>{@code city} est le nom REsolu par le geocodeur, pas la saisie brute du
 * compte : « marrakech » saisi a l'inscription revient « Marrakesh ». C'est ce
 * nom-la qui doit s'afficher si l'interface explique ou elle a centre la
 * carte, sous peine d'annoncer un lieu que le geocodeur n'a pas retenu.</p>
 */
public record HomeLocationDto(String city, double latitude, double longitude) {}
