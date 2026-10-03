package com.clenzy.service.migration;

import java.util.List;
import java.util.Map;

/** Source immuable. Les colonnes non associees restent dans rows et dans l'export. */
public record ImportDocument(String id, String name, List<String> columns,
                             List<Map<String, String>> rows, String attachmentBase64) {}
