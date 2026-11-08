# WeeDeliver 🛵🌿

South Africa's Most Reliable Cannabis Delivery Platform — Full Stack Monorepo

## Architecture

```
weedeliver/
├── client/               ← React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── App.jsx           ← Full SPA (all pages, components, state)
│   │   ├── api.js            ← API client (connects to backend)
│   │   ├── main.jsx          ← Entry point
│   │   └── index.css         ← Tailwind
│   ├── package.json
│   └── vite.config.js        ← Dev proxy to backend
│
├── server/               ← Node.js + Express + Prisma + Socket.io backend
│   ├── prisma/
│   │   ├── schema.prisma     ← 12 database models
│   │   └── seed.ts           ← Demo data with operating hours
│   ├── src/
│   │   ├── server.ts         ← HTTP + WebSocket entry
│   │   ├── app.ts            ← Express routes
│   │   ├── socket.ts         ← Real-time tracking
│   │   ├── prisma.ts         ← DB client
│   │   ├── utils.ts          ← Helpers: isDispensaryOpen, Haversine, AES-256, webhook verification
│   │   ├── routes/
│   │   │   ├── auth.ts       ← JWT auth + refresh tokens
│   │   │   ├── dispensaries.ts ← Geolocation + trading hours + banking
│   │   │   ├── products.ts   ← CRUD + image upload
│   │   │   ├── orders.ts     ← State machine + closed-dispensary enforcement
│   │   │   ├── memberships.ts ← Apply/approve/reject
│   │   │   ├── payments.ts   ← Yoco + Paystack + SnapScan + webhooks
│   │   │   ├── tracking.ts   ← Driver GPS
│   │   │   └── admin.ts      ← Analytics + payouts (15% commission)
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   └── orderService.ts ← Trading hours enforcement
│   │   └── middleware/
│   │       ├── auth.ts
│   │       ├── guards.ts
│   │       └── upload.ts
│   └── package.json
│
├── package.json          ← Root scripts (runs both)
└── README.md
```

## Quick Start

### 1. Install everything
```bash
npm run install:all
```

### 2. Set up database
```bash
cp server/.env.example server/.env
# Edit server/.env → set DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY

npm run db:push    # Push schema to PostgreSQL
npm run db:seed    # Seed demo data (includes operating hours)
```

### 3. Run both frontend + backend
```bash
npm run dev
```
- **Frontend** → `http://localhost:5173`
- **Backend** → `http://localhost:3000`
- Vite proxy forwards `/api/*` → backend

### Demo Accounts (password: `password123`)
| Role | Email |
|------|-------|
| Customer | customer@test.com |
| Dispensary | dispensary@test.com |
| Driver | driver@test.com |
| Admin | admin@weedeliver.co.za |

---

## Features Implemented

### Feature 1: Geolocation Dispensary Listing
- `GET /api/v1/dispensaries?lat=X&lng=Y&radius=50` — Haversine distance filter + sort
- Each dispensary response includes `isOpen` boolean and `distance` in km
- Frontend: location permission modal → "Allow Location" / "Skip"
- Dispensary cards show: name, distance, delivery fee, delivery time, open/closed badge, rating
- Closed dispensaries appear dimmed and are not orderable

### Feature 2: Trading Hours (Open/Closed Enforcement)
- Dispensary dashboard: 7-day trading hours editor (Mon-Sun)
- Each day: toggle (open/closed) + open time + close time (24h format)
- `operatingHours` stored as JSON: `{ "mon": { "open": "08:00", "close": "22:00", "isOpen": true }, ... }`
- Server-side `isDispensaryOpen()` utility (Africa/Johannesburg timezone)
- Order creation blocked if dispensary is closed (HTTP 400)
- Frontend: closed banner, greyed-out "Add to Cart", checkout prevention

### Feature 3: South African Payment Integration

#### 3A — Stitch (Card + Pay by Bank)
- `GET /api/v1/payments/providers` → the online providers the server has credentials for; checkout only offers these
- `POST /api/v1/payments/initiate` with `{ orderId, provider: "STITCH" }` → creates a Stitch payment request and returns its hosted `redirectUrl`
- Stitch sends the payer back to `/payment/callback?provider=stitch&paymentId=…` → frontend calls `/verify/stitch`
- Webhook: `POST /api/v1/payments/webhook/stitch` (Svix HMAC-SHA256, 5-minute replay window) — the source of truth; a completed payment is only accepted if the paid amount matches the order
- Client code lives in `server/src/services/stitch.ts` (unit tests: `npm test` in `server/`)

#### 3B — iKhokha (Card + EFT)
- `POST /api/v1/payments/initiate` with `{ orderId, provider: "IKHOKHA" }` → returns a paylink `redirectUrl`
- Server-to-server callback: `POST /api/v1/payments/webhook/ikhokha` (HMAC-SHA256)

#### 3C — SnapScan (QR Code)
- `POST /api/v1/payments/initiate` with `{ orderId, provider: "SNAPSCAN" }` → returns QR URL
- Frontend renders QR code + polls `GET /api/v1/payments/status/:orderId` every 5s

#### 3D — Bank Account Linkage (Payouts)
- `PUT /api/v1/dispensaries/:id/banking` — AES-256 encrypted account numbers
- Banks: ABSA, FNB, Standard Bank, Nedbank, Capitec, Investec, TymeBank, African Bank
- Admin: `GET /api/v1/admin/payouts` — lists dispensaries with earnings
- Admin: `POST /api/v1/admin/payouts` — creates payout (15% commission deducted)
- SendGrid email notification to dispensary owner on payout

---

## Database Models (Prisma)

| Model | Description |
|-------|-------------|
| User | All user roles (CUSTOMER, DISPENSARY, DRIVER, ADMIN) |
| Dispensary | Store profile + operatingHours JSON + geolocation |
| Product | Menu items with THC/CBD/strain info |
| Order | Full state machine with timestamps |
| OrderItem | Line items per order |
| Payment | Stitch/iKhokha/SnapScan/EFT transaction log |
| Membership | FREE/PAID/UPLOAD_PROOF per dispensary |
| DeliveryTracking | Real-time driver GPS |
| Driver | Driver profile + stats |
| DispensaryBanking | AES-256 encrypted bank details |
| Payout | Manual EFT payouts with 15% commission |
| SupportTicket | Customer support |

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/register | — | Register |
| POST | /auth/login | — | Login |
| POST | /auth/verify-age | JWT | Age check |
| GET | /dispensaries | — | List (+ geolocation + isOpen) |
| GET | /dispensaries/:slug | — | Detail (+ isOpen) |
| PUT | /dispensaries/:id | Owner | Update (incl. operatingHours) |
| PUT | /dispensaries/:id/banking | Owner | Save banking details |
| GET | /dispensaries/:id/banking | Owner | Get masked banking |
| POST | /products | DISPENSARY | Create product |
| POST | /orders | CUSTOMER | Place order (enforces trading hours) |
| GET | /payments/providers | — | Online providers that are configured |
| POST | /payments/initiate | Auth | Start Stitch/iKhokha/SnapScan |
| POST | /payments/verify/stitch | Auth | Check a Stitch payment request |
| POST | /payments/verify/ikhokha | Auth | Report a recorded iKhokha result |
| GET | /payments/status/:orderId | Auth | Poll SnapScan status |
| POST | /payments/webhook/stitch | — | Stitch webhook (Svix-signed) |
| POST | /payments/webhook/ikhokha | — | iKhokha callback (HMAC-signed) |
| GET | /admin/payouts | ADMIN | List dispensary payouts |
| POST | /admin/payouts | ADMIN | Create payout |

All routes prefixed with `/api/v1/`.

---

## Deploy

### Frontend → Vercel
1. Set Root Directory: `client`
2. Add env var: `VITE_API_URL` = Railway backend URL

### Backend → Railway
1. Set Root Directory: `server`
2. Add PostgreSQL service
3. Copy env vars from `.env.example`
4. Set `CLIENT_URL` = Vercel frontend URL

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| DATABASE_URL | PostgreSQL connection string |
| JWT_SECRET | JWT signing secret |
| JWT_REFRESH_SECRET | Refresh token secret |
| STITCH_CLIENT_ID / STITCH_CLIENT_SECRET | Stitch API client credentials (stitch.money) |
| STITCH_WEBHOOK_SECRET | `whsec_…` signing secret for `/payments/webhook/stitch` |
| STITCH_BENEFICIARY_NAME / _BANK_ID / _ACCOUNT_NUMBER | Bank account Stitch pays into |
| STITCH_PAYMENT_METHODS | Optional, default `card,eft` |
| SNAPSCAN_API_KEY | SnapScan merchant key |
| ENCRYPTION_KEY | 32-char AES-256 key for banking encryption |
| SENDGRID_API_KEY | For payout email notifications |
| CLIENT_URL | Frontend URL (CORS + callbacks) |

## Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts
- **Backend**: Express, Prisma ORM, PostgreSQL, Socket.io, JWT, Zod
- **Payments**: Stitch (card + Pay by Bank), iKhokha (card + EFT), SnapScan (QR), manual EFT payouts
- **Security**: AES-256 banking encryption, HMAC webhook verification, JWT refresh tokens
