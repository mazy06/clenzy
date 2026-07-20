package com.clenzy.repository;

import com.clenzy.model.MarketDataConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MarketDataConnectionRepository extends JpaRepository<MarketDataConnection, Long> {

    Optional<MarketDataConnection> findByProvider(String provider);
}
