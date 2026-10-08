package com.clenzy.service.migration.api;

import com.clenzy.service.migration.PmsImportService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Pulls a source PMS through its API, then hands the result to the regular import draft. Credentials are
 * used for this call only: never persisted, logged or echoed. The HTTP work happens outside any database
 * transaction; only the draft creation is transactional.
 */
@Service
public class PmsApiImportService {
    private final PmsApiConnectors connectors;
    private final PmsImportService imports;

    public PmsApiImportService(PmsApiConnectors connectors, PmsImportService imports) {
        this.connectors = connectors; this.imports = imports;
    }

    public record PullRequest(String vendor, String account, Map<String, String> credentials, LocalDate from, LocalDate to) {
        @Override public String toString() { return "PullRequest[vendor=" + vendor + ", account=" + account + "]"; }
    }

    public List<PmsApiConnectors.Vendor> vendors() { return PmsApiConnectors.VENDORS; }

    public PmsImportService.View pull(PullRequest request, PmsImportService.Actor actor) {
        if (request == null || request.vendor() == null) throw new IllegalArgumentException("API_VENDOR_UNSUPPORTED");
        var pull = connectors.pull(request.vendor(), request.credentials(), request.from(), request.to());
        // The raw pages already live in the archive document; no second copy is stored.
        return imports.createDraft(pull.documents(), List.of(), request.vendor(), request.account(), actor);
    }
}
