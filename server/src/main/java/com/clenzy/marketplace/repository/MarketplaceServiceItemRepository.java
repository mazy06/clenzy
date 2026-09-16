package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceServiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

/** Catalogue des prestations types. */
public interface MarketplaceServiceItemRepository extends JpaRepository<MarketplaceServiceItem, Long> {

    Optional<MarketplaceServiceItem> findByCode(String code);

    List<MarketplaceServiceItem> findByCodeIn(List<String> codes);

    /**
     * Catalogue actif, categorie chargee.
     *
     * <p>{@code JOIN FETCH} volontaire : l'appelant regroupe les prestations par
     * metier, et une categorie paresseuse produirait une requete par prestation
     * — deux cent dix requetes pour servir un referentiel.</p>
     */
    @Query("""
           SELECT i FROM MarketplaceServiceItem i
           JOIN FETCH i.category c
           WHERE i.active = true AND c.active = true
           ORDER BY c.sortOrder ASC, i.sortOrder ASC
           """)
    List<MarketplaceServiceItem> findAllActiveWithCategory();
}
