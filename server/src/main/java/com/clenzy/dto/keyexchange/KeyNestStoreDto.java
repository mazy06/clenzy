package com.clenzy.dto.keyexchange;

/**
 * DTO representant un point de depot KeyNest trouve par geolocalisation.
 */
public class KeyNestStoreDto {

    private String storeId;
    private String name;
    private String address;
    private Double lat;
    private Double lng;
    private double distanceKm;
    private String openingHours;
    private String type;

    // ─── Getters / Setters ──────────────────────────────────────

    public String getStoreId() { return storeId; }
    public void setStoreId(String storeId) { this.storeId = storeId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Double getLat() { return lat; }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { return lng; }
    public void setLng(Double lng) { this.lng = lng; }

    public double getDistanceKm() { return distanceKm; }
    public void setDistanceKm(double distanceKm) { this.distanceKm = distanceKm; }

    public String getOpeningHours() { return openingHours; }
    public void setOpeningHours(String openingHours) { this.openingHours = openingHours; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
