// ============================================================
// Supabase Edge Function: razorpay-webhook
//
// Deploy with:
//   supabase functions deploy razorpay-webhook
//
// Set secrets with:
//   supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_secret
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_key
//
// Then in Razorpay Dashboard → Webhooks, point to:
//   https://YOUR_PROJECT_ID.supabase.co/functions/v1/razorpay-webhook
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac }   from 'https://deno.land/std/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!   // service role — can update rows
);

Deno.serve(async (req) => {
  const body      = await req.text();
  const signature = req.headers.get('x-razorpay-signature') ?? '';
  const secret    = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

  // ── 1. Verify Razorpay signature ───────────────────────
  const expected = createHmac('sha256', secret)
    .update(body)
    .toString('hex');

  if (expected !== signature) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── 2. Parse event ─────────────────────────────────────
  const event = JSON.parse(body);

  if (event.event === 'payment.captured') {
    const payment  = event.payload.payment.entity;
    const orderId  = payment.order_id;
    const paymentId = payment.id;

    // The booking_id was stored in Razorpay order notes when the
    // order was created (see TODO in temple-app.jsx handlePay)
    const bookingId = payment.notes?.booking_id;

    if (bookingId) {
      await supabase.from('bookings').update({
        payment_status:      'confirmed',
        razorpay_order_id:   orderId,
        razorpay_payment_id: paymentId,
      }).eq('id', bookingId);
    }
  }

  if (event.event === 'payment.failed') {
    const bookingId = event.payload.payment.entity.notes?.booking_id;
    if (bookingId) {
      await supabase.from('bookings')
        .update({ payment_status: 'failed' })
        .eq('id', bookingId);
    }
  }

  return new Response('OK', { status: 200 });
});
