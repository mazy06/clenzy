package com.clenzy.dto;

import java.util.List;

public record ShopCheckoutRequest(List<CartItem> items) {

    public record CartItem(String sku, int quantity) {}
}
