package com.clenzy.repository;

import com.clenzy.model.ReceivedForm;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ReceivedFormRepository extends JpaRepository<ReceivedForm, Long> {

    Page<ReceivedForm> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<ReceivedForm> findByFormTypeOrderByCreatedAtDesc(String formType, Pageable pageable);

    // Liste active (exclut les archivés) — avec ou sans filtre de type.
    Page<ReceivedForm> findByStatusNotOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<ReceivedForm> findByFormTypeAndStatusNotOrderByCreatedAtDesc(String formType, String status, Pageable pageable);

    // Liste d'un statut précis (ex. archivés) — avec ou sans filtre de type.
    Page<ReceivedForm> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    Page<ReceivedForm> findByFormTypeAndStatusOrderByCreatedAtDesc(String formType, String status, Pageable pageable);

    long countByStatus(String status);

    long countByFormType(String formType);

    @Query("SELECT COUNT(f) FROM ReceivedForm f WHERE f.formType = :formType AND f.status = :status AND f.organizationId = :orgId")
    long countByFormTypeAndStatus(@Param("formType") String formType, @Param("status") String status, @Param("orgId") Long orgId);
}
