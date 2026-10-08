package com.clenzy.model;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="baitly_hardware_stock_changes",uniqueConstraints=@UniqueConstraint(columnNames="request_id"))
public class BaitlyHardwareStockChange {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="stock_id",nullable=false,length=100) private String stockId;
    @Column(name="request_id",nullable=false) private UUID requestId;
    @Column(nullable=false) private int delta;
    @Column(name="before_quantity",nullable=false) private int beforeQuantity;
    @Column(nullable=false,length=255) private String proof;
    @Column(nullable=false,length=255) private String actor;
    @Column(name="created_at",nullable=false) private Instant createdAt=Instant.now();
    protected BaitlyHardwareStockChange(){}
    public BaitlyHardwareStockChange(String stock,UUID request,int delta,int before,String proof,String actor){stockId=stock;requestId=request;this.delta=delta;beforeQuantity=before;this.proof=proof;this.actor=actor;}
    public String getStockId(){return stockId;}public UUID getRequestId(){return requestId;}public int getDelta(){return delta;}public int getBeforeQuantity(){return beforeQuantity;}public String getProof(){return proof;}
}
