package com.clenzy.repository;

import com.clenzy.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long>, JpaSpecificationExecutor<ServiceRequest> {
    List<ServiceRequest> findByUser(User user);
    List<ServiceRequest> findByProperty(Property property);
    List<ServiceRequest> findByStatusAndDesiredDateBetween(RequestStatus status, LocalDateTime start, LocalDateTime end);
    
    /**
     * Charge toutes les demandes de service avec leurs relations property et user
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user")
    List<ServiceRequest> findAllWithRelations();
    
    /**
     * Charge les demandes de service avec pagination et relations
     */
    @Query("SELECT sr FROM ServiceRequest sr LEFT JOIN FETCH sr.property LEFT JOIN FETCH sr.user")
    List<ServiceRequest> findAllWithRelationsPageable();
}


