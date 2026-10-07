package com.clenzy.controller;
import com.clenzy.model.BaitlyCommerceOperation;
import com.clenzy.service.BaitlyCommerceOperations;
import com.clenzy.tenant.TenantContext;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;

@RestController @RequestMapping("/api/commerce/operations")
@PreAuthorize("hasAnyRole('HOST','SUPER_ADMIN','SUPER_MANAGER')")
public class BaitlyCommerceOperationController {
    private final BaitlyCommerceOperations operations;private final TenantContext tenant;
    public BaitlyCommerceOperationController(BaitlyCommerceOperations operations,TenantContext tenant){this.operations=operations;this.tenant=tenant;}
    public record Request(@NotBlank String source,@NotNull Long sourceId,@NotNull UUID requestId,@NotBlank String action,@NotBlank @Size(max=255) String proof,@NotNull @Size(max=1000) String note){}
    @GetMapping public List<BaitlyCommerceOperation> history(@RequestParam String source,@RequestParam Long sourceId){return operations.history(tenant.getRequiredOrganizationId(),source,sourceId);}
    @PostMapping @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public BaitlyCommerceOperation record(@RequestBody @Valid Request body,@AuthenticationPrincipal Jwt jwt){return operations.record(tenant.getRequiredOrganizationId(),body.source(),body.sourceId(),body.requestId(),body.action(),body.proof(),body.note(),jwt.getSubject());}
}
