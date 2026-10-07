package com.clenzy.dto;

import java.util.List;

public record ShopCheckoutRequest(List<CartItem> items,java.util.UUID requestId) {
    public ShopCheckoutRequest(List<CartItem> items){this(items,java.util.UUID.randomUUID());}

    public record CartItem(String sku, int quantity) {}
}
