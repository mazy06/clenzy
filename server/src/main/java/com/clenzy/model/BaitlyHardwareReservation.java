package com.clenzy.model;
import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name="baitly_hardware_reservations",uniqueConstraints=@UniqueConstraint(columnNames={"order_id","stock_id"}))
public class BaitlyHardwareReservation {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="organization_id",nullable=false) private Long organizationId;
    @Column(name="order_id",nullable=false) private Long orderId;
    @Column(name="stock_id",nullable=false,length=100) private String stockId;
    @Column(nullable=false) private int quantity;
    @Column(nullable=false,length=20) private String state="HELD";
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyHardwareReservation() {}
    public BaitlyHardwareReservation(Long org,Long order,String stock,int quantity){organizationId=org;orderId=order;stockId=stock;this.quantity=quantity;}
    public Long getOrganizationId(){return organizationId;}public Long getOrderId(){return orderId;}public String getStockId(){return stockId;}public int getQuantity(){return quantity;}public String getState(){return state;}public Instant getCreatedAt(){return createdAt;}
    public void state(String value){state=value;}
}
