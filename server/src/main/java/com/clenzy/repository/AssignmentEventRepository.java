package com.clenzy.repository;

import com.clenzy.model.AssignmentEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentEventRepository extends JpaRepository<AssignmentEvent, Long> {

    List<AssignmentEvent> findByServiceRequestIdOrderByCreatedAtDesc(Long serviceRequestId);
}
