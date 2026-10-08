package com.clenzy.model;
import jakarta.persistence.*;

/** Stock commercial par société/entrepôt ; aucune quantité fictive à l'installation. */
@Entity @Table(name="baitly_hardware_stock")
public class BaitlyHardwareStock {
    @Id @Column(length=100) private String id;
    @Column(nullable=false,length=2) private String country;
    @Column(nullable=false,length=80) private String sku;
    @Column(nullable=false) private int available;
    @Column(nullable=false) private int reserved;
    protected BaitlyHardwareStock() {}
    public BaitlyHardwareStock(String country,String sku){this.country=country;this.sku=sku;id=country+":"+sku;}
    public String getId(){return id;}public String getCountry(){return country;}public String getSku(){return sku;}public int getAvailable(){return available;}public int getReserved(){return reserved;}
    public void reserve(int n){if(n<1||n>available)throw new IllegalStateException("Stock insuffisant : "+sku);available-=n;reserved=Math.addExact(reserved,n);}
    public void sell(int n){if(n<1||n>reserved)throw new IllegalStateException("Réserve incohérente");reserved-=n;}
    public void release(int n){sell(n);available=Math.addExact(available,n);}
    public void adjust(int n){int next=Math.addExact(available,n);if(next<0)throw new IllegalStateException("Stock disponible insuffisant");available=next;}
}
