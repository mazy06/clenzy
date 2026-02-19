package com.clenzy.integration.minut.repository;

import com.clenzy.integration.minut.model.MinutConnection;
import com.clenzy.integration.minut.model.MinutConnection.MinutConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MinutConnectionRepository extends JpaRepository<MinutConnection, Long> {

    Optional<MinutConnection> findByUserId(String userId);

    Optional<MinutConnection> findByMinutUserId(String minutUserId);

    List<MinutConnection> findByStatus(MinutConnectionStatus status);

    boolean existsByUserId(String userId);
}
