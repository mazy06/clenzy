package com.clenzy.integration.channel;

/**
 * Direction d'une operation de synchronisation.
 */
public enum SyncDirection {
    /** Channel → PMS */
    INBOUND,
    /** PMS → Channel */
    OUTBOUND
}
