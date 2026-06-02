package com.clenzy.repository;

import com.clenzy.model.WaitlistSignup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WaitlistSignupRepository extends JpaRepository<WaitlistSignup, Long> {

    Optional<WaitlistSignup> findByEmailIgnoreCase(String email);

    /** Liste ordonnée par date d'arrivée (export admin + classement « 20 premiers »). */
    List<WaitlistSignup> findAllByOrderByCreatedAtAsc();

    /** Rang d'un inscrit = nombre d'inscriptions dont l'id est ≤ au sien (ordre d'arrivée). */
    @Query("SELECT COUNT(w) FROM WaitlistSignup w WHERE w.id <= :id")
    long positionOf(@Param("id") Long id);
}
