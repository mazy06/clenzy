package com.clenzy.controller;

import com.clenzy.dto.CreateProviderExpenseRequest;
import com.clenzy.dto.ProviderExpenseDto;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.ProviderExpense;
import com.clenzy.service.ProviderExpenseService;
import com.clenzy.service.ReceiptStorageService;
import com.clenzy.tenant.TenantContext;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/provider-expenses")
@PreAuthorize("isAuthenticated()")
public class ProviderExpenseController {

    private final ProviderExpenseService expenseService;
    private final ReceiptStorageService receiptStorage;
    private final TenantContext tenantContext;
    private final com.clenzy.service.BaitlyExpenseViews views;

    public ProviderExpenseController(ProviderExpenseService expenseService,
                                     ReceiptStorageService receiptStorage,
                                     TenantContext tenantContext, com.clenzy.service.BaitlyExpenseViews views) {
        this.expenseService = expenseService;
        this.receiptStorage = receiptStorage;
        this.tenantContext = tenantContext;
        this.views = views;
    }

    @GetMapping
    public List<ProviderExpenseDto> getAll(
            @RequestParam(required = false) Long providerId,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) ExpenseStatus status,
            @RequestParam(required = false, defaultValue = "false") boolean mine,
            @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        return views.visible(jwt.getSubject(), orgId, providerId, propertyId, status, mine);
    }

    @GetMapping("/{id}")
    public ProviderExpenseDto getById(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return views.readable(id, orgId, jwt.getSubject());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    @ResponseStatus(HttpStatus.CREATED)
    public ProviderExpenseDto create(@RequestBody CreateProviderExpenseRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return views.create(request, orgId);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto update(@PathVariable Long id,
                                     @RequestBody CreateProviderExpenseRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return views.update(id, request, orgId);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto approve(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return views.approve(id, orgId);
    }

    @PostMapping("/{id}/cancel")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto cancel(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return views.cancel(id, orgId);
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto markAsPaid(@PathVariable Long id,
                                         @RequestParam(required = false) String paymentReference) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.markAsPaid(id, paymentReference, orgId));
    }

    // ── Receipt endpoints ────────────────────────────────────────────────────

    @PostMapping(value = "/{id}/receipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto uploadReceipt(@PathVariable Long id,
                                            @RequestParam("file") MultipartFile file) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Supprimer l'ancien justificatif s'il existe
        ProviderExpense expense = expenseService.getById(id, orgId);
        if (expense.getReceiptPath() != null) {
            receiptStorage.delete(expense.getReceiptPath());
        }

        String storagePath = receiptStorage.store(orgId, file);
        return views.attachReceipt(id, storagePath, orgId);
    }

    @GetMapping("/{id}/receipt")
    public ResponseEntity<Resource> downloadReceipt(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ProviderExpense expense = expenseService.getReadable(id, orgId, jwt.getSubject());

        if (expense.getReceiptPath() == null) {
            return ResponseEntity.notFound().build();
        }

        Resource resource = receiptStorage.load(expense.getReceiptPath());
        String filename = extractFilename(expense.getReceiptPath());

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(resource);
    }

    @DeleteMapping("/{id}/receipt")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','SUPER_MANAGER')")
    public ProviderExpenseDto deleteReceipt(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ProviderExpense expense = expenseService.getById(id, orgId);

        if (expense.getReceiptPath() != null) {
            receiptStorage.delete(expense.getReceiptPath());
        }

        return views.removeReceipt(id, orgId);
    }

    private String extractFilename(String storagePath) {
        int lastSlash = storagePath.lastIndexOf('/');
        String diskName = lastSlash >= 0 ? storagePath.substring(lastSlash + 1) : storagePath;
        // Remove UUID prefix (36 chars + underscore)
        int underscoreIdx = diskName.indexOf('_');
        return underscoreIdx > 0 ? diskName.substring(underscoreIdx + 1) : diskName;
    }
}
