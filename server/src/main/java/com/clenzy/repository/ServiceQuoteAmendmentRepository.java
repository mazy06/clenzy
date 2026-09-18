package com.clenzy.repository;

import com.clenzy.model.ServiceQuoteAmendment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ServiceQuoteAmendmentRepository extends JpaRepository<ServiceQuoteAmendment, Long> {
    Optional<ServiceQuoteAmendment> findFirstByQuoteIdAndOrganizationIdAndStatusOrderByDecidedAtDescIdDesc(
            Long quoteId, Long organizationId, ServiceQuoteAmendment.Status status);
    List<ServiceQuoteAmendment> findByQuoteIdAndOrganizationIdOrderByCreatedAtDesc(Long quoteId, Long organizationId);
    List<ServiceQuoteAmendment> findByQuoteIdAndOrganizationIdAndStatus(Long quoteId, Long organizationId,
                                                                     ServiceQuoteAmendment.Status status);
    boolean existsByQuoteIdAndStatus(Long quoteId, ServiceQuoteAmendment.Status status);
}
