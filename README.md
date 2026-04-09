# Motel Booking App v2

This is a custom **Next.js + Supabase + Stripe** starter project for a 6-room motel that wants:
- its own website booking app
- guest-facing flat rates only
- hidden internal tax and fee bookkeeping
- a visual admin calendar with drag-and-drop moves
- room management now
- RV spot support later

## What this project does already
- booking page with date search
- room selection
- temporary booking holds
- Stripe Checkout session creation
- Stripe webhook route
- admin bookings page
- admin rooms page
- admin reports page
- drag-and-drop admin calendar
- database structure for rooms and future RV spots
- internal line items for:
  - local tax 7%
  - state tax 1.5%
  - processing fee 2.9% + $0.30

## Important reality
This is a **strong starter system**, not a completed production launch by itself.
You still need to:
1. create Supabase project
2. run the SQL files
3. add environment variables
4. create Stripe account and webhook
5. protect admin routes with real auth
6. test end to end
7. deploy to commercial hosting
8. embed the app in Duda

## Folder map
- `app/book` guest booking flow
- `app/admin/calendar` visual drag-and-drop admin calendar
- `app/admin/bookings` reservation list
- `app/admin/rooms` room list
- `app/admin/reports` internal summary report
- `app/api/*` API routes
- `sql/schema.sql` Supabase database structure
- `sql/seed.sql` sample room data

## Beginner setup order
### 1. Install Node.js
Install a current LTS version.

### 2. Create Supabase project
Copy:
- project URL
- anon key
- service role key

### 3. Run SQL
Run `sql/schema.sql`, then `sql/seed.sql` in the Supabase SQL editor.

### 4. Create `.env.local`
Copy `.env.example` to `.env.local` and fill in the values.

### 5. Install packages
```bash
npm install
```

### 6. Run locally
```bash
npm run dev
```
Then open `http://localhost:3000`.

### 7. Stripe
Create a Stripe account and add:
- secret key
- publishable key
- webhook secret

### 8. Deploy
Because you are taking bookings for a business, use **commercial hosting**.
Vercel Hobby is not appropriate for commercial production use.
Use Vercel Pro or Cloudflare Pages for production.

### 9. Embed in Duda
Use an HTML widget and paste:
```html
<iframe
  src="https://book.yourdomain.com"
  style="width:100%;height:1500px;border:0"
  loading="lazy"
></iframe>
```

## What to improve next
- real admin login with Supabase Auth
- room image upload UI to Supabase Storage
- seasonal rate editor
- blocks / maintenance UI
- cancellation and refund UI
- CSV export
- confirmation email sending
- occupancy and ADR reports
- housekeeping board

## Recommended next step
After downloading this project, set up Supabase first. Once the SQL is running, move to Stripe and deployment.
