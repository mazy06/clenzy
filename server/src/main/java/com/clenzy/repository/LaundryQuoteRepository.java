package com.clenzy.repository;

import com.clenzy.model.LaundryQuote;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LaundryQuoteRepository extends JpaRepository<LaundryQuote, Long> {

    List<LaundryQuote> findByPropertyIdOrderByGeneratedAtDesc(Long propertyId, Pageable pageable);

    Optional<LaundryQuote> findByPropertyIdAndId(Long propertyId, Long id);
}
