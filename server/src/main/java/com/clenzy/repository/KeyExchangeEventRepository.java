package com.clenzy.repository;

import com.clenzy.model.KeyExchangeEvent;
import com.clenzy.model.KeyExchangeEvent.EventType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KeyExchangeEventRepository extends JpaRepository<KeyExchangeEvent, Long> {

    Page<KeyExchangeEvent> findByPropertyIdOrderByCreatedAtDesc(Long propertyId, Pageable pageable);

    Page<KeyExchangeEvent> findByPropertyIdAndEventTypeOrderByCreatedAtDesc(Long propertyId, EventType eventType, Pageable pageable);

    /** All events across all properties (org-scoped by Hibernate filter) */
    Page<KeyExchangeEvent> findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<KeyExchangeEvent> findByCodeId(Long codeId);

    List<KeyExchangeEvent> findByPointId(Long pointId);
}
