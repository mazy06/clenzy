package com.clenzy.service;

import com.clenzy.model.LedgerEntry;
import com.clenzy.model.LedgerEntryType;
import com.clenzy.model.LedgerReferenceType;
import com.clenzy.model.Wallet;
import com.clenzy.model.WalletType;
import com.clenzy.repository.LedgerEntryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class LedgerServiceTest {

    private LedgerEntryRepository repo;
    private LedgerService service;

    @BeforeEach
    void setUp() {
        repo = mock(LedgerEntryRepository.class);
        service = new LedgerService(repo);
    }

    private static Wallet wallet(Long id, Long orgId, String currency) {
        Wallet w = new Wallet();
        w.setId(id);
        w.setOrganizationId(orgId);
        w.setWalletType(WalletType.OWNER);
        w.setCurrency(currency);
        return w;
    }

    @Test
    void calculateBalance_returnsValueFromRepo() {
        when(repo.calculateBalance(7L)).thenReturn(new BigDecimal("123.45"));
        assertEquals(new BigDecimal("123.45"), service.calculateBalance(7L));
    }

    @Test
    void calculateBalance_nullFromRepo_returnsZero() {
        when(repo.calculateBalance(7L)).thenReturn(null);
        assertEquals(BigDecimal.ZERO, service.calculateBalance(7L));
    }

    @Test
    void getEntries_delegatesToRepo() {
        Pageable pageable = PageRequest.of(0, 10);
        Page<LedgerEntry> expected = new PageImpl<>(List.of(), pageable, 0);
        when(repo.findByWalletIdOrderByCreatedAtDesc(7L, pageable)).thenReturn(expected);
        assertSame(expected, service.getEntries(7L, pageable));
    }

    @Test
    void getEntriesByReference_delegatesToRepo() {
        LedgerEntry e = new LedgerEntry();
        when(repo.findByReferenceTypeAndReferenceId(LedgerReferenceType.PAYMENT, "tx-1"))
                .thenReturn(List.of(e));
        List<LedgerEntry> result = service.getEntriesByReference(LedgerReferenceType.PAYMENT, "tx-1");
        assertEquals(1, result.size());
        assertSame(e, result.get(0));
    }

    @Test
    void hasEntriesForReference_delegatesToRepoExists() {
        when(repo.existsByReferenceTypeAndReferenceId(LedgerReferenceType.PAYMENT, "tx-1"))
                .thenReturn(true);
        assertTrue(service.hasEntriesForReference(LedgerReferenceType.PAYMENT, "tx-1"));
        assertFalse(service.hasEntriesForReference(LedgerReferenceType.PAYMENT, "tx-2"));
    }

    @Test
    void recordTransfer_nullAmount_throws() {
        Wallet from = wallet(1L, 100L, "EUR");
        Wallet to = wallet(2L, 100L, "EUR");
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> service.recordTransfer(from, to, null,
                        LedgerReferenceType.PAYMENT, "ref", "desc"));
        assertTrue(ex.getMessage().toLowerCase().contains("positive"));
    }

    @Test
    void recordTransfer_zeroAmount_throws() {
        Wallet from = wallet(1L, 100L, "EUR");
        Wallet to = wallet(2L, 100L, "EUR");
        assertThrows(IllegalArgumentException.class, () -> service.recordTransfer(
                from, to, BigDecimal.ZERO,
                LedgerReferenceType.PAYMENT, "ref", "desc"));
    }

    @Test
    void recordTransfer_negativeAmount_throws() {
        Wallet from = wallet(1L, 100L, "EUR");
        Wallet to = wallet(2L, 100L, "EUR");
        assertThrows(IllegalArgumentException.class, () -> service.recordTransfer(
                from, to, new BigDecimal("-5"),
                LedgerReferenceType.PAYMENT, "ref", "desc"));
    }

    @Test
    void recordTransfer_happyPath_createsDebitAndCreditAndLinksThem() {
        Wallet from = wallet(1L, 100L, "EUR");
        Wallet to = wallet(2L, 100L, "EUR");

        // initial balances : from=200, to=50
        when(repo.calculateBalance(1L)).thenReturn(new BigDecimal("200.00"));
        when(repo.calculateBalance(2L)).thenReturn(new BigDecimal("50.00"));

        // Mock save() to assign IDs (auto-increment simulation)
        AtomicLong idGen = new AtomicLong(1000);
        when(repo.save(any(LedgerEntry.class))).thenAnswer(inv -> {
            LedgerEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(idGen.getAndIncrement());
            return e;
        });

        LedgerEntry[] result = service.recordTransfer(from, to, new BigDecimal("75.00"),
                LedgerReferenceType.PAYMENT, "tx-42", "Payment for ABC");

        assertEquals(2, result.length);
        LedgerEntry debit = result[0];
        LedgerEntry credit = result[1];

        assertEquals(LedgerEntryType.DEBIT, debit.getEntryType());
        assertEquals(LedgerEntryType.CREDIT, credit.getEntryType());
        assertEquals(1L, debit.getWalletId());
        assertEquals(2L, credit.getWalletId());
        assertEquals(100L, debit.getOrganizationId());
        assertEquals(100L, credit.getOrganizationId());
        assertEquals(new BigDecimal("75.00"), debit.getAmount());
        assertEquals(new BigDecimal("75.00"), credit.getAmount());
        assertEquals("EUR", debit.getCurrency());
        assertEquals("EUR", credit.getCurrency());
        // balance_after = 200 - 75 = 125 ; 50 + 75 = 125
        assertEquals(new BigDecimal("125.00"), debit.getBalanceAfter());
        assertEquals(new BigDecimal("125.00"), credit.getBalanceAfter());
        assertEquals(LedgerReferenceType.PAYMENT, debit.getReferenceType());
        assertEquals(LedgerReferenceType.PAYMENT, credit.getReferenceType());
        assertEquals("tx-42", debit.getReferenceId());
        assertEquals("tx-42", credit.getReferenceId());
        assertEquals("Payment for ABC", debit.getDescription());
        assertEquals("Payment for ABC", credit.getDescription());

        // counterparts linked
        assertEquals(credit.getId(), debit.getCounterpartEntryId());
        assertEquals(debit.getId(), credit.getCounterpartEntryId());

        // save() called 4 times : 2 inserts + 2 updates for counterpart wiring
        verify(repo, times(4)).save(any(LedgerEntry.class));
    }

    @Test
    void recordTransfer_zeroBalances_handledCleanly() {
        Wallet from = wallet(1L, 1L, "EUR");
        Wallet to = wallet(2L, 1L, "EUR");

        when(repo.calculateBalance(any())).thenReturn(null);
        when(repo.save(any(LedgerEntry.class))).thenAnswer(inv -> {
            LedgerEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(1L);
            return e;
        });

        LedgerEntry[] result = service.recordTransfer(from, to, new BigDecimal("10"),
                LedgerReferenceType.ESCROW_HOLD, "esc-1", "hold");

        // initial 0 → debit -10, credit +10
        assertEquals(new BigDecimal("-10"), result[0].getBalanceAfter());
        assertEquals(new BigDecimal("10"), result[1].getBalanceAfter());
    }

    @Test
    void recordTransfer_crossOrgsAndCurrencies_arePreservedFromWalletInputs() {
        Wallet from = wallet(1L, 100L, "USD");
        Wallet to = wallet(2L, 200L, "EUR");
        when(repo.calculateBalance(any())).thenReturn(BigDecimal.TEN);
        when(repo.save(any(LedgerEntry.class))).thenAnswer(inv -> {
            LedgerEntry e = inv.getArgument(0);
            if (e.getId() == null) e.setId(1L);
            return e;
        });

        ArgumentCaptor<LedgerEntry> captor = ArgumentCaptor.forClass(LedgerEntry.class);
        service.recordTransfer(from, to, new BigDecimal("3"),
                LedgerReferenceType.SPLIT, "split-1", "split it");

        verify(repo, atLeastOnce()).save(captor.capture());
        // Among the first inserts (before counterpart re-save), org ids match wallet origin
        LedgerEntry debitFirst = captor.getAllValues().get(0);
        LedgerEntry creditFirst = captor.getAllValues().get(1);
        assertEquals(100L, debitFirst.getOrganizationId());
        assertEquals(200L, creditFirst.getOrganizationId());
        assertEquals("USD", debitFirst.getCurrency());
        assertEquals("EUR", creditFirst.getCurrency());
    }
}
