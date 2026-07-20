package com.clenzy.service.marketdata;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;

/**
 * Port fournisseur-agnostique des données de marché (roadmap market data).
 *
 * <p>Sépare le PORT de la SOURCE : les producteurs (first-party, open data,
 * Airbtics, AirROI) implémentent cette interface ; l'ingestion quotidienne les
 * interroge et persiste dans {@code market_data_snapshots} ; les consommateurs
 * RMS (benchmark, base price, dashboards) lisent la TABLE, jamais les providers
 * directement. Ajouter une source = un bean, zéro changement ailleurs — c'est ce
 * qui permet d'écrire l'adaptateur Airbtics aujourd'hui et de l'activer par
 * simple clé API le jour où le budget existe.</p>
 */
public interface MarketDataProvider {

    MarketDataProviderType type();

    /**
     * La source est-elle activable (clé API présente, dataset importé...) ?
     * Une source non configurée est simplement ignorée par l'ingestion — jamais
     * une erreur : le socle doit fonctionner à budget zéro.
     */
    boolean isConfigured();

    /**
     * Benchmarks de toutes les zones couvertes par la source sur la plage de mois
     * de séjour (bornes incluses). Les cellules sous le seuil de k-anonymat ne
     * doivent JAMAIS être retournées (responsabilité du provider, à la source).
     */
    List<MarketBenchmark> fetchBenchmarks(YearMonth fromInclusive, YearMonth toInclusive);

    /** Comps par listing — vide par défaut (seules les sources externes en produisent). */
    default List<MarketComp> fetchComps(Long propertyId, LocalDate from, LocalDate to) {
        return List.of();
    }
}
