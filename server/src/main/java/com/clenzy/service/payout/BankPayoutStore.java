package com.clenzy.service.payout;

import com.clenzy.model.BankPayoutObservation;
import com.clenzy.repository.BankPayoutObservationRepository;
import com.clenzy.repository.PayoutTransferRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.List;

/** Transactions courtes pour les webhooks vérifiés et le rattrapage interne des comptes du journal. */
@Service
@Transactional(propagation = Propagation.REQUIRES_NEW)
public class BankPayoutStore {
    private final BankPayoutObservationRepository events;
    private final PayoutTransferRepository transfers;
    private final ObjectMapper json;
    public BankPayoutStore(BankPayoutObservationRepository events, PayoutTransferRepository transfers, ObjectMapper json) {
        this.events = events; this.transfers = transfers; this.json = json;
    }
    public boolean needsProcessing(String account, String event) {
        return transfers.existsByProviderAndDestination("STRIPE", account) && !events.existsByEventId(event);
    }
    public boolean isKnownAccount(String account, boolean live) {
        return transfers.existsByProviderAndDestinationAndStripeLivemode("STRIPE", account, live);
    }
    public void append(String event, String account, String payout, boolean live, BankPayoutObservation.Status status,
            Instant payoutCreated, Instant eventCreated, Instant arrival, String failure, List<BankPayoutObservation.Source> sources) {
        try {
            events.append(event, account, payout, live, status.name(), payoutCreated, eventCreated, arrival, failure,
                    json.writeValueAsString(sources));
        } catch (JsonProcessingException e) { throw new IllegalStateException("Preuve bancaire non enregistrable.", e); }
    }
}
