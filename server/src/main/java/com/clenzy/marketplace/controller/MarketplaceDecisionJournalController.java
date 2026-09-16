package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.service.MarketplaceDecisionJournal;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/marketplace/providers")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class MarketplaceDecisionJournalController {
    private final MarketplaceDecisionJournal journal;
    public MarketplaceDecisionJournalController(MarketplaceDecisionJournal journal) { this.journal=journal; }
    @GetMapping("/{id}/decisions")
    public Page<MarketplaceDecisionJournal.Decision> list(@PathVariable Long id,@RequestParam(defaultValue="0") int page) {
        return journal.list(id,page);
    }
}

