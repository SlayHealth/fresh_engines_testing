// Shared read-only sample account behind the one-click "live demo" login on the
// sign-in page (lets judges/visitors explore a pre-populated report without an
// OTP). Resolved server-side so the client never sends or receives the real
// phone number. Override via env; falls back to the seeded sample account.
const DEMO_ACCOUNT_PHONE = process.env.DEMO_ACCOUNT_PHONE || '+917063992027';
// What the client sees instead of the demo account's real number, everywhere a
// user object is returned (profile UI + any network payload).
const DEMO_DISPLAY_PHONE = 'Demo account';

module.exports = { DEMO_ACCOUNT_PHONE, DEMO_DISPLAY_PHONE };
