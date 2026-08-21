package com.clenzy.repository;

import com.clenzy.model.ContactThread;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ContactThreadRepository extends JpaRepository<ContactThread, Long> {

    /** Le fil deja ouvert pour cet objet metier, s'il existe. */
    Optional<ContactThread> findByOrganizationIdAndReferenceTypeAndReferenceId(
            Long organizationId, String referenceType, Long referenceId);

    List<ContactThread> findByIdInOrderByLastMessageAtDesc(List<Long> ids);
}
