package com.clenzy.repository;

import com.clenzy.model.MarketDataSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface MarketDataSnapshotRepository extends JpaRepository<MarketDataSnapshot, Long> {

    /** Idempotence de l'ingestion : rejouer le jour = remplacer la photo du jour pour la source. */
    @Modifying
    @Query("DELETE FROM MarketDataSnapshot s WHERE s.source = :source AND s.snapshotDate = :snapshotDate")
    int deleteBySourceAndSnapshotDate(@Param("source") String source,
                                      @Param("snapshotDate") LocalDate snapshotDate);

    /** Dernière photo d'une zone (consommateurs RMS) : benchmarks du snapshot le plus récent. */
    @Query("SELECT s FROM MarketDataSnapshot s WHERE s.area = :area "
            + "AND s.snapshotDate = (SELECT MAX(s2.snapshotDate) FROM MarketDataSnapshot s2 "
            + "WHERE s2.area = :area AND s2.source = s.source) ORDER BY s.stayMonth")
    List<MarketDataSnapshot> findLatestByArea(@Param("area") String area);
}
