package com.clenzy.repository;

import com.clenzy.model.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;

public interface InterventionRepository extends JpaRepository<Intervention, Long>, JpaSpecificationExecutor<Intervention> {
    List<Intervention> findByAssignedTechnician(User technician);
    List<Intervention> findByProperty(Property property);
    List<Intervention> findByStatus(InterventionStatus status);
    List<Intervention> findByStartTimeBetween(LocalDateTime start, LocalDateTime end);
}


