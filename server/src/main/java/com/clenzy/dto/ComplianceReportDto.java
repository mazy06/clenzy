package com.clenzy.dto;

import com.clenzy.model.TemplateComplianceReport;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/**
 * DTO pour un rapport de conformite de template.
 */
public record ComplianceReportDto(
        Long id,
        Long templateId,
        String templateName,
        String documentType,
        boolean compliant,
        LocalDateTime checkedAt,
        String checkedBy,
        List<String> missingTags,
        List<String> missingMentions,
        List<String> warnings,
        Integer score
) {
    public static ComplianceReportDto fromEntity(TemplateComplianceReport report,
                                                   String templateName, String documentType) {
        return new ComplianceReportDto(
                report.getId(),
                report.getTemplateId(),
                templateName,
                documentType,
                report.isCompliant(),
                report.getCheckedAt(),
                report.getCheckedBy(),
                parseList(report.getMissingTags()),
                parseList(report.getMissingMentions()),
                parseList(report.getWarnings()),
                report.getScore()
        );
    }

    private static List<String> parseList(String value) {
        if (value == null || value.isBlank()) return Collections.emptyList();
        String trimmed = value.trim();
        // Support JSON array format: ["a","b"] or plain CSV: a,b
        if (trimmed.startsWith("[")) {
            trimmed = trimmed.substring(1, trimmed.endsWith("]") ? trimmed.length() - 1 : trimmed.length());
            if (trimmed.isBlank()) return Collections.emptyList();
            return Arrays.stream(trimmed.split(","))
                    .map(s -> s.trim().replaceAll("^\"|\"$", ""))
                    .filter(s -> !s.isEmpty())
                    .toList();
        }
        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
