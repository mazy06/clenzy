package com.clenzy.service;

import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class BaitlyNoiseWarningRepairWorkerTest {
    final BaitlyNoiseWarningJournal journal=mock(BaitlyNoiseWarningJournal.class);
    final BaitlyNoiseWarningRepairWorker worker=new BaitlyNoiseWarningRepairWorker(journal);
    @Test void localFailureDoesNotStopOtherProofsAndNeverAdmitsOrSends() {
        var a=new BaitlyNoiseWarningJournal.Repair(7L,11L);
        var b=new BaitlyNoiseWarningJournal.Repair(7L,12L);
        when(journal.repairQueue()).thenReturn(List.of(a,b));
        when(journal.repairAccepted(7L,11L)).thenThrow(new IllegalStateException("synthetic-private"));
        worker.repair();
        verify(journal).repairAccepted(7L,12L);
        verify(journal).deferRepair(a);
        verify(journal,never()).claim(any());
        verify(journal,never()).accepted(any(),any());
        verify(journal,never()).uncertain(any());
    }
    @Test void unavailableQueueNeverRearmsOrEscapes() {
        when(journal.repairQueue()).thenThrow(new IllegalStateException("synthetic-private"));
        worker.repair();
        verify(journal,never()).claim(any());
        verify(journal,never()).repairAccepted(any(),any());
    }
}
