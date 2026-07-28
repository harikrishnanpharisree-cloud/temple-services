// ============================================================
// supabaseClient.js
// Drop this file in your project src/ folder.
// Replace the two placeholders with your real Supabase values
// from: Supabase Dashboard → Project Settings → API
// ============================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co'; // ← replace
const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';                // ← replace

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ============================================================
// submitBooking
// Call this when the user clicks "Proceed to Pay".
//
// Parameters:
//   validEntries  — array of devotee objects from React state:
//     [ { name, birth_star, date, offeringIds: [1,3,...] }, ... ]
//   grandTotal    — number in rupees (e.g. 1502)
//   OFFERINGS     — the OFFERINGS constant from the React app
//                   (needed to look up names & prices)
//
// Returns:
//   { bookingId }  on success
//   throws         on failure
// ============================================================
export async function submitBooking({ validEntries, grandTotal, OFFERINGS }) {

  // ── Step 1: Create the booking row ──────────────────────
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      grand_total:    grandTotal * 100,   // store as paise
      payment_status: 'pending',
    })
    .select('id')
    .single();

  if (bookingErr) throw new Error('Booking creation failed: ' + bookingErr.message);
  const bookingId = booking.id;

  // ── Step 2: Insert each devotee + their offerings ───────
  for (const dev of validEntries) {
    const subtotal = dev.offeringIds.reduce((s, oid) => {
      return s + (OFFERINGS.find(o => o.id === oid)?.price ?? 0);
    }, 0);

    const { data: devotee, error: devErr } = await supabase
      .from('devotees')
      .insert({
        booking_id:     bookingId,
        name:           dev.name.trim(),
        birth_star:     dev.star,
        preferred_date: dev.date,
        subtotal:       subtotal * 100,   // store as paise
      })
      .select('id')
      .single();

    if (devErr) throw new Error('Devotee insert failed: ' + devErr.message);
    const devoteeId = devotee.id;

    // Insert each selected offering for this devotee
    const offeringRows = dev.offeringIds.map(oid => {
      const off = OFFERINGS.find(o => o.id === oid);
      return {
        devotee_id:    devoteeId,
        offering_id:   oid,
        offering_name: off?.en ?? String(oid),
        price:         (off?.price ?? 0) * 100,  // paise
      };
    });

    const { error: offErr } = await supabase
      .from('devotee_offerings')
      .insert(offeringRows);

    if (offErr) throw new Error('Offerings insert failed: ' + offErr.message);
  }

  return { bookingId };
}

// ============================================================
// confirmPayment
// Call this from your Razorpay webhook handler (Edge Function).
// Updates the booking status to 'confirmed' and stores the
// Razorpay payment/order IDs.
//
// NOTE: Use the SERVICE ROLE key here, not the anon key.
// ============================================================
export async function confirmPayment({ bookingId, razorpayOrderId, razorpayPaymentId }) {
  const { error } = await supabase
    .from('bookings')
    .update({
      payment_status:       'confirmed',
      razorpay_order_id:    razorpayOrderId,
      razorpay_payment_id:  razorpayPaymentId,
    })
    .eq('id', bookingId);

  if (error) throw new Error('Payment confirm failed: ' + error.message);
}

// ============================================================
// markPaymentFailed
// Call from webhook if payment fails.
// ============================================================
export async function markPaymentFailed({ bookingId }) {
  await supabase
    .from('bookings')
    .update({ payment_status: 'failed' })
    .eq('id', bookingId);
}
