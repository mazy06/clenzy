package com.clenzy.service.agent;

import com.clenzy.service.agent.tools.*;
import java.util.Map;

/** Explicit local query implementations, not names supplied by a model or arbitrary descriptors. */
final class BaitlyChatReadBindings {
    private static final Map<Class<?>,String> TYPES=Map.ofEntries(
        Map.entry(ListPropertiesTool.class,"list_properties"),Map.entry(ListReservationsTool.class,"list_reservations"),
        Map.entry(ListInvoicesTool.class,"list_invoices"),Map.entry(ListGuestsTool.class,"list_guests"),
        Map.entry(ListReviewsTool.class,"list_reviews"),Map.entry(GetNoiseAlertsTool.class,"get_noise_alerts"),
        Map.entry(GetPropertyAmenitiesTool.class,"get_property_amenities"),Map.entry(GetChannelSyncStatusTool.class,"get_channel_sync_status"),
        Map.entry(GetOwnerPayoutSummaryTool.class,"get_owner_payout_summary"));
    private BaitlyChatReadBindings() {}
    static String name(ToolHandler handler) {
        if(handler==null) return null;
        String name=TYPES.get(handler.getClass());
        return name!=null && name.equals(handler.name()) && handler.descriptor()!=null
            && name.equals(handler.descriptor().name()) && !handler.descriptor().requiresConfirmation()?name:null;
    }
}
