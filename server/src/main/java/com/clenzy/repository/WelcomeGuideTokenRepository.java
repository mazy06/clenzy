package com.clenzy.repository;

import com.clenzy.model.WelcomeGuideToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface WelcomeGuideTokenRepository extends JpaRepository<WelcomeGuideToken, Long> {

    Optional<WelcomeGuideToken> findByToken(UUID token);
}
