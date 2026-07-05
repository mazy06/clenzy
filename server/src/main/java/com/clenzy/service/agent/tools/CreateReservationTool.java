package com.clenzy.service.agent.tools;

import com.clenzy.config.ai.ToolDescriptor;
import com.clenzy.model.Property;
import com.clenzy.model.Reservation;
import com.clenzy.service.PriceEngine;
import com.clenzy.service.PropertyService;
import com.clenzy.service.ReservationService;
import com.clenzy.service.agent.AgentContext;
import com.clenzy.service.agent.ToolExecutionException;
import com.clenzy.service.agent.ToolHandler;
import com.clenzy.service.agent.ToolResult;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tool {@code create_reservation} — cree une reservation directe (sejour voyageur).
 *
 * <p>requiresConfirmation = true — action d'ecriture qui bloque le calendrier et
 * peut declencher des notifications. L'orchestrateur demande au user de valider
 * via le dialog HITL avant execution.</p>
 *
 * <p><b>Regle ARGENT (audit Clenzy #1) — le prix ne vient JAMAIS du client/LLM</b> :
 * ce tool n'expose AUCUN argument prix/montant. Le total est recalcule
 * exclusivement cote serveur via {@link PriceEngine#resolvePriceRange} sur les
 * nuits {@code [checkIn, checkOut-1]} (la nuit de depart n'est pas facturee),
 * puis fixe sur l'entite via {@link Reservation#setTotalPrice} AVANT la
 * sauvegarde. Meme pattern que {@code get_price_quote}.</p>
 *
 * <p>Tool MINCE : aucune logique metier ici. {@link ReservationService#save}
 * porte l'anti-double-booking (CalendarEngine.book), la validation min-nights,
 * la liaison du Guest, les notifications et la generation des codes serrure.</p>
 *
 * <p>Org-safe : {@link PropertyService#getPropertyEntityById} delegue a
 * {@code findByIdRespectingTenant} (filtre Hibernate multi-tenant + bypass
 * platform staff). Un logement hors organisation leve une erreur AVANT toute
 * creation — l'assistant herite des memes garanties que les endpoints REST.</p>
 */
@Component
public class CreateReservationTool implements ToolHandler {

    private static final Logger log = LoggerFactory.getLogger(CreateReservationTool.class);
    private static final String NAME = "create_reservation";
    private static final String DEFAULT_SOURCE = "direct";

    private final ReservationService reservationService;
    private final PropertyService propertyService;
    private final PriceEngine priceEngine;
    private final ObjectMapper objectMapper;
    private final ToolDescriptor descriptor;

    public CreateReservationTool(ReservationService reservationService,
                                 PropertyService propertyService,
                                 PriceEngine priceEngine,
                                 ObjectMapper objectMapper) {
        this.reservationService = reservationService;
        this.propertyService = propertyService;
        this.priceEngine = priceEngine;
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
        long propertyId = args.path("propertyId").asLong(0);
        if (propertyId <= 0) {
            throw new ToolExecutionException(NAME, "propertyId requis (utiliser list_properties pour le trouver).");
        }
        String guestName = args.path("guestName").asText("");
        if (guestName.isBlank()) {
            throw new ToolExecutionException(NAME, "guestName est requis");
        }
        LocalDate checkIn;
        LocalDate checkOut;
        try {
            checkIn = LocalDate.parse(args.path("checkIn").asText());
            checkOut = LocalDate.parse(args.path("checkOut").asText());
        } catch (DateTimeParseException e) {
            throw new ToolExecutionException(NAME,
                    "Dates invalides : format AAAA-MM-JJ (checkIn = arrivee, checkOut = depart).");
        }
        if (!checkOut.isAfter(checkIn)) {
            throw new ToolExecutionException(NAME, "checkOut (depart) doit etre apres checkIn (arrivee).");
        }
        Integer guestCount = args.hasNonNull("guestCount") ? args.path("guestCount").asInt() : null;
        Integer adultsCount = args.hasNonNull("adultsCount") ? args.path("adultsCount").asInt() : null;
        Integer childrenCount = args.hasNonNull("childrenCount") ? args.path("childrenCount").asInt() : null;
        String source = args.path("source").asText(DEFAULT_SOURCE);
        if (source.isBlank()) {
            source = DEFAULT_SOURCE;
        }

        Long orgId = context.organizationId();

        try {
            // Org-safe : getPropertyEntityById delegue a findByIdRespectingTenant
            // (filtre Hibernate multi-tenant). Un logement hors org leve une erreur ICI,
            // avant toute creation. Retourne l'entite managee requise par save().
            Property property = propertyService.getPropertyEntityById(propertyId);

            // ── PRIX FIXE COTE SERVEUR (jamais depuis args) ──────────────────
            // Nuits facturees = [checkIn, checkOut-1]. resolvePriceRange applique
            // la cascade 6 niveaux du PriceEngine. Le total est la somme des nuits
            // valorisees. ReservationService.save() persiste ce totalPrice tel quel
            // (il ne recalcule pas), donc c'est ICI la seule source du montant.
            Map<LocalDate, BigDecimal> nightly =
                    priceEngine.resolvePriceRange(propertyId, checkIn, checkOut.minusDays(1), orgId);
            BigDecimal total = BigDecimal.ZERO;
            int pricedNights = 0;
            for (BigDecimal nightPrice : nightly.values()) {
                if (nightPrice == null) continue;
                total = total.add(nightPrice);
                pricedNights++;
            }

            // Garde-fou ARGENT : refuser de creer une reservation a prix indetermine.
            // Si une nuit n'a pas de tarif resolu (logement sans prix de base ni override),
            // on ne cree PAS un sejour a total partiel/zero silencieux.
            long expectedNights = java.time.temporal.ChronoUnit.DAYS.between(checkIn, checkOut);
            if (pricedNights < expectedNights || total.signum() <= 0) {
                throw new ToolExecutionException(NAME,
                        "Tarif manquant pour " + (expectedNights - pricedNights) + " des " + expectedNights
                        + " nuit(s) : configure le prix du logement (prix de base ou override) avant de creer la "
                        + "reservation. Refus de creer un sejour a prix indetermine.");
            }

            Reservation reservation = new Reservation();
            reservation.setProperty(property);
            reservation.setGuestName(guestName);
            reservation.setGuestCount(guestCount);
            reservation.setAdultsCount(adultsCount);
            reservation.setChildrenCount(childrenCount);
            reservation.setCheckIn(checkIn);
            reservation.setCheckOut(checkOut);
            reservation.setSource(source);
            // "confirmed" : declenche le blocage calendrier (anti-double-booking)
            // cote ReservationService.save(). Aligne sur le defaut du POST /reservations.
            reservation.setStatus("confirmed");
            // Montant serveur — JAMAIS un input LLM.
            reservation.setTotalPrice(total);
            reservation.setOrganizationId(orgId);

            // Delegation : double-booking, min-nights, Guest, notifications, codes serrure.
            Reservation saved = reservationService.save(reservation);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", saved.getId());
            payload.put("propertyId", propertyId);
            payload.put("propertyName", property.getName());
            payload.put("guestName", saved.getGuestName());
            if (saved.getGuestCount() != null) {
                payload.put("guestCount", saved.getGuestCount());
            }
            payload.put("checkIn", saved.getCheckIn() != null ? saved.getCheckIn().toString() : null);
            payload.put("checkOut", saved.getCheckOut() != null ? saved.getCheckOut().toString() : null);
            payload.put("status", saved.getStatus());
            payload.put("source", saved.getSource());
            payload.put("nights", pricedNights);
            payload.put("total", saved.getTotalPrice());
            payload.put("currency", "EUR");
            payload.put("message", "Reservation #" + saved.getId() + " creee pour " + guestName + ".");

            return ToolResult.success(objectMapper.writeValueAsString(payload), "summary");
        } catch (JsonProcessingException e) {
            throw new ToolExecutionException(NAME, "Failed to serialize result", e);
        } catch (ToolExecutionException e) {
            throw e;
        } catch (Exception e) {
            // Inclut CalendarConflictException (double-booking) et min-nights.
            log.warn("create_reservation failed: {}", e.getMessage());
            throw new ToolExecutionException(NAME,
                    "Creation impossible (" + e.getMessage() + ")", e);
        }
    }

    private static ToolDescriptor buildDescriptor(ObjectMapper om) {
        try {
            JsonNode schema = om.readTree("""
                    {
                      "type": "object",
                      "properties": {
                        "propertyId": {"type":"integer","description":"REQUIS : ID du logement (obtenu via list_properties)."},
                        "checkIn":    {"type":"string","format":"date","description":"REQUIS : date d'arrivee, format AAAA-MM-JJ."},
                        "checkOut":   {"type":"string","format":"date","description":"REQUIS : date de depart (non facturee), format AAAA-MM-JJ."},
                        "guestName":  {"type":"string","minLength":1,"maxLength":120,"description":"REQUIS : nom du voyageur."},
                        "guestCount": {"type":"integer","minimum":1,"description":"Nombre total de voyageurs (optionnel)."},
                        "adultsCount":   {"type":"integer","minimum":0,"description":"Nombre d'adultes taxables a la taxe de sejour (optionnel). Renseigner permet d'exonerer les mineurs."},
                        "childrenCount": {"type":"integer","minimum":0,"description":"Nombre d'enfants/mineurs exoneres (optionnel)."},
                        "source":     {"type":"string","description":"Canal de la reservation (optionnel, defaut 'direct')."}
                      },
                      "required": ["propertyId","checkIn","checkOut","guestName"],
                      "additionalProperties": false
                    }
                    """);
            return ToolDescriptor.write(
                    NAME,
                    "Cree une reservation directe (sejour voyageur) sur un logement pour des dates. "
                            + "Le PRIX est calcule automatiquement cote serveur via le PriceEngine — ne PAS demander ni fournir de montant. "
                            + "Bloque le calendrier (anti-double-booking) et notifie le proprietaire. Confirmer avant d'executer.",
                    schema
            );
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to build schema for " + NAME, e);
        }
    }
}
