package com.clenzy.marketplace.repository;
import com.clenzy.marketplace.model.BaitlyManagementContact;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.UUID;
public interface BaitlyManagementContactRepository extends JpaRepository<BaitlyManagementContact,UUID> {}
