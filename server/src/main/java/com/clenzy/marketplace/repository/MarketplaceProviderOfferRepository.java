package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceProviderOffer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/** Prestations vendues par les professionnels. */
public interface MarketplaceProviderOfferRepository
        extends JpaRepository<MarketplaceProviderOffer, Long> {

    /**
     * Prestations actives de plusieurs professionnels, categorie chargee.
     *
     * <p>{@code JOIN FETCH} volontaire : la liste affiche les categories sur
     * chaque carte, et une categorie paresseuse produirait une requete par
     * prestation — le N+1 classique sur un ecran de catalogue.</p>
     */
    @Query("""
           SELECT o FROM MarketplaceProviderOffer o
           JOIN FETCH o.category c
           LEFT JOIN FETCH o.tariff t
           LEFT JOIN FETCH o.serviceItem i
           LEFT JOIN i.category ic
           WHERE o.provider.id IN :providerIds AND o.active = true AND (t.id IS NULL OR t.enabled = true) AND c.active = true
             AND (i.id IS NULL OR (i.active = true AND ic.code = c.code))
           ORDER BY c.sortOrder ASC, o.sortOrder ASC
           """)
    List<MarketplaceProviderOffer> findActiveByProviderIds(List<Long> providerIds);

    @Query("""
           SELECT o FROM MarketplaceProviderOffer o
           JOIN FETCH o.category c
           LEFT JOIN FETCH o.tariff t
           WHERE o.provider.id = :providerId
           ORDER BY c.sortOrder ASC, o.sortOrder ASC
           """)
    List<MarketplaceProviderOffer> findAllByProviderIdWithCategory(Long providerId);
}
