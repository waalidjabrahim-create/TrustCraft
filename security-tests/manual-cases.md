# Security regression cases (run with Firebase Emulator Suite)

1. Anonymous user cannot read providers, bookings, verification requests or commission ledger.
2. Signed-in non-admin can read published provider listings only.
3. Provider without verified phone cannot create a listing.
4. Provider cannot create a published listing or set `verificationTier`.
5. Provider cannot change `published` or `verificationTier` after creation.
6. Admin cannot publish a provider before the verification request is approved.
7. A client cannot read another client's booking or booking contact.
8. A provider cannot read booking contact while status is `pending`.
9. After provider changes booking to `confirmed`, provider can read booking contact and client can see provider WhatsApp only if provider opted in.
10. A review cannot be created without a completed booking owned by the author; one review per booking ID.
11. Client cannot create/update/delete commission ledger documents.
12. Identity document storage object is readable only by an admin; owner can upload only allowed types/size.
