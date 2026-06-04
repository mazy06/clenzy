package com.clenzy.integration.tuya.repository;

import com.clenzy.integration.tuya.model.TuyaAppAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TuyaAppAccountRepository extends JpaRepository<TuyaAppAccount, Long> {

    /** Le (seul) compte app Tuya d'un hote. */
    Optional<TuyaAppAccount> findByUserId(String userId);
}
