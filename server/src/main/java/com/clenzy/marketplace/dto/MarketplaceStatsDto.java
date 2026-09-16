package com.clenzy.marketplace.dto;

/**
 * Compteurs de tete d'ecran.
 *
 * <p>{@code complianceAlerts} compte les fiches dont une piece est expiree ou
 * expire sous trente jours. Une piece ABSENTE n'y entre pas : beaucoup de
 * professionnels n'ont pas encore depose leur dossier, et les compter comme non
 * conformes noierait les vraies alertes.</p>
 *
 * <p>{@code importableUsers} compte les comptes prestataires de la plateforme
 * qui n'ont pas encore de fiche. C'est ce qui permet a l'ecran de dire qu'il
 * manque du monde au catalogue, au lieu d'afficher une liste vide sans
 * expliquer pourquoi.</p>
 */
public record MarketplaceStatsDto(
    long total,
    long pendingReview,
    long active,
    long suspended,
    long rejected,
    long archived,
    long independent,
    long affiliated,
    long exclusive,
    long complianceAlerts,
    long importableUsers
) {}
