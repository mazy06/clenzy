package com.clenzy.marketplace.controller;

import com.clenzy.marketplace.dto.ProviderDetailDto;
import com.clenzy.marketplace.service.*;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/marketplace/providers")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyProviderEditingController {
    private final BaitlyProviderEditing editing;
    private final MarketplaceCatalogService catalog;
    public BaitlyProviderEditingController(BaitlyProviderEditing editing, MarketplaceCatalogService catalog) {
        this.editing=editing; this.catalog=catalog;
    }
    @PutMapping("/{id}/profile")
    public ProviderDetailDto update(@PathVariable Long id, @Valid @RequestBody BaitlyProviderEditing.Command command,
            @AuthenticationPrincipal Jwt jwt) {
        editing.update(id,command,jwt.getSubject());
        return catalog.getDetail(id).orElseThrow();
    }
}
