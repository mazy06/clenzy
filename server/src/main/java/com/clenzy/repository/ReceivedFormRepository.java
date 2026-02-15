package com.clenzy.repository;

import com.clenzy.model.ReceivedForm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

@Repository
public interface ReceivedFormRepository extends JpaRepository<ReceivedForm, Long> {

    Page<ReceivedForm> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ReceivedForm> findByFormTypeOrderByCreatedAtDesc(String formType, Pageable pageable);

    long countByStatus(String status);

    long countByFormType(String formType);

    @Query("SELECT COUNT(f) FROM ReceivedForm f WHERE f.formType = ?1 AND f.status = ?2")
    long countByFormTypeAndStatus(String formType, String status);
}
