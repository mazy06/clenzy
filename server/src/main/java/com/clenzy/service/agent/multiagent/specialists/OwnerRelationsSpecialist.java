package com.clenzy.service.agent.multiagent.specialists;

import com.clenzy.config.ai.ChatLLMProvider;
import com.clenzy.service.agent.ToolRegistry;
import com.clenzy.service.agent.multiagent.AbstractAgentSpecialist;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Specialiste relation proprietaire (campagne T-09 — agent Proprietaire,
 * fiche metier n°11, levier conciergerie n°1) : releves de reversements,
 * commissions, rentabilite par bien, communication proprietaire.
 *
 * <p>Cluster distinct de {@code finance} (tresorerie de l'organisation) : ici
 * le point de vue est CELUI DU PROPRIETAIRE d'un mandat — transparence des
 * reversements et de la commission, anti-these des conciergeries boite noire
 * (signature feature « Constellation Proprietaire », Phase 6).</p>
 */
@Component
public class OwnerRelationsSpecialist extends AbstractAgentSpecialist {

    public OwnerRelationsSpecialist(ChatLLMProvider chatProvider,
                                    ToolRegistry toolRegistry,
                                    ObjectMapper objectMapper,
                                    MeterRegistry meterRegistry) {
        super(chatProvider, toolRegistry, objectMapper, meterRegistry);
    }

    @Override
    public String name() { return "owner_relations"; }

    @Override
    public String domain() { return "Relation proprietaire : releves de reversements, commissions, rentabilite par mandat"; }

    @Override
    public String description() {
        return """
                Specialiste de la relation avec les PROPRIETAIRES des logements (conciergerie) :
                - "Ou en sont les reversements de M. Martin ?" → get_owner_payout_summary
                - "Envoie son releve de juin a Mme Dupont" → send_owner_statement (email reel,
                  confirmation requise — carte HITL)
                - "Quelle rentabilite / P&L pour l'appartement du Vieux-Port ?" → get_property_pnl
                - "Combien de commission a-t-on preleve ce trimestre ?" → get_owner_payout_summary
                  (la commission est detaillee par reversement)
                - "Performance comparee des biens de ce proprietaire ?" → get_properties_performance
                Lecture seule SAUF send_owner_statement (write, avec confirmation).""";
    }

    @Override
    public Set<String> toolNames() {
        return Set.of(
                "get_owner_payout_summary",
                "send_owner_statement",
                "get_property_pnl",
                "get_properties_performance",
                "get_financial_summary"
        );
    }
}
