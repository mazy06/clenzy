package com.clenzy.dto;

import java.math.BigDecimal;

/** Les douze points du graphique annuel Baitly, déjà calculés. */
public record MonthlyRevenueSplitDto(String month, String currency, BigDecimal revenue,
                                    BigDecimal fees, BigDecimal interventions,
                                    BigDecimal payout, BigDecimal retained) {}
