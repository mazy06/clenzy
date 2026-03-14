package com.clenzy.dto;

import com.clenzy.model.ExpenseCategory;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.ProviderExpense;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

public record ProviderExpenseDto(
        Long id,
        Long providerId,
        String providerName,
        Long propertyId,
        String propertyName,
        Long interventionId,
        Long ownerPayoutId,
        String description,
        BigDecimal amountHt,
        BigDecimal taxRate,
        BigDecimal taxAmount,
        BigDecimal amountTtc,
        String currency,
        ExpenseCategory category,
        LocalDate expenseDate,
        ExpenseStatus status,
        String invoiceReference,
        String receiptPath,
        String notes,
        String paymentReference,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProviderExpenseDto from(ProviderExpense e) {
        return new ProviderExpenseDto(
                e.getId(),
                e.getProvider() != null ? e.getProvider().getId() : null,
                e.getProvider() != null ? e.getProvider().getFullName() : null,
                e.getProperty() != null ? e.getProperty().getId() : null,
                e.getProperty() != null ? e.getProperty().getName() : null,
                e.getIntervention() != null ? e.getIntervention().getId() : null,
                e.getOwnerPayout() != null ? e.getOwnerPayout().getId() : null,
                e.getDescription(),
                e.getAmountHt(),
                e.getTaxRate(),
                e.getTaxAmount(),
                e.getAmountTtc(),
                e.getCurrency(),
                e.getCategory(),
                e.getExpenseDate(),
                e.getStatus(),
                e.getInvoiceReference(),
                e.getReceiptPath(),
                e.getNotes(),
                e.getPaymentReference(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
