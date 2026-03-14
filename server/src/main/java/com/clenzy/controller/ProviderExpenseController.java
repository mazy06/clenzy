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

    public ProviderExpenseController(ProviderExpenseService expenseService,
                                     ReceiptStorageService receiptStorage,
                                     TenantContext tenantContext) {
        this.expenseService = expenseService;
        this.receiptStorage = receiptStorage;
        this.tenantContext = tenantContext;
    }

    @GetMapping
    public List<ProviderExpenseDto> getAll(
            @RequestParam(required = false) Long providerId,
            @RequestParam(required = false) Long propertyId,
            @RequestParam(required = false) ExpenseStatus status) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        if (providerId != null) {
            return expenseService.getByProviderId(providerId, orgId).stream()
                    .map(ProviderExpenseDto::from).toList();
        }
        if (status != null) {
            return expenseService.getByStatus(status, orgId).stream()
                    .map(ProviderExpenseDto::from).toList();
        }
        return expenseService.getAll(orgId).stream()
                .map(ProviderExpenseDto::from).toList();
    }

    @GetMapping("/{id}")
    public ProviderExpenseDto getById(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.getById(id, orgId));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProviderExpenseDto create(@RequestBody CreateProviderExpenseRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.create(request, orgId));
    }

    @PutMapping("/{id}")
    public ProviderExpenseDto update(@PathVariable Long id,
                                     @RequestBody CreateProviderExpenseRequest request) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.update(id, request, orgId));
    }

    @PostMapping("/{id}/approve")
    public ProviderExpenseDto approve(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.approve(id, orgId));
    }

    @PostMapping("/{id}/cancel")
    public ProviderExpenseDto cancel(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.cancel(id, orgId));
    }

    @PostMapping("/{id}/pay")
    public ProviderExpenseDto markAsPaid(@PathVariable Long id,
                                         @RequestParam(required = false) String paymentReference) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        return ProviderExpenseDto.from(expenseService.markAsPaid(id, paymentReference, orgId));
    }

    // ── Receipt endpoints ────────────────────────────────────────────────────

    @PostMapping(value = "/{id}/receipt", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProviderExpenseDto uploadReceipt(@PathVariable Long id,
                                            @RequestParam("file") MultipartFile file) {
        Long orgId = tenantContext.getRequiredOrganizationId();

        // Supprimer l'ancien justificatif s'il existe
        ProviderExpense expense = expenseService.getById(id, orgId);
        if (expense.getReceiptPath() != null) {
            receiptStorage.delete(expense.getReceiptPath());
        }

        String storagePath = receiptStorage.store(orgId, file);
        return ProviderExpenseDto.from(expenseService.attachReceipt(id, storagePath, orgId));
    }

    @GetMapping("/{id}/receipt")
    public ResponseEntity<Resource> downloadReceipt(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ProviderExpense expense = expenseService.getById(id, orgId);

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
    public ProviderExpenseDto deleteReceipt(@PathVariable Long id) {
        Long orgId = tenantContext.getRequiredOrganizationId();
        ProviderExpense expense = expenseService.getById(id, orgId);

        if (expense.getReceiptPath() != null) {
            receiptStorage.delete(expense.getReceiptPath());
        }

        return ProviderExpenseDto.from(expenseService.removeReceipt(id, orgId));
    }

    private String extractFilename(String storagePath) {
        int lastSlash = storagePath.lastIndexOf('/');
        String diskName = lastSlash >= 0 ? storagePath.substring(lastSlash + 1) : storagePath;
        // Remove UUID prefix (36 chars + underscore)
        int underscoreIdx = diskName.indexOf('_');
        return underscoreIdx > 0 ? diskName.substring(underscoreIdx + 1) : diskName;
    }
}
