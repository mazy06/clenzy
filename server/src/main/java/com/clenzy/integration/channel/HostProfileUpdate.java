package com.clenzy.integration.channel;

/**
 * Snapshot of a host user's profile pushed to an OTA channel.
 *
 * <p>Only fields that are universally meaningful across channels live here. Channel-specific
 * extensions (e.g. Airbnb bio) can be carried in a follow-up payload — the OTA adapter pulls
 * them from the user repository when needed.</p>
 *
 * @param userId            internal PMS user id
 * @param firstName         host first name
 * @param lastName          host last name
 * @param email             contact email (some channels require it)
 * @param phoneNumber       contact phone (E.164 if available)
 * @param profilePictureUrl public URL of the profile picture (served by the PMS),
 *                          or {@code null} to clear the photo on the channel side
 */
public record HostProfileUpdate(
        Long userId,
        String firstName,
        String lastName,
        String email,
        String phoneNumber,
        String profilePictureUrl
) {
}
