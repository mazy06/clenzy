package com.clenzy.model;

import com.clenzy.booking.model.BookingServicePricingMode;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Snapshot d'un service optionnel selectionne lors d'une reservation.
 * Les champs prix/nom sont des snapshots car le catalogue peut evoluer apres la reservation.
 */
@Entity
@Table(name = "reservation_service_items",
    indexes = {
        @Index(name = "idx_rsi_reservation", columnList = "reservation_id")
    }
)
public class ReservationServiceItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reservation_id", nullable = false)
    private Reservation reservation;

    @Column(name = "service_item_id")
    private Long serviceItemId;

    @Column(name = "service_item_name", nullable = false, length = 300)
    private String serviceItemName;

    @Column(nullable = false)
    private Integer quantity = 1;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Enumerated(EnumType.STRING)
    @Column(name = "pricing_mode", nullable = false, length = 20)
    private BookingServicePricingMode pricingMode;

    @Column(name = "total_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalPrice;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ─── Getters / Setters ──────────────────────────────────────────────

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Reservation getReservation() { return reservation; }
    public void setReservation(Reservation reservation) { this.reservation = reservation; }

    public Long getServiceItemId() { return serviceItemId; }
    public void setServiceItemId(Long serviceItemId) { this.serviceItemId = serviceItemId; }

    public String getServiceItemName() { return serviceItemName; }
    public void setServiceItemName(String serviceItemName) { this.serviceItemName = serviceItemName; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public BookingServicePricingMode getPricingMode() { return pricingMode; }
    public void setPricingMode(BookingServicePricingMode pricingMode) { this.pricingMode = pricingMode; }

    public BigDecimal getTotalPrice() { return totalPrice; }
    public void setTotalPrice(BigDecimal totalPrice) { this.totalPrice = totalPrice; }

    public LocalDateTime getCreatedAt() { return createdAt; }
}
