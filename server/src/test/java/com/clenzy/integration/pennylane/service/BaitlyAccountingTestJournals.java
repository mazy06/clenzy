package com.clenzy.integration.pennylane.service;

import com.clenzy.integration.pennylane.model.PennylaneConnection;
import com.clenzy.integration.pennylane.repository.PennylaneConnectionRepository;
import java.util.*;
import static org.mockito.Mockito.*;

/** Uniquement pour conserver les tests de mapping/diagnostics ; la persistance est testée séparément. */
final class BaitlyAccountingTestJournals {
    static BaitlyAccountingExportJournal configure(PennylaneConnectionRepository connections, Long org) {
        var connection=new PennylaneConnection(); connection.setOrganizationId(org);
        lenient().when(connections.findByOrganizationIdAndStatus(org,PennylaneConnection.Status.ACTIVE)).thenReturn(Optional.of(connection));
        var journal=mock(BaitlyAccountingExportJournal.class);
        lenient().when(journal.prepareRecoverable(any(),any(),anyString(),nullable(String.class))).thenAnswer(call -> new BaitlyAccountingExportJournal.Ticket(
                call.getArgument(0),call.getArgument(1),UUID.randomUUID(),call.getArgument(2),null));
        lenient().when(journal.applyLocal(any(),anyString())).thenAnswer(call -> java.time.Instant.now());
        return journal;
    }
}
