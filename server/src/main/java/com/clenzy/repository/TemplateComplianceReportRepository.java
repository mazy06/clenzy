package com.clenzy.repository;

import com.clenzy.model.DocumentTemplate;
import com.clenzy.model.TemplateComplianceReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TemplateComplianceReportRepository extends JpaRepository<TemplateComplianceReport, Long> {

    Optional<TemplateComplianceReport> findTopByTemplateOrderByCheckedAtDesc(DocumentTemplate template);

    List<TemplateComplianceReport> findByTemplateOrderByCheckedAtDesc(DocumentTemplate template);

    @Query("SELECT MAX(r.checkedAt) FROM TemplateComplianceReport r")
    Optional<LocalDateTime> findMaxCheckedAt();

    @Query("SELECT COALESCE(AVG(r.score), 0) FROM TemplateComplianceReport r")
    int findAverageScore();
}
