package com.clenzy.marketplace.repository;

import com.clenzy.marketplace.model.MarketplaceServiceCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Referentiel des categories de services de la place de marche. */
public interface MarketplaceServiceCategoryRepository
        extends JpaRepository<MarketplaceServiceCategory, Long> {

    Optional<MarketplaceServiceCategory> findByCode(String code);

    List<MarketplaceServiceCategory> findByActiveTrueOrderBySortOrderAsc();

    List<MarketplaceServiceCategory> findByCodeIn(List<String> codes);
}
