package com.clenzy.service.migration;

import java.util.Map;

/** Per-file mappings: canonical field -> original column; source property reference -> Baitly ID. */
public record ImportPlan(String documentId, Kind kind, Map<String, String> fields,
                         Map<String, String> defaults, Map<String, Long> propertyLinks,
                         String dateFormat, String decimalSeparator) {
    public enum Kind { PROPERTY, GUEST, RESERVATION, ARCHIVE }
}
