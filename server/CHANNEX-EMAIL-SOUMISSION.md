# Mail à envoyer après la soumission du formulaire

> À copier tel quel vers `support@channex.io`. Leur page d'accueil demande cette
> copie ; le formulaire seul ne programme pas l'appel de certification.

**À :** support@channex.io
**Objet :** Certification form resubmitted — Baitly PMS (property 789973a4-dabb-4a35-988b-5670ff4c103c)

---

Hello,

We have resubmitted the PMS certification form for **Baitly**, following the
review feedback we received on 14 August 2026.

- **PMS:** Baitly
- **Test property:** Test Property - Baitly
- **Channex property ID:** `789973a4-dabb-4a35-988b-5670ff4c103c`
- **Channel used for testing:** Booking.com

All four issues raised in the review have been fixed and every test case was
replayed against our staging environment before resubmitting, one scenario at a
time:

1. Price and restriction updates no longer push availability. The scope of each
   push is now derived from the calendar action, so a rate change sends only
   `rates` and a booking sends only `availability`.
2. Restrictions are now sent complete: min stay falls back to the property
   defaults instead of being omitted.
3. Blocked dates now send `stop_sell: true` and leave availability at 1. Only a
   booking consumes inventory. Test case #6 is therefore applicable — we had
   declared it not applicable in error, and it is answered in this submission.
4. Webhook deliveries were failing because the registered callback URL was
   missing its path. The full path is now enforced and deliveries are confirmed.

The task IDs in the new submission all come from this replay, and each action
produces exactly one task on the expected channel.

Could you let us know the next step for scheduling the certification call? We
are available at your convenience and will drive the whole flow from the Baitly
interface during the screenshare.

Thank you,

Toufik Mazy — Baitly
