package com.clenzy.marketplace.service;

import com.clenzy.repository.OrganizationRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Nom d'une organisation, pour les ecrans de la plateforme.
 *
 * <p>Extrait parce qu'une regle d'exposition qui n'afficherait qu'un numero
 * d'organisation serait illisible, donc jamais relue — et que l'alternative,
 * joindre la table des organisations depuis le service metier, lui donnerait une
 * dependance qu'il n'a aucune autre raison d'avoir.</p>
 */
@Component
public class OrganizationNameResolver {

    private final OrganizationRepository organizationRepository;

    public OrganizationNameResolver(OrganizationRepository organizationRepository) {
        this.organizationRepository = organizationRepository;
    }

    /** @return le nom, ou {@code null} si l'identifiant est vide ou inconnu */
    @Transactional(readOnly = true)
    public String nameOf(Long organizationId) {
        if (organizationId == null) {
            return null;
        }
        return organizationRepository.findById(organizationId)
            .map(org -> org.getName())
            .orElse(null);
    }
}
