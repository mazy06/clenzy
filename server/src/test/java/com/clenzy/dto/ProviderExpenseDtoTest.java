package com.clenzy.dto;

import com.clenzy.model.ExpenseCategory;
import com.clenzy.model.ExpenseStatus;
import com.clenzy.model.Intervention;
import com.clenzy.model.OwnerPayout;
import com.clenzy.model.Property;
import com.clenzy.model.ProviderExpense;
import com.clenzy.model.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class ProviderExpenseDtoTest {

    @Test
    void recordAccessors_returnAllConstructorValues() {
        LocalDate expenseDate = LocalDate.of(2026, 1, 15);
        ProviderExpenseDto dto = new ProviderExpenseDto(
                1L, 10L, "John Doe", 20L, "My Property",
                30L, 40L, "Reparation plomberie",
                new BigDecimal("100.00"), new BigDecimal("0.20"), new BigDecimal("20.00"),
                new BigDecimal("120.00"), "EUR",
                ExpenseCategory.MAINTENANCE, expenseDate,
                ExpenseStatus.APPROVED, "INV-001", "/receipts/1.pdf",
                "Internal notes", "PAY-REF",
                null, null
        );

        assertEquals(1L, dto.id());
        assertEquals(10L, dto.providerId());
        assertEquals("John Doe", dto.providerName());
        assertEquals(20L, dto.propertyId());
        assertEquals("My Property", dto.propertyName());
        assertEquals(30L, dto.interventionId());
        assertEquals(40L, dto.ownerPayoutId());
        assertEquals("Reparation plomberie", dto.description());
        assertEquals(new BigDecimal("100.00"), dto.amountHt());
        assertEquals(new BigDecimal("0.20"), dto.taxRate());
        assertEquals(new BigDecimal("20.00"), dto.taxAmount());
        assertEquals(new BigDecimal("120.00"), dto.amountTtc());
        assertEquals("EUR", dto.currency());
        assertEquals(ExpenseCategory.MAINTENANCE, dto.category());
        assertEquals(expenseDate, dto.expenseDate());
        assertEquals(ExpenseStatus.APPROVED, dto.status());
        assertEquals("INV-001", dto.invoiceReference());
        assertEquals("/receipts/1.pdf", dto.receiptPath());
        assertEquals("Internal notes", dto.notes());
        assertEquals("PAY-REF", dto.paymentReference());
        assertNull(dto.createdAt());
        assertNull(dto.updatedAt());
    }

    @Test
    void from_fullEntity_mapsAllScalarFieldsAndRelations() {
        ProviderExpense entity = buildFullEntity();

        ProviderExpenseDto dto = ProviderExpenseDto.from(entity);

        assertEquals(5L, dto.id());
        assertEquals(50L, dto.providerId());
        assertEquals("Jean Dupont", dto.providerName());
        assertEquals(60L, dto.propertyId());
        assertEquals("Appartement Test", dto.propertyName());
        assertEquals(70L, dto.interventionId());
        assertEquals(80L, dto.ownerPayoutId());
        assertEquals("Description", dto.description());
        assertEquals(new BigDecimal("200.00"), dto.amountHt());
        assertEquals(new BigDecimal("0.10"), dto.taxRate());
        assertEquals(new BigDecimal("20.00"), dto.taxAmount());
        assertEquals(new BigDecimal("220.00"), dto.amountTtc());
        assertEquals("EUR", dto.currency());
        assertEquals(ExpenseCategory.CLEANING, dto.category());
        assertEquals(LocalDate.of(2026, 2, 1), dto.expenseDate());
        assertEquals(ExpenseStatus.PAID, dto.status());
        assertEquals("INV-2", dto.invoiceReference());
        assertEquals("/r.pdf", dto.receiptPath());
        assertEquals("notes", dto.notes());
        assertEquals("ref-2", dto.paymentReference());
    }

    @Test
    void from_nullProvider_providerIdAndNameAreNull() {
        ProviderExpense entity = buildFullEntity();
        entity.setProvider(null);

        ProviderExpenseDto dto = ProviderExpenseDto.from(entity);

        assertNull(dto.providerId());
        assertNull(dto.providerName());
    }

    @Test
    void from_nullProperty_propertyIdAndNameAreNull() {
        ProviderExpense entity = buildFullEntity();
        entity.setProperty(null);

        ProviderExpenseDto dto = ProviderExpenseDto.from(entity);

        assertNull(dto.propertyId());
        assertNull(dto.propertyName());
    }

    @Test
    void from_nullIntervention_interventionIdIsNull() {
        ProviderExpense entity = buildFullEntity();
        entity.setIntervention(null);

        ProviderExpenseDto dto = ProviderExpenseDto.from(entity);
        assertNull(dto.interventionId());
    }

    @Test
    void from_nullOwnerPayout_payoutIdIsNull() {
        ProviderExpense entity = buildFullEntity();
        entity.setOwnerPayout(null);

        ProviderExpenseDto dto = ProviderExpenseDto.from(entity);
        assertNull(dto.ownerPayoutId());
    }

    // --- Helpers ---

    private ProviderExpense buildFullEntity() {
        ProviderExpense e = new ProviderExpense();
        e.setId(5L);
        User provider = new User();
        provider.setId(50L);
        provider.setFirstName("Jean");
        provider.setLastName("Dupont");
        e.setProvider(provider);

        Property property = new Property();
        property.setId(60L);
        property.setName("Appartement Test");
        e.setProperty(property);

        Intervention intervention = new Intervention();
        intervention.setId(70L);
        e.setIntervention(intervention);

        OwnerPayout payout = new OwnerPayout();
        payout.setId(80L);
        e.setOwnerPayout(payout);

        e.setDescription("Description");
        e.setAmountHt(new BigDecimal("200.00"));
        e.setTaxRate(new BigDecimal("0.10"));
        e.setTaxAmount(new BigDecimal("20.00"));
        e.setAmountTtc(new BigDecimal("220.00"));
        e.setCurrency("EUR");
        e.setCategory(ExpenseCategory.CLEANING);
        e.setExpenseDate(LocalDate.of(2026, 2, 1));
        e.setStatus(ExpenseStatus.PAID);
        e.setInvoiceReference("INV-2");
        e.setReceiptPath("/r.pdf");
        e.setNotes("notes");
        e.setPaymentReference("ref-2");
        return e;
    }
}
