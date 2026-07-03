package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.service.AccountingQueryService;
import com.clenzy.service.OwnerStatementService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.clenzy.util.PiiMasker;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code send_owner_statement} — genere et envoie par email le releve de
 * reversements d'un proprietaire sur une periode (campagne T-09, agent
 * Proprietaire — fiche metier n°11).
 *
 * <p>requiresConfirmation = true — envoi reel d'un email au proprietaire
 * (invariant : un envoi ne descend jamais sous « notifier »). Le service
 * n'inclut que les reversements PAID (pas de confusion « je n'ai pas recu ce
 * montant ») et echappe le HTML.</p>
 */
@Component
public class SendOwnerStatementTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(SendOwnerStatementTool.class);
    private static final String NAME = "send_owner_statement";

    private final OwnerStatementService ownerStatementService;
    private final AccountingQueryService accountingQueryService;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public SendOwnerStatementTool(OwnerStatementService ownerStatementService,
                                  AccountingQueryService accountingQueryService,
                                  ObjectMapper objectMapper) {
        this.ownerStatementService = ownerStatementService;
        this.accountingQueryService = accountingQueryService;
        this.objectMapper = objectMapper;
        this.descriptor = buildDescriptor(objectMapper);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public ToolDescriptor descriptor() {
        return descriptor;
    }

    @Override
    public ToolResult execute(JsonNode args, AgentContext context) {
        if (!args.hasNonNull("ownerId") || !args.hasNonNull("from") || !args.hasNonNull("to")) {
            throw new ToolExecutionException(NAME, "ownerId, from et to sont requis");
        }
        Long ownerId = args.path("ownerId").asLong();
        LocalDate from;
        LocalDate to;
        try {
            from = LocalDate.parse(args.path("from").asText());
            to = LocalDate.parse(args.path("to").asText());
        } catch (DateTimeParseException e) {
            throw new ToolExecutionException(NAME, "Dates invalides (format attendu : YYYY-MM-DD)");
        }
        if (to.isBefore(from)) {
            throw new ToolExecutionException(NAME, "La date de fin est avant la date de debut");
        }
        if (from.plusYears(2).isBefore(to)) {
            throw new ToolExecutionException(NAME, "Periode trop large (max 2 ans)");
        }

        try {
            Long orgId = context.organizationId();
            String conciergerieName = accountingQueryService.getOrganizationName(orgId)
                    .orElse("Votre conciergerie");
            OwnerStatementService.OwnerStatementResult result =
                    ownerStatementService.sendStatement(ownerId, orgId, from, to, conciergerieName);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("ownerName", result.ownerName());
            payload.put("emailSentTo", PiiMasker.maskEmail(result.emailSentTo()));
            payload.put("period", from + " → " + to);
            payload.put("payoutsCount", result.payoutsCount());
            payload.put("totalPaid", result.totalPaid());
            payload.put("totalGross", result.totalGross());
            payload.put("totalCommission", result.totalCommission());
            payload.put("totalExpenses", result.totalExpenses());
            payload.put("message", "Releve envoye au proprietaire.");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (IllegalArgumentException | IllegalStateException e) {
            throw new ToolExecutionException(NAME, e.getMessage());
        } catch (Exception e) {
            log.warn("send_owner_statement failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Envoi du releve impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "ownerId": {"type":"integer","description":"REQUIS : ID du proprietaire (User)"},
                        "from":    {"type":"string","description":"REQUIS : debut de periode YYYY-MM-DD"},
                        "to":      {"type":"string","description":"REQUIS : fin de periode YYYY-MM-DD"}
                      },
                      "required": ["ownerId", "from", "to"]
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Genere et ENVOIE par email le releve de reversements (PAID) d'un proprietaire sur une periode. Pour 'envoie le releve de juin a X'. Confirmation requise.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
