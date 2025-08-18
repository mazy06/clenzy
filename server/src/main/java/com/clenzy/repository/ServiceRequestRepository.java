package com.clenzy.repository;

import com.clenzy.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long>, JpaSpecificationExecutor<ServiceRequest> {
    List<ServiceRequest> findByUser(User user);
    List<ServiceRequest> findByProperty(Property property);
    List<ServiceRequest> findByStatusAndDesiredDateBetween(RequestStatus status, LocalDateTime start, LocalDateTime end);
}


