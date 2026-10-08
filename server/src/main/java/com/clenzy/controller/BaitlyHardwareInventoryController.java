package com.clenzy.controller;
import com.clenzy.model.BaitlyHardwareStock;
import com.clenzy.service.BaitlyHardwareInventory;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;

@RestController @RequestMapping("/api/shop/inventory") @PreAuthorize("hasRole('SUPER_ADMIN')")
public class BaitlyHardwareInventoryController {
    private final BaitlyHardwareInventory inventory;private final TenantContext tenant;
    public BaitlyHardwareInventoryController(BaitlyHardwareInventory inventory,TenantContext tenant){this.inventory=inventory;this.tenant=tenant;}
    public record Change(@NotBlank String country,@NotBlank String sku,@Min(0) int expected,int delta,@NotNull UUID requestId,@NotBlank @Size(max=255) String proof){}
    public record Return(@NotBlank @Size(max=255) String proof){}
    @GetMapping public List<BaitlyHardwareStock> list(@RequestParam String country){return inventory.list(country);}
    @PostMapping public BaitlyHardwareStock adjust(@RequestBody @Valid Change body,@AuthenticationPrincipal Jwt jwt){return inventory.adjust(body.country(),body.sku(),body.expected(),body.delta(),body.requestId(),body.proof(),jwt.getSubject());}
    @PostMapping("/returns/{id}") public void restock(@PathVariable Long id,@RequestBody @Valid Return body,@AuthenticationPrincipal Jwt jwt){inventory.returnToStock(tenant.getRequiredOrganizationId(),id,body.proof(),jwt.getSubject());}
}
