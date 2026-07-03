package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste finances : facturation, revenus/depenses/profit, versements
 * proprietaires, performance financiere des logements.
 *
 * <p>Issu d'un decoupage de {@code data_analyst} (qui depassait 10 tools) :
 * regroupe le cluster « argent » pour un routing plus net. Mappe sur l'agent
 * constellation {@code fin} (jusque-la dormant). 9 tools : 8 read-only + le règlement
 * des interventions impayées (settle_intervention_payment, write avec confirmation = carte HITL).</p>
 */
@Component
public class FinanceSpecialist extends AbstractAgentSpecialist {

    public FinanceSpecialist(ChatLLMProvider chatProvider,
                             ToolRegistry toolRegistry,
                             ObjectMapper objectMapper,
                             MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "finance"; }

    @Override
    public String domain() { return "Finances : facturation, revenus/depenses/profit, versements proprietaires, performance financiere"; }

    @Override
    public String description() {
        return """
                Specialiste pour toute question financiere :
                - "Mes factures ?", "Vue d'ensemble de la facturation ?"
                - "Mon bilan revenus / depenses / profit ?"
                - "Quels versements proprietaires sont en attente / verses ?"
                - "Quels sont mes logements les plus rentables ?"
                - "Quel canal me rapporte vraiment, net de commission ? Combien me coute Booking ?"
                - "Ai-je des menages / interventions NON REGLES (impayes) ?" → detect_unpaid_interventions
                - "Regle le menage / paie mes interventions impayees" → settle_intervention_payment (propose un
                  lien de paiement Stripe, confirmation requise — c'est la carte HITL de reglement)
                - "Rembourse la resa 123", "Fais un geste commercial de 50 EUR sur la resa X" → initiate_refund
                  (montant calcule/borne SERVEUR, confirmation requise)
                Lecture seule SAUF settle_intervention_payment et initiate_refund (write, avec confirmation).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "list_invoices",
                "get_billing_overview",
                "get_owner_payout_summary",
                "get_financial_summary",
                "get_properties_performance",
                "get_channel_attribution",
                "get_property_pnl",
                "detect_unpaid_interventions",
                "settle_intervention_payment",
                "initiate_refund"
        );
    }
}
