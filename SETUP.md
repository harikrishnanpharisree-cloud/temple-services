# Panackal Bhadrakali Devi Temple — Backend Setup Guide
## Supabase + Razorpay + Vercel (₹0/month)

---

## What you'll have when done

```
Devotee selects offerings
        ↓
React app saves booking to Supabase (status: pending)
        ↓
Razorpay payment popup opens
        ↓
Devotee pays
        ↓
Razorpay calls your webhook (Supabase Edge Function)
        ↓
Booking marked as "confirmed" in database
        ↓
Temple admin views all confirmed bookings in Supabase dashboard
```

---

## Step 1 — Create your Supabase project

1. Go to https://supabase.com and sign up (free)
2. Click **New Project**
3. Name it: `panackal-temple`
4. Choose region: **South Asia (Mumbai)** ← closest to Kerala
5. Set a strong database password and save it somewhere safe
6. Wait ~2 minutes for the project to spin up

---

## Step 2 — Run the database schema

1. In Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase-schema.sql` (provided)
4. Paste the entire contents and click **Run**
5. You should see: `Success. No rows returned`

To verify, click **Table Editor** — you should see three tables:
`bookings`, `devotees`, `devotee_offerings`

---

## Step 3 — Get your API keys

1. Go to **Project Settings → API** in your Supabase dashboard
2. Copy two values:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon public** key → long string starting with `eyJ...`
3. Open `temple-app.jsx` and replace:
   ```js
   const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co'; // ← paste URL
   const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';                // ← paste key
   ```

---

## Step 4 — Install the Supabase package

In your project folder, run:
```bash
npm install @supabase/supabase-js
```

---

## Step 5 — Keep your project alive (free tier)

Free Supabase projects pause after 7 days of inactivity. Fix this in 2 minutes:

1. Go to https://cron-job.org and create a free account
2. Click **Create cronjob**
3. URL: `https://YOUR_PROJECT_ID.supabase.co/rest/v1/bookings?limit=1`
4. Add header: `apikey: YOUR_ANON_PUBLIC_KEY`
5. Schedule: Every 3 days
6. Save → your project will never sleep

---

## Step 6 — Set up Razorpay (payment gateway)

1. Go to https://razorpay.com and create a free account
2. Complete KYC with the temple trust's details
3. Go to **Settings → API Keys → Generate Key**
4. Save your **Key ID** and **Key Secret**
5. In `temple-app.jsx`, find the `handlePay` function and add:

```js
const handlePay = async () => {
  setSubmitting(true);
  try {
    // 1. Save booking to Supabase
    const id = await submitBooking(validEntries, grandTotal);
    setBookingId(id);

    // 2. Create Razorpay order (call your own backend or Edge Function)
    //    Pass booking_id in notes so the webhook can match it
    const options = {
      key: 'rzp_live_YOUR_KEY_ID',
      amount: grandTotal * 100,          // paise
      currency: 'INR',
      name: 'Panackal Bhadrakali Devi Temple',
      description: 'Vazhipadu Booking',
      notes: { booking_id: id },
      handler: function(response) {
        // Payment succeeded on client side
        // The webhook will confirm it in Supabase
        setShowModal(true);
      },
      prefill: { name: validEntries[0]?.name },
      theme: { color: '#6B0F1A' },       // temple maroon
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  } catch (err) {
    setSubmitError('Booking failed. Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

6. Add Razorpay script to your `index.html`:
```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## Step 7 — Deploy the Razorpay webhook (Edge Function)

1. Install Supabase CLI:
```bash
npm install -g supabase
supabase login
```

2. Link your project:
```bash
supabase link --project-ref YOUR_PROJECT_ID
```

3. Deploy the webhook function:
```bash
supabase functions deploy razorpay-webhook
```

4. Set secrets:
```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

5. In Razorpay Dashboard → **Settings → Webhooks → Add Webhook**:
   - URL: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/razorpay-webhook`
   - Events: ✅ `payment.captured` ✅ `payment.failed`
   - Set the same webhook secret you used above

---

## Step 8 — Deploy the React app (free on Vercel)

1. Push your code to GitHub
2. Go to https://vercel.com → **New Project** → Import your repo
3. Framework: **Vite** (or Create React App)
4. Click Deploy → you get a free `.vercel.app` URL instantly

---

## Step 9 — View bookings (Admin)

No separate admin panel needed to start with:

1. Go to your Supabase dashboard
2. Click **Table Editor → bookings** to see all bookings
3. Or run this query in SQL Editor to see a full report:

```sql
SELECT * FROM booking_summary
WHERE payment_status = 'confirmed'
ORDER BY preferred_date;
```

To filter by a specific date (e.g. festival day):
```sql
SELECT * FROM booking_summary
WHERE preferred_date = '2026-03-14'
  AND payment_status = 'confirmed';
```

---

## Monthly Cost Summary

| Service | Cost |
|---|---|
| Supabase (free tier) | ₹0 |
| Vercel (free tier) | ₹0 |
| cron-job.org | ₹0 |
| Razorpay | ₹0 fixed + ~2% per transaction |
| **Total fixed cost** | **₹0/month** |

Razorpay's 2% fee is deducted from each payment — no monthly charge.
For ₹1,000 of offerings, the temple receives ₹980.

---

## Files provided

| File | Purpose |
|---|---|
| `temple-app.jsx` | React frontend with Supabase integrated |
| `supabase-schema.sql` | Run once in Supabase SQL Editor |
| `supabaseClient.js` | Reusable Supabase functions (optional) |
| `razorpay-webhook/index.ts` | Supabase Edge Function for payment confirmation |
| `SETUP.md` | This guide |
