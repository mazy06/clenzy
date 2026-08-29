package com.clenzy.repository;

import com.clenzy.model.ContactThreadParticipant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactThreadParticipantRepository extends JpaRepository<ContactThreadParticipant, Long> {

    List<ContactThreadParticipant> findByThreadId(Long threadId);

    List<ContactThreadParticipant> findByThreadIdIn(List<Long> threadIds);

    List<ContactThreadParticipant> findByKeycloakIdAndArchived(String keycloakId, boolean archived);

    Optional<ContactThreadParticipant> findByThreadIdAndKeycloakId(Long threadId, String keycloakId);

    boolean existsByThreadIdAndKeycloakId(Long threadId, String keycloakId);
}
