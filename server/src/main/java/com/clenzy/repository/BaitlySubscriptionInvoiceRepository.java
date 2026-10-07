package com.clenzy.repository;
import com.clenzy.model.BaitlySubscriptionInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface BaitlySubscriptionInvoiceRepository extends JpaRepository<BaitlySubscriptionInvoice,String> {
    List<BaitlySubscriptionInvoice> findByOrganizationIdOrderByIssuedAtDesc(Long organizationId);
}
