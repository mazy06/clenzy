package com.clenzy.service;

import com.clenzy.model.*;
import com.clenzy.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BaitlyAffiliateReceiptTest {
    @Mock ActivityCommissionRepository rows;
    @Mock ActivityAffiliateConfigRepository configs;
    @Mock PropertyRepository properties;
    @Mock WalletService wallets;
    @Mock LedgerService ledger;
    @Mock OrganizationRepository organizations;
    ActivityCommissionService service;
    ActivityCommission row;
    @BeforeEach void setup() {
        service=new ActivityCommissionService(rows,configs,properties,wallets,ledger,organizations);
        row=new ActivityCommission(); row.setId(7L); row.setOrganizationId(2L); row.setProvider(ActivityProvider.VIATOR);
        row.setCurrency("EUR"); row.setGrossCommission(new BigDecimal("100"));
        row.setHostShare(new BigDecimal("80")); row.setPlatformShare(new BigDecimal("20"));
    }
    void found() { when(rows.lockByIdAndOrganizationId(7L,2L)).thenReturn(Optional.of(row)); }
    void property(long org) {
        User owner=new User(); owner.setId(4L);
        Property p=new Property(); p.setId(3L); p.setOrganizationId(org); p.setOwner(owner);
        when(properties.findById(3L)).thenReturn(Optional.of(p));
    }
    void receive() { service.receive(2L,7L,new BigDecimal("100"),"EUR",3L,"REPORT-7",LocalDateTime.of(2026,1,1,0,0),"staff"); }
    @Test void receiptCreditsOnceWithoutPretendingToPayTheBank() {
        found(); property(2L); receive(); receive();
        assertThat(row.getStatus()).isEqualTo(ActivityCommissionStatus.RECEIVED);
        assertThat(row.getRecordedBy()).isEqualTo("staff");
        verify(ledger).recordTransfer(any(),any(),eq(new BigDecimal("80")),eq(LedgerReferenceType.COMMISSION),eq("ACTIVITY-7"),anyString());
    }
    @Test void wrongTenantCannotReceive() {
        found(); property(99L);
        assertThatThrownBy(this::receive).hasMessageContaining("hors organisation");
        verifyNoInteractions(ledger,wallets);
    }
    @Test void anotherCurrencyCannotReceive() {
        found(); row.setCurrency("USD");
        assertThatThrownBy(this::receive).hasMessageContaining("devise");
        verifyNoInteractions(ledger,wallets);
    }
    @Test void historicalPaidIsNotRecredited() {
        found(); row.setStatus(ActivityCommissionStatus.PAID);
        assertThatThrownBy(this::receive).hasMessageContaining("revue");
        verifyNoInteractions(ledger,wallets);
    }
    @Test void missingLedgerAttributionKeepsReceiptPending() {
        found(); property(2L);
        doThrow(new IllegalStateException("ledger")).when(ledger).recordTransfer(any(),any(),any(),any(),anyString(),anyString());
        assertThatThrownBy(this::receive).isInstanceOf(IllegalStateException.class);
        assertThat(row.getStatus()).isEqualTo(ActivityCommissionStatus.PENDING);
    }
    @Test void canceledConversionIsExcluded() {
        found(); service.cancelExpected(2L,7L);
        assertThatThrownBy(this::receive).hasMessageContaining("revue");
        verifyNoInteractions(ledger,wallets);
    }
    @Test void cannotSilentlyCancelAnEncashedCommission() {
        found(); row.setStatus(ActivityCommissionStatus.RECEIVED);
        assertThatThrownBy(() -> service.cancelExpected(2L,7L)).hasMessageContaining("reprise");
    }
    @Test void currenciesAndExpectedAmountsAreKeptApart() {
        var usd=new ActivityCommission(); usd.setCurrency("USD"); usd.setGrossCommission(new BigDecimal("30"));
        usd.setHostShare(new BigDecimal("30")); usd.setPlatformShare(BigDecimal.ZERO); usd.setStatus(ActivityCommissionStatus.RECEIVED);
        when(rows.findByOrganizationIdOrderByCreatedAtDesc(2L)).thenReturn(List.of(row,usd));
        var summary=service.summaryForOrg(2L);
        assertThat(summary.totalGross()).isNull(); assertThat(summary.currency()).isNull();
        assertThat(summary.totalsByCurrency()).hasSize(2);
        assertThat(summary.totalsByCurrency().get(0).expectedGross()).isEqualByComparingTo("100");
        assertThat(summary.totalsByCurrency().get(0).receivedGross()).isZero();
        assertThat(summary.totalsByCurrency().get(1).receivedGross()).isEqualByComparingTo("30");
    }
    @Test void divergentReportIsNotSilentlyAccepted() {
        row.setExternalBookingId("VT-7");
        when(organizations.lockById(2L)).thenReturn(Optional.of(new Organization()));
        when(rows.findByOrganizationIdAndProviderAndExternalBookingId(2L,ActivityProvider.VIATOR,"VT-7")).thenReturn(Optional.of(row));
        assertThatThrownBy(() -> service.recordAffiliateEarning(2L,ActivityProvider.VIATOR,"VT-7",new BigDecimal("70"),"EUR",null))
                .hasMessageContaining("différent");
        verifyNoInteractions(wallets,ledger);
    }
}
