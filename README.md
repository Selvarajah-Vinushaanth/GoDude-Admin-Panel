# GoDude Enterprise Admin Panel

Centralized administrative control plane for the **GoDude** Sri Lanka mobility, food delivery, and parcel logistics platform. Built with Next.js App Router, TypeScript, Tailwind CSS, and PostgreSQL/PostGIS, operating directly on the shared GoDude database and backend workflows.

---

## Key Modules

1. **Restricted Admin-Only Authentication (`/login`)**
   - Login-only access with salted `scrypt` credential verification and HMAC-SHA256 signed `HttpOnly` cookies.
   - Zero public sign-up or registration endpoints.
   - Blocks ordinary `customer`, `driver`, `merchant`, and `partner` accounts even if matching credentials exist.
   - Automatic route protection via Edge `middleware.ts` and server-side session guards on all pages and `/api/*` handlers.

2. **Executive Dashboard (`/`)**
   - Live KPIs directly from PostgreSQL: Customers, Riders (online/available/active/unverified), Restaurants (open/pending), Rides, Food Orders, Parcel Deliveries, Transactions, Verified Revenue, Platform Commission, Rider Earnings, and 10% Savings Credits.
   - Interactive 14-day multi-service volume & revenue chart, unified `driver_state` distribution, pending approval queues, recent bookings, and recent registrations.

3. **Customer Management (`/customers`)**
   - Server-side pagination, search, role filtering, and sorting.
   - Full customer inspection drawer: profile details, saved delivery addresses, linked Sri Lankan bank accounts, ride history, food order history, parcel history, payment transactions, and 10% savings ledger.

4. **Rider & Driver Operations (`/riders`)**
   - Filterable by verification status (`pending`, `approved`, `online`, `on_trip`, `suspended`) and vehicle category (`bike`, `tuktuk`, `car`).
   - Full inspection drawer: personal details, driver license number, vehicle model & plate, GPS ping telemetry, trip history, dispatch offers, and rider earnings.
   - Admin workflows: Approve verification, Reject verification with reason, Send verification feedback, Suspend / Restore availability (respecting active-trip assignment locks), and Recalculate unified availability state.

5. **Restaurant Onboarding & Approval (`/restaurants`)**
   - Dedicated workflow queue (`Pending Approvals`, `Approved`, `Rejected`, `Suspended`).
   - Application review drawer displaying business details, owner account info, operating hours, GPS coverage, full menu (`food_items` + `food_addons`), recent orders, and audit/notification history.
   - One-click **Approve** (with editable commission %), **Reject** (with required reason), **Request Additional Info** (keeps pending & notifies owner), **Suspend**, and **Open/Close Kitchen** synced with the GoDude backend API and `notifications` infrastructure.

6. **Service Operations (`/rides`, `/food-orders`, `/parcels`)**
   - Paginated operational tables with date-range filtering, status tabs, sorting, and search.
   - Deep inspection drawers with fare breakdown, food order line-item customizations/instructions, parcel sender/recipient custody details, OTP verification timestamps, parcel lifecycle timeline (`parcel_status_history`), Admin Parcel Reassignment, and Admin Cancellation & Refund.

7. **Finance & Transactions (`/finance`)**
   - Direct visibility into `payment_transactions` joined with bookings and customers, filtered by payment status (`verified`, `pending`, `refunded`, `failed`), service type, and date range, plus commission and refund totals.

8. **Notifications & Platform Settings (`/notifications`, `/settings`)**
   - Targeted instruction composer delivering real persistent notices to Restaurant Owners, Riders, and Customers via GoDude's `notifications` table.
   - Live management for `vehicle_types` pricing tiers, `delivery_config`, Sri Lanka `delivery_zones`, `parcel_config`, and `admin_audit_logs`.

---

## Project Architecture

```text
godude-admin-panel/
├── app/
│   ├── (admin)/             # Auth-protected admin pages (App Router)
│   ├── api/                 # Server route handlers for auth, metrics & admin actions
│   └── login/               # Standalone administrator login page (no public signup)
├── components/
│   ├── ui/                  # Reusable DataTable, Drawer, ActionConfirmDialog, StatusBadge, Toast
│   ├── views/               # Client workspaces for each module
│   ├── AdminShell.tsx       # Light-theme sidebar, frosted header & notification center
│   └── Charts.tsx           # Interactive 14-day stacked volume/revenue chart
├── lib/
│   ├── auth.ts              # Scrypt verifier, signed sessions, allowlist & backend JWT minter
│   ├── db.ts                # PostgreSQL connection pool
│   ├── format.ts            # LKR & Asia/Colombo formatters + pagination parser
│   ├── godude-api.ts        # Bridge to GoDude backend /api/admin/* workflows
│   └── services/            # Parameterized PostgreSQL queries & domain workflows
├── middleware.ts            # Unauthenticated redirection & API 401 protection
└── tests/                   # Automated auth & database integration tests
```

---

## Database & Backend Connectivity

`godude-admin-panel` connects directly to the **existing** GoDude PostgreSQL + PostGIS database (`DATABASE_URL`) without creating duplicate databases or altering existing tables. Administrative mutations also bridge to the existing GoDude backend API (`GODUDE_API_URL`) using a short-lived admin JWT signed with `JWT_ACCESS_SECRET` so Socket.IO real-time events (`catalog:updated`, dispatch updates) stay synchronized with customer and partner apps.

---

## Local Setup & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   Generate a salted `scrypt` password hash for `.env`:
   ```bash
   node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');const h=c.scryptSync('YourStrongPassword!',s,64).toString('hex');console.log('scrypt:'+s+':'+h)"
   ```
   Fill in `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `JWT_ACCESS_SECRET`, `GODUDE_API_URL`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` inside `.env`.

3. **Run development server:**
   ```bash
   npm run dev
   ```
   Access at `http://localhost:3100/login`.

4. **Verify types, lint, build & tests:**
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   npm test
   ```

---

## Production Deployment

1. Provision Node.js 20+ behind Nginx / Cloudflare TLS on the operations host or Cloud Run.
2. Set production environment variables (`DATABASE_URL`, `GODUDE_API_URL=https://api.godude.rodeo`, `JWT_ACCESS_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `COOKIE_SECURE=true`).
3. Ensure an administrator record (`role = 'admin'`) exists in GoDude's `users` table and your admin allowlist email/hash is configured.
4. Build and start:
   ```bash
   npm ci
   npm run build
   npm run start
   ```
