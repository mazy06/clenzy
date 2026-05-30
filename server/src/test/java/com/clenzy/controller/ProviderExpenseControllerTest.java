package com.clenzy.controller;

import com.clenzy.dto.CreateProviderExpenseRequest;
import com.clenzy.dto.ProviderExpenseDto;
import com.clenzy.model.ExpenseCategory;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.ProviderExpense;
import com.clenzy.service.ProviderExpenseService;
import com.clenzy.service.ReceiptStorageService;
import com.clenzy.tenant.TenantContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProviderExpenseControllerTest {

    @Mock private ProviderExpenseService expenseService;
    @Mock private ReceiptStorageService receiptStorage;
    @Mock private TenantContext tenantContext;

    private ProviderExpenseController controller;

    private static final Long ORG_ID = 1L;

    @BeforeEach
    void setUp() {
        controller = new ProviderExpenseController(expenseService, receiptStorage, tenantContext);
    }

    private ProviderExpense buildExpense(Long id, ExpenseStatus status) {
        ProviderExpense e = new ProviderExpense();
        e.setId(id);
        e.setOrganizationId(ORG_ID);
        e.setStatus(status);
        e.setAmountHt(BigDecimal.TEN);
        e.setTaxRate(BigDecimal.ZERO);
        e.setTaxAmount(BigDecimal.ZERO);
        e.setAmountTtc(BigDecimal.TEN);
        e.setCurrency("EUR");
        e.setExpenseDate(LocalDate.now());
        return e;
    }

    private CreateProviderExpenseRequest buildRequest() {
        return new CreateProviderExpenseRequest(
            1L, 2L, null, "Repair", new BigDecimal("50.00"), new BigDecimal("20"),
            ExpenseCategory.MAINTENANCE, LocalDate.now(), "INV-001", "notes");
    }

    @Nested
    @DisplayName("getAll")
    class GetAll {
        @Test
        void withNoFilter_returnsAll() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense e = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseService.getAll(ORG_ID)).thenReturn(List.of(e));

            List<ProviderExpenseDto> result = controller.getAll(null, null, null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).id()).isEqualTo(1L);
        }

        @Test
        void withProviderIdFilter_callsByProvider() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense e = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseService.getByProviderId(5L, ORG_ID)).thenReturn(List.of(e));

            List<ProviderExpenseDto> result = controller.getAll(5L, null, null);

            assertThat(result).hasSize(1);
            verify(expenseService).getByProviderId(5L, ORG_ID);
        }

        @Test
        void withStatusFilter_callsByStatus() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense e = buildExpense(1L, ExpenseStatus.APPROVED);
            when(expenseService.getByStatus(ExpenseStatus.APPROVED, ORG_ID))
                .thenReturn(List.of(e));

            List<ProviderExpenseDto> result = controller.getAll(null, null, ExpenseStatus.APPROVED);

            assertThat(result).hasSize(1);
            verify(expenseService).getByStatus(ExpenseStatus.APPROVED, ORG_ID);
        }
    }

    @Nested
    @DisplayName("getById")
    class GetById {
        @Test
        void returnsExpense() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(expenseService.getById(1L, ORG_ID)).thenReturn(buildExpense(1L, ExpenseStatus.DRAFT));

            ProviderExpenseDto result = controller.getById(1L);

            assertThat(result.id()).isEqualTo(1L);
        }
    }

    @Nested
    @DisplayName("create")
    class Create {
        @Test
        void createsExpense() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            CreateProviderExpenseRequest req = buildRequest();
            when(expenseService.create(req, ORG_ID)).thenReturn(buildExpense(99L, ExpenseStatus.DRAFT));

            ProviderExpenseDto result = controller.create(req);

            assertThat(result.id()).isEqualTo(99L);
        }
    }

    @Nested
    @DisplayName("update")
    class Update {
        @Test
        void updatesExpense() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            CreateProviderExpenseRequest req = buildRequest();
            when(expenseService.update(5L, req, ORG_ID))
                .thenReturn(buildExpense(5L, ExpenseStatus.DRAFT));

            ProviderExpenseDto result = controller.update(5L, req);

            assertThat(result.id()).isEqualTo(5L);
        }
    }

    @Nested
    @DisplayName("approve")
    class Approve {
        @Test
        void approves() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(expenseService.approve(5L, ORG_ID))
                .thenReturn(buildExpense(5L, ExpenseStatus.APPROVED));

            ProviderExpenseDto result = controller.approve(5L);

            assertThat(result.status()).isEqualTo(ExpenseStatus.APPROVED);
        }
    }

    @Nested
    @DisplayName("cancel")
    class Cancel {
        @Test
        void cancels() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(expenseService.cancel(5L, ORG_ID))
                .thenReturn(buildExpense(5L, ExpenseStatus.CANCELLED));

            ProviderExpenseDto result = controller.cancel(5L);

            assertThat(result.status()).isEqualTo(ExpenseStatus.CANCELLED);
        }
    }

    @Nested
    @DisplayName("markAsPaid")
    class MarkAsPaid {
        @Test
        void marksAsPaid() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(expenseService.markAsPaid(5L, "REF-1", ORG_ID))
                .thenReturn(buildExpense(5L, ExpenseStatus.PAID));

            ProviderExpenseDto result = controller.markAsPaid(5L, "REF-1");

            assertThat(result.status()).isEqualTo(ExpenseStatus.PAID);
        }

        @Test
        void marksAsPaidWithoutRef() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            when(expenseService.markAsPaid(eq(5L), eq(null), eq(ORG_ID)))
                .thenReturn(buildExpense(5L, ExpenseStatus.PAID));

            ProviderExpenseDto result = controller.markAsPaid(5L, null);

            assertThat(result.status()).isEqualTo(ExpenseStatus.PAID);
        }
    }

    @Nested
    @DisplayName("uploadReceipt")
    class UploadReceipt {
        @Test
        void uploadsNewReceipt() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);

            MultipartFile file = new MockMultipartFile("file", "receipt.pdf", "application/pdf", new byte[]{1, 2, 3});
            when(receiptStorage.store(ORG_ID, file)).thenReturn("path/abc_receipt.pdf");
            when(expenseService.attachReceipt(1L, "path/abc_receipt.pdf", ORG_ID))
                .thenReturn(existing);

            ProviderExpenseDto result = controller.uploadReceipt(1L, file);

            assertThat(result.id()).isEqualTo(1L);
            verify(receiptStorage, never()).delete(any()); // no old to delete
        }

        @Test
        void uploadsReceipt_deletesOldOne() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            existing.setReceiptPath("old/path");
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);

            MultipartFile file = new MockMultipartFile("file", "receipt.pdf", "application/pdf", new byte[]{1, 2, 3});
            when(receiptStorage.store(ORG_ID, file)).thenReturn("new/path");
            when(expenseService.attachReceipt(1L, "new/path", ORG_ID))
                .thenReturn(existing);

            controller.uploadReceipt(1L, file);

            verify(receiptStorage).delete("old/path");
        }
    }

    @Nested
    @DisplayName("downloadReceipt")
    class DownloadReceipt {
        @Test
        void whenReceiptExists_returnsResource() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            existing.setReceiptPath("path/abc12345-6789-1234-5678-123456789012_invoice.pdf");
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);

            Resource resource = new ByteArrayResource(new byte[]{1, 2, 3});
            when(receiptStorage.load("path/abc12345-6789-1234-5678-123456789012_invoice.pdf"))
                .thenReturn(resource);

            ResponseEntity<Resource> response = controller.downloadReceipt(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .contains("invoice.pdf");
        }

        @Test
        void whenNoReceipt_returns404() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);

            ResponseEntity<Resource> response = controller.downloadReceipt(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(404);
        }

        @Test
        void whenReceiptPathNoSlash_extractsCorrectly() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            existing.setReceiptPath("filewithnoslash_real-name.pdf");
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);
            when(receiptStorage.load(any())).thenReturn(new ByteArrayResource(new byte[]{}));

            ResponseEntity<Resource> response = controller.downloadReceipt(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
        }

        @Test
        void whenNoUnderscoreInName_usesFullName() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            existing.setReceiptPath("path/simple.pdf");
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);
            when(receiptStorage.load(any())).thenReturn(new ByteArrayResource(new byte[]{}));

            ResponseEntity<Resource> response = controller.downloadReceipt(1L);

            assertThat(response.getStatusCode().value()).isEqualTo(200);
            assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .contains("simple.pdf");
        }
    }

    @Nested
    @DisplayName("deleteReceipt")
    class DeleteReceipt {
        @Test
        void deletesReceiptFile() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            existing.setReceiptPath("path/file.pdf");
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);
            when(expenseService.removeReceipt(1L, ORG_ID)).thenReturn(existing);

            ProviderExpenseDto result = controller.deleteReceipt(1L);

            verify(receiptStorage).delete("path/file.pdf");
            assertThat(result.id()).isEqualTo(1L);
        }

        @Test
        void whenNoReceipt_skipsDelete() {
            when(tenantContext.getRequiredOrganizationId()).thenReturn(ORG_ID);
            ProviderExpense existing = buildExpense(1L, ExpenseStatus.DRAFT);
            when(expenseService.getById(1L, ORG_ID)).thenReturn(existing);
            when(expenseService.removeReceipt(1L, ORG_ID)).thenReturn(existing);

            controller.deleteReceipt(1L);

            verify(receiptStorage, never()).delete(any());
        }
    }
}
