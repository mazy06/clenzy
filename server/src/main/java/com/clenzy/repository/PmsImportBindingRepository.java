package com.clenzy.repository;

import com.clenzy.model.PmsImportBinding;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface PmsImportBindingRepository extends JpaRepository<PmsImportBinding, Long> {
    List<PmsImportBinding> findByOrganizationIdAndSourceKeyIn(Long organizationId, Collection<String> keys);
}
