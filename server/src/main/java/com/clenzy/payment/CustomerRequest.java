package com.clenzy.payment;

public record CustomerRequest(
    String email,
    String name,
    String country,
    String phone
) {}
