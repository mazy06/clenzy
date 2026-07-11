package com.clenzy.service.payout;

import com.clenzy.model.HousekeeperPayoutRecord;
import com.clenzy.model.HousekeeperPayoutRecord.Status;
import com.clenzy.model.Intervention;
import com.clenzy.model.User;
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

    private HousekeeperPayoutRecorder recorder;

    private Intervention intervention() {
        Intervention i = new Intervention();
        i.setId(11L);
        i.setOrganizationId(7L);
        return i;
    }

    private User pro() {
        User u = new User();
        u.setId(42L);
        return u;
    }

    @BeforeEach
    void setUp() {
        recorder = new HousekeeperPayoutRecorder(recordRepository, configRepository);
    }

    @Test
    @DisplayName("insert : record déjà présent → false (aucun doublon)")
    void whenRecordExists_thenInsertReturnsFalse() {
        when(recordRepository.findByInterventionId(11L))
                .thenReturn(Optional.of(new HousekeeperPayoutRecord()));

        boolean created = recorder.insertRecord(intervention(), pro(),
                BigDecimal.valueOf(95), BigDecimal.ZERO, Status.PENDING, null);

        assertThat(created).isFalse();
        verify(recordRepository, never()).save(any());
    }

    @Test
    @DisplayName("insert : violation de contrainte UNIQUE concurrente → false, pas d'exception")
    void whenUniqueViolation_thenInsertReturnsFalse() {
        when(recordRepository.findByInterventionId(11L)).thenReturn(Optional.empty());
        when(recordRepository.save(any())).thenThrow(new DataIntegrityViolationException("unique"));

        boolean created = recorder.insertRecord(intervention(), pro(),
                BigDecimal.valueOf(95), BigDecimal.ZERO, Status.PENDING, null);

        assertThat(created).isFalse();
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
