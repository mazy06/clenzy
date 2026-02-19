package com.clenzy.integration.tuya.repository;

import com.clenzy.integration.tuya.model.TuyaConnection;
import com.clenzy.integration.tuya.model.TuyaConnection.TuyaConnectionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TuyaConnectionRepository extends JpaRepository<TuyaConnection, Long> {

    Optional<TuyaConnection> findByUserId(String userId);

    Optional<TuyaConnection> findByTuyaUid(String tuyaUid);

    List<TuyaConnection> findByStatus(TuyaConnectionStatus status);

    boolean existsByUserId(String userId);
}
