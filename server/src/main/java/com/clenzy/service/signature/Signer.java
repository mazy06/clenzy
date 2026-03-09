package com.clenzy.service.signature;

/**
 * Signataire d'un document.
 *
 * @param email adresse email du signataire
 * @param name  nom complet du signataire
 * @param role  role dans la signature (ex: "owner", "tenant", "witness")
 * @param order ordre de signature (1 = premier signataire)
 */
public record Signer(
    String email,
    String name,
    String role,
    int order
) {}
