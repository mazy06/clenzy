package com.clenzy.integration.airbnb.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * DTO for calendar synchronization events between Clenzy and Airbnb.
 */
public class AirbnbCalendarEventDto {

    private String listingId;
    private LocalDate date;
    private boolean available;
    private BigDecimal price;
    private int minimumStay;
    private String notes;

    public AirbnbCalendarEventDto() {
    }

    public String getListingId() {
        return listingId;
    }

    public void setListingId(String listingId) {
        this.listingId = listingId;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public int getMinimumStay() {
        return minimumStay;
    }

    public void setMinimumStay(int minimumStay) {
        this.minimumStay = minimumStay;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }
}
