package com.clenzy.service;

import com.clenzy.dto.ServiceRequestDto;
import com.clenzy.marketplace.service.MarketplacePropertyContext;
import com.clenzy.model.*;
import com.clenzy.repository.*;
import com.clenzy.service.access.StayTimes;
import com.clenzy.service.catalog.ServiceCatalogReference;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

/** Une vente qualifiée rejoint l'affectation PMS ; elle ne crée ni paiement ni mission parallèle. */
@Service
@Transactional(readOnly = true)
public class BaitlyPaidServiceExecution {
    public static final String MID_STAY = "cleaning-mid-stay";
    private static final Set<String> SCHEDULED_SERVICES = Set.of(MID_STAY, "culinary-breakfast", "driver-airport", "driver-station");
    private static boolean scheduledService(String code) { return code != null && SCHEDULED_SERVICES.contains(code); }
    private static boolean transfer(String code) { return "driver-airport".equals(code) || "driver-station".equals(code); }
    public record Schedule(LocalDateTime start, Integer durationHours, String instructions) {}
    public record View(Long orderId, String title, String paymentStatus, String state, Long serviceRequestId,
                       Long interventionId, LocalDateTime start, Integer durationHours, String timezone,
                       LocalDateTime stayStart, LocalDateTime stayEnd, boolean canSchedule,
                       LocalDateTime scheduleStart, LocalDateTime scheduleEnd) {}
    public record GuestView(Long orderId, String title, String paymentStatus, String state,
                            LocalDateTime start, Integer durationHours, String timezone) {}
    private final UpsellOrderRepository orders;
    private final ReservationRepository reservations;
    private final ServiceRequestRepository needs;
    private final InterventionRepository interventions;
    private final PaymentTransactionRepository payments;
    private final WelcomeGuideTokenRepository tokens;
    private final UserRepository users;
    private final MarketplacePropertyContext properties;
    private final ServiceRequestService requests;
    private final ServiceCatalogReference catalog;
    private final BaitlyCommerceOperations operations;
    private final Clock clock;

    public BaitlyPaidServiceExecution(UpsellOrderRepository orders, ReservationRepository reservations,
            ServiceRequestRepository needs, InterventionRepository interventions, PaymentTransactionRepository payments,
            WelcomeGuideTokenRepository tokens, UserRepository users, MarketplacePropertyContext properties,
            ServiceRequestService requests, ServiceCatalogReference catalog, BaitlyCommerceOperations operations, Clock clock) {
        this.orders=orders; this.reservations=reservations; this.needs=needs; this.interventions=interventions;
        this.payments=payments; this.tokens=tokens; this.users=users; this.properties=properties;
        this.requests=requests; this.catalog=catalog; this.operations=operations; this.clock=clock;
    }

    public View inspect(Long id, Long org, Jwt jwt) {
        var order=orders.findById(id).filter(o -> org.equals(o.getOrganizationId()))
            .orElseThrow(() -> new AccessDeniedException("Vente inaccessible"));
        var stay=stay(order);
        properties.require(stay.getProperty().getId(),org,jwt);
        return view(order,stay);
    }

    private Reservation stay(UpsellOrder order) {
        if (order.getReservationId()==null) throw new IllegalArgumentException("Une réservation est nécessaire pour organiser le service");
        return reservations.findById(order.getReservationId()).filter(r -> order.getOrganizationId().equals(r.getOrganizationId())
            && r.getProperty()!=null && order.getOrganizationId().equals(r.getProperty().getOrganizationId()))
            .orElseThrow(() -> new AccessDeniedException("Séjour inaccessible"));
    }

    @Transactional
    public View schedule(Long id, Long org, Jwt jwt, Schedule plan) {
        var order=orders.lockForExecution(id,org).orElseThrow(() -> new AccessDeniedException("Vente inaccessible"));
        var stay=stay(order);
        properties.require(stay.getProperty().getId(),org,jwt);
        if (!scheduledService(order.getFulfillmentServiceCode()))
            throw new IllegalArgumentException("Cette vente ne correspond pas à une prestation planifiable qualifiée à l'achat");
        if (order.getServiceRequestId()!=null) {
            var existing=linked(order,stay);
            if (plan!=null && Objects.equals(plan.start(),existing.getDesiredDate())
                    && Objects.equals(plan.durationHours(),existing.getEstimatedDurationHours())
                    && Objects.equals(clean(plan.instructions()),clean(existing.getSpecialInstructions()))) return view(order,stay);
            throw new IllegalStateException("Une demande existe déjà. Modifiez-la depuis sa fiche.");
        }
        if (order.getStatus()!=UpsellOrderStatus.PAID) throw new IllegalStateException("Le service doit être payé et non remboursé");
        if (!operations.history(org,"UPSELL",id).isEmpty())
            throw new IllegalStateException("Cette vente a déjà été traitée dans le suivi existant");
        var proof=payments.findByProviderTxId(order.getStripeSessionId()).orElseThrow(() -> new IllegalStateException("Encaissement à rapprocher"));
        if (proof.getStatus()!=TransactionStatus.COMPLETED || proof.getPaymentType()!=TransactionType.CHECKOUT
                || !org.equals(proof.getOrganizationId()) || !"UPSELL".equals(proof.getSourceType())
                || !id.equals(proof.getSourceId()) || proof.getAmount()==null || proof.getAmount().compareTo(order.getAmount())!=0
                || !order.getCurrency().equalsIgnoreCase(proof.getCurrency()) || proof.hasDisputeRisk())
            throw new IllegalStateException("Preuve d'encaissement incompatible");
        if (payments.findByOrganizationIdAndSourceTypeAndSourceId(org,"UPSELL",id).stream()
                .anyMatch(p -> p.getPaymentType()==TransactionType.REFUND && !BaitlyExternalRefundStore.rejectedBeforeAccounting(p)))
            throw new IllegalStateException("Remboursement en cours ou confirmé : vérifiez la vente");
        validatePlan(stay,order.getFulfillmentServiceCode(),plan);
        var item=catalog.items().stream().filter(i -> order.getFulfillmentServiceCode().equals(i.code())).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Prestation du catalogue inactive"));
        var actor=users.findByKeycloakId(jwt.getSubject()).orElseThrow(() -> new AccessDeniedException("Utilisateur inconnu"));
        var dto=new ServiceRequestDto();
        String title=item.labelFr()+" · "+stay.getProperty().getName();
        dto.title=title.substring(0,Math.min(100,title.length()));
        dto.description=item.labelFr()+", vente #"+id+". Le voyageur a réglé son service. L'accord tarifaire du prestataire suit le parcours habituel.";
        dto.specialInstructions=clean(plan.instructions()); dto.serviceItemCode=order.getFulfillmentServiceCode();
        // Les spécialités sans alias historique passent par OTHER, sans perdre leur référence précise.
        dto.serviceType=ServiceType.valueOf(item.legacyType()); dto.priority=Priority.NORMAL; dto.status=RequestStatus.PENDING;
        dto.desiredDate=plan.start(); dto.estimatedDurationHours=plan.durationHours();
        dto.propertyId=stay.getProperty().getId(); dto.reservationId=stay.getId(); dto.userId=actor.getId();
        var created=requests.create(dto);
        if (created.id==null) throw new IllegalStateException("La demande n'a pas été créée");
        order.setServiceRequestId(created.id); orders.save(order);
        return view(order,stay);
    }

    private ZonedDateTime[] scheduleWindow(Reservation stay, String code) {
        var start=StayTimes.checkInMoment(stay,stay.getProperty());
        var end=StayTimes.checkOutMoment(stay,stay.getProperty());
        if (start!=null && end!=null && transfer(code)) {
            // Un transfert d'arrivée précède le check-in ; un départ peut suivre le check-out.
            start=start.toLocalDate().atStartOfDay(start.getZone());
            end=end.toLocalDate().plusDays(1).atStartOfDay(end.getZone());
        }
        return new ZonedDateTime[]{start,end};
    }

    private void validatePlan(Reservation stay, String code, Schedule plan) {
        if (plan==null || plan.start()==null || plan.durationHours()==null || plan.durationHours()<1 || plan.durationHours()>8
                || (plan.instructions()!=null && plan.instructions().length()>1000)) throw new IllegalArgumentException("Créneau ou consignes invalides");
        if (transfer(code) && clean(plan.instructions()).isBlank())
            throw new IllegalArgumentException("Précisez le lieu de prise en charge et la destination du transfert");
        var window=scheduleWindow(stay,code); var start=window[0]; var end=window[1];
        var at=plan.start().atZone(StayTimes.zoneOf(stay.getProperty()));
        if (!at.toLocalDateTime().equals(plan.start()) || start==null || end==null || at.isBefore(start)
                || at.plusHours(plan.durationHours()).isAfter(end) || !at.toInstant().isAfter(clock.instant())
                || Set.of("cancelled","checked_out").contains(Objects.toString(stay.getStatus(),"").toLowerCase(Locale.ROOT)))
            throw new IllegalArgumentException("Le service doit être prévu à un créneau futur dans la plage autorisée du séjour");
    }

    private ServiceRequest linked(UpsellOrder order, Reservation stay) {
        return needs.findById(order.getServiceRequestId()).filter(r -> order.getOrganizationId().equals(r.getOrganizationId())
            && stay.getId().equals(r.getReservationId()) && r.getProperty()!=null
            && stay.getProperty().getId().equals(r.getProperty().getId())
            && order.getFulfillmentServiceCode()!=null && order.getFulfillmentServiceCode().equals(r.getServiceItemCode()))
            .orElseThrow(() -> new IllegalStateException("Demande liée à rapprocher"));
    }

    private View view(UpsellOrder order, Reservation stay) {
        var need=order.getServiceRequestId()==null ? null : linked(order,stay);
        var work=need==null ? null : interventions.findLinkedForServiceRequests(order.getOrganizationId(),List.of(need.getId()))
            .stream().findFirst().orElse(null);
        var history=need==null ? operations.history(order.getOrganizationId(),"UPSELL",order.getId()) : List.<BaitlyCommerceOperation>of();
        String state=scheduledService(order.getFulfillmentServiceCode()) ? "TO_SCHEDULE" : "TO_ORGANIZE";
        if (!history.isEmpty()) state=switch(history.getLast().getAction()) {
            case "SCHEDULED" -> "CONFIRMED"; case "FULFILLED" -> "COMPLETED";
            case "CANCELLED" -> "CANCELLED"; default -> "TO_ORGANIZE";
        };
        if (need!=null) state=need.getStatus()==RequestStatus.CANCELLED || need.getStatus()==RequestStatus.REJECTED ? "CANCELLED" : "REQUESTED";
        if (work!=null) state=switch(work.getStatus()) {
            case PENDING -> "CONFIRMED"; case IN_PROGRESS -> "IN_PROGRESS";
            case AWAITING_VALIDATION -> "TO_VALIDATE";
            case AWAITING_PAYMENT -> work.getCompletedAt()==null ? "CONFIRMED" : "COMPLETED";
            case COMPLETED -> "COMPLETED"; case CANCELLED -> "CANCELLED";
        };
        if (order.getStatus()!=UpsellOrderStatus.PAID) state=order.getStatus().name();
        var start=StayTimes.checkInMoment(stay,stay.getProperty()); var end=StayTimes.checkOutMoment(stay,stay.getProperty());
        var window=scheduleWindow(stay,order.getFulfillmentServiceCode());
        return new View(order.getId(),order.getTitle(),order.getStatus().name(),state,order.getServiceRequestId(),
            work==null?null:work.getId(),work!=null && work.getScheduledDate()!=null
                ? work.getScheduledDate().atOffset(java.time.ZoneOffset.UTC).atZoneSameInstant(StayTimes.zoneOf(stay.getProperty())).toLocalDateTime()
                : need==null?null:need.getDesiredDate(),
            need==null?null:need.getEstimatedDurationHours(),StayTimes.zoneOf(stay.getProperty()).getId(),
            start==null?null:start.toLocalDateTime(),end==null?null:end.toLocalDateTime(),
            order.getStatus()==UpsellOrderStatus.PAID && need==null && history.isEmpty() && scheduledService(order.getFulfillmentServiceCode()),
            window[0]==null?null:window[0].toLocalDateTime(),window[1]==null?null:window[1].toLocalDateTime());
    }

    public List<GuestView> forGuest(UUID token) {
        var link=tokens.findByToken(token).filter(WelcomeGuideToken::isCurrentlyValid)
            .orElseThrow(() -> new AccessDeniedException("Lien de séjour invalide"));
        if (link.getReservation()==null) return List.of();
        return orders.findByReservationIdOrderByCreatedAtDesc(link.getReservation().getId()).stream()
            .filter(o -> link.getOrganizationId().equals(o.getOrganizationId())
                && link.getReservation().getId().equals(o.getReservationId()))
            .map(o -> view(o,stay(o)))
            .map(v -> new GuestView(v.orderId(),v.title(),v.paymentStatus(),v.state(),v.start(),v.durationHours(),v.timezone())).toList();
    }
    private static String clean(String value) { return value==null?"":value.trim(); }
}
