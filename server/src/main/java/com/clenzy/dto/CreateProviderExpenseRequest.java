package com.clenzy.dto;

import com.clenzy.model.ExpenseCategory;

import java.math.BigDecimal;
import java.time.LocalDate;

public record CreateProviderExpenseRequest(
        Long providerId,
        Long propertyId,
        Long interventionId,
        String description,
        BigDecimal amountHt,
        BigDecimal taxRate,
        ExpenseCategory category,
        LocalDate expenseDate,
        String invoiceReference,
        String notes
) {}
