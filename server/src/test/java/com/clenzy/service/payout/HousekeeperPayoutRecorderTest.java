package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.PayoutBeneficiary;
import com.clenzy.repository.HousekeeperPayoutConfigRepository;
import com.clenzy.repository.HousekeeperPayoutRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Verrou anti-double-payout : contrainte UNIQUE + pré-check → jamais deux records
 * pour une intervention ; les CAS ne délèguent qu'au repository (UPDATE conditionnel).
 */
@ExtendWith(MockitoExtension.class)
class HousekeeperPayoutRecorderTest {

    @Mock private HousekeeperPayoutRecordRepository recordRepository;
    @Mock private HousekeeperPayoutConfigRepository configRepository;
    @Mock private ProviderPayoutBeneficiaryService beneficiaries;
    @Mock private BaitlyProviderPayoutGuard fundingGuard;

    private HousekeeperPayoutRecorder recorder;

    private Intervention intervention() {
        Intervention i = new Intervention();
        i.setId(11L);
        i.setOrganizationId(7L);
        return i;
    }

    private PayoutBeneficiary pro() {
        return PayoutBeneficiary.user(42L);
    }

    @BeforeEach
    void setUp() {
        recorder = new HousekeeperPayoutRecorder(recordRepository, configRepository, beneficiaries, fundingGuard);
    }

    @Test void refundReservedWhilePayoutWaitedForLockPreventsInsertion() {
        doThrow(new IllegalStateException("Un remboursement doit être rapproché"))
                .when(fundingGuard).requireFunding(eq(11L),eq(7L),eq(pro()),any(),any());
        assertThatThrownBy(() -> recorder.insertRecord(intervention(),pro(),new BigDecimal("35"),BigDecimal.ZERO,Status.PENDING,null))
                .hasMessageContaining("remboursement");
        var order=inOrder(beneficiaries,recordRepository,fundingGuard);
        order.verify(beneficiaries).lockAndRequireRecipient(11L,7L,pro());
        order.verify(recordRepository).findByInterventionId(11L);
        order.verify(fundingGuard).requireFunding(eq(11L),eq(7L),eq(pro()),any(),any());
        verify(recordRepository,never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("insert : record déjà présent → false (aucun doublon)")
    void whenRecordExists_thenInsertReturnsFalse() {
        when(recordRepository.findByInterventionId(11L))
                .thenReturn(Optional.of(new HousekeeperPayoutRecord()));

        boolean created = recorder.insertRecord(intervention(), pro(),
                BigDecimal.valueOf(95), BigDecimal.ZERO, Status.PENDING, null);

        assertThat(created).isFalse();
        verify(recordRepository, never()).saveAndFlush(any());
        verify(beneficiaries).lockAndRequireRecipient(11L, 7L, pro());
    }

    @Test
    @DisplayName("insert : erreur SQL après verrou → erreur visible, jamais de faux succès")
    void whenPersistenceFails_thenFailurePropagates() {
        when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.empty());
        when(recordRepository.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("constraint"));

        assertThatThrownBy(() -> recorder.insertRecord(intervention(), pro(),
                BigDecimal.valueOf(95), BigDecimal.ZERO, Status.PENDING, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test void companyBeneficiaryIsPersistedWithoutInventingAUser() {
        var company = PayoutBeneficiary.organization(9L);
        recorder.insertRecord(intervention(), company, new BigDecimal("95"), BigDecimal.ZERO, Status.PENDING, null);
        verify(beneficiaries).lockAndRequireRecipient(11L, 7L, company);
        verify(recordRepository).saveAndFlush(argThat(r -> r.getUserId() == null
                && r.getBeneficiaryOrganizationId().equals(9L)));
    }

    @Test
    @DisplayName("markSent/markFailed : délégation au CAS repository (UPDATE conditionnel)")
    void whenMarking_thenConditionalUpdateUsed() {
        when(recordRepository.transitionStatus(77L, Status.PENDING, Status.SENT, "tr_1", null)).thenReturn(1);
        assertThat(recorder.markSent(77L, "tr_1")).isEqualTo(1);

        when(recordRepository.transitionStatus(eq(77L), eq(Status.PENDING), eq(Status.FAILED),
                isNull(), any())).thenReturn(0);
        assertThat(recorder.markFailed(77L, "boom")).isEqualTo(0); // concurrent déjà passé → no-op
    }
}
