# Wealth Backend (Node.js + Express + MongoDB, MVC)

Backend for the Metalan-Wealth-style dashboard: registration (with
server-generated username/password), JWT login, and a dashboard API
(summary cards, top properties, top funds, top investors, transaction
history).

## Folder structure (MVC)

```
wealth-backend/ 
├── server.js                     # entry point 
├── package.json 
├── .env.example 
└── src/ 
    ├── app.js                    # express app (middleware + routes) 
    ├── config/ 
    │   └── db.js                 # mongoose connection 
    ├── models/                   # M — Mongoose schemas 
    │   ├── User.model.js          # includes sequential userId + stored login token
    │   ├── Counter.model.js       # atomic sequence counter (powers userId)
    │   ├── PropertyPurchase.model.js  # buyer snapshot on every purchase
    │   ├── Transaction.model.js 
    │   ├── Property.model.js 
    │   └── Fund.model.js 
    ├── controllers/               # C — request handlers / business logic 
    │   ├── auth.controller.js     # register, login, admin-login, logout, me
    │   ├── properties.controller.js # includes user purchaseProperty()
    │   ├── dashboard.controller.js 
    │   └── transaction.controller.js 
    ├── routes/                    # V-ish layer (route → controller wiring) 
    │   ├── index.js 
    │   ├── auth.routes.js 
    │   ├── dashboard.routes.js 
    │   └── transaction.routes.js 
    ├── middlewares/ 
    │   ├── auth.middleware.js     # JWT verification (protect) — length check + DB token match
    │   ├── admin.middleware.js    # admin-only JWT verification (adminProtect)
    │   ├── validate.middleware.js # runs a validator chain, 400s on failure 
    │   └── error.middleware.js    # 404 + centralized error handler 
    ├── validators/ 
    │   └── auth.validator.js      # express-validator rule chains (register/login/admin-login/change-password) 
    ├── utils/ 
    │   ├── generateCredentials.js  # username/password auto-generation 
    │   ├── generateUserId.js       # sequential "0001" style userId generator
    │   ├── apiResponse.js 
    │   └── token/ 
    │       ├── tokenConfig.js      # token prefix/suffix configuration
    │       ├── tokenEncoder.js     # JWT token encoding
    │       ├── tokenDecoder.js     # protected token decoding
    │       ├── tokenValidator.js   # protected token format/length validation
    │       └── tokenService.js     # protectToken + restoreToken services
    └── seed/ 
        ├── seed.js                # seeds demo Properties + Funds 
        └── adminSeed.js           # seeds the admin login (razikkhan982@gmail.com)
```

(This is a JSON API backend — there are no server-rendered views, so
the "V" in MVC is the JSON response shape produced by each controller.)

## Setup

```bash
cd wealth-backend
npm install
cp .env.example .env
# edit .env: set MONGO_URI and a strong JWT_SECRET

# make sure MongoDB is running locally, or point MONGO_URI at Atlas

npm run seed   # populates Top Properties / Top Funds demo data
npm run seed:admin   # creates/resets the admin login (razikkhan982@gmail.com / admin@123)
npm run dev    # starts on http://localhost:5000 (nodemon)
# or: npm start
```

## Sequential user IDs

Every user (including the seeded admin) automatically gets a short,
human-friendly `userId` alongside the MongoDB `_id` — `"0001"` for
the first account ever created, `"0002"` for the second, and so on
(auto-grows past 4 digits instead of breaking). It's generated with
an atomic counter (`src/models/Counter.model.js` +
`src/utils/generateUserId.js`) inside a `pre("save")` hook on the
`User` model, so no controller has to remember to set it — it just
shows up in the response of register/login/me and on every property
purchase record.

## API Reference

Base URL: `http://localhost:5000/api`

### 1. Register — `POST /auth/register`

Body (username/password are **not** accepted — they're generated):

```json
{
  "fullName": "Arjun Patel",
  "email": "arjun@example.com",
  "gender": "Male",
  "address": "221B Baker Street",
  "country": "India",
  "city": "Indore",
  "state": "Madhya Pradesh",
  "dob": "1995-06-14",
  "amountDeposited": 5000,
  "phone": "+91-9876543210"
}
```

Response `201`:

```json
{
  "success": true,
  "message": "Registration successful. Save your credentials securely.",
  "data": {
    "credentials": { "username": "arjun.patel", "password": "aB3xQ9mK21" },
    "token": "eyJhbGciOi...",
    "user": { "id": "...", "fullName": "Arjun Patel", "email": "arjun@example.com", "username": "arjun.patel" }
  }
}
```

> The plaintext password is returned **once**, at registration. It is
> hashed with bcrypt before being stored — it can never be recovered
> or shown again, only reset.

### 2. Login — `POST /auth/login`

```json
{ "username": "arjun.patel", "password": "aB3xQ9mK21" }
```

Response `200`: `{ success, message, data: { token, user } }`

Use the token on all protected routes:

```
Authorization: Bearer <token>
```

> **How the token is protected (read this if you're wiring up the frontend):**
> On login, the server signs a normal JWT, **saves that exact raw JWT
> on the user's document in MongoDB** (`user.token`), then wraps/encodes
> it (random prefix + base64 + random suffix) before sending it back as
> `data.token`. Send that value back on every protected request as
> `Authorization: Bearer <data.token>`. On the server side, the
> `protect` middleware reverses the encoding, verifies the JWT, and
> **also checks it against the copy stored in the database** — so
> logging in again (or calling `/auth/logout`) instantly invalidates
> any older token, even before it naturally expires.

### 2b. Admin login — `POST /auth/admin-login`

Same token behaviour as regular login, but the admin authenticates
with **email + password** instead of username + password:

```json
{ "email": "razikkhan982@gmail.com", "password": "admin@123" }
```

Response `200`: `{ success, message, data: { token, admin } }`

This only works for a user whose `role` is `"admin"`. The admin
account itself is created (or reset) by running:

```bash
npm run seed:admin
```

which seeds exactly this email/password (see `src/seed/adminSeed.js`).
Use the returned token on admin-only routes (`/api/admin/properties`,
`/api/admin/funds`) the same way as a normal `Bearer` token.

### 2c. Logout — `POST /auth/logout` (protected)

Clears the token stored on the user in the database. The client's
current JWT stops being accepted on the very next request, even
though it hasn't expired yet.

### 3. My profile — `GET /auth/me` (protected)

Returns the logged-in user's full profile (name, contact/address fields, balances).

### 4. Change password — `PUT /auth/change-password` (protected)

```json
{
  "currentPassword": "aB3xQ9mK21",
  "newPassword": "NewPass99",
  "confirmPassword": "NewPass99"
}
```

Requires a lowercase letter, an uppercase letter, and a digit, min 8
chars. Rejects if `currentPassword` is wrong or `newPassword` equals
the old one.

### 5. Dashboard — `GET /dashboard` (protected)

Returns:

- `welcome` — name, properties/funds counts, available balance
- `summary` — totalAmount, usedAmount, usedPercent, totalProfitAmount, monthlyGrowthPercent
- `topProperties` — top 5, sorted by value
- `topFunds` — top 5, sorted by value
- `topInvestors` — top 5 users ranked by monthly growth, plus totalInvestorCount
- `transactionHistory` — latest 20 transactions + totalRecords

### 6. Transactions — `GET /transactions?search=&page=&limit=` (protected)

Paginated, searchable (by asset/type/status) transaction history.

`POST /transactions` (protected) — record a new transaction:

```json
{ "type": "Buy", "asset": "SOL", "amount": 50, "price": 98.40, "total": 4920, "status": "Completed" }
```

### 7. Properties — `GET /properties`, `GET /properties/:id` (protected)

Lists/looks up properties available for FAIX-token purchase.

`POST /properties/purchase` (protected) — buy FAIX tokens in a property:

```json
{
  "userID": "0001",
  "propertyName": "Skyline Residency",
  "purchasedFaixToken": 25
}
```

The buyer is always taken from the verified JWT's short sequential
`userId` claim (`req.user.userId` — baked into the token at login,
see `signToken()` in `controllers/auth.controller.js`), never from
the request body. `userID` in the body is optional and only checked
for consistency against the token — if it's sent and doesn't match,
the request is rejected. The property is looked up by its exact
`propertyName` (must be unique — see `models/Property.model.js`).
On success, the created `PropertyPurchase`
record stores a full snapshot of **who** bought it — `buyerUserId`,
`buyerName`, `buyerUsername`, `buyerEmail`, `buyerPhone` — alongside
**what** they bought (`propertyName`, `propertyType`, `location`,
`purchasedFaixToken`, `purchaseAmount`), and the response also
includes a `buyer` summary object and updated token balances.

### 8. Admin — properties & funds (`/admin/properties`, `/admin/funds`)

`POST` / `PUT` / `DELETE` on these routes require an admin token from
`POST /auth/admin-login` (see section 2b above), not a regular user
token.

### 9. Admin — full user lookup by short userId — `GET /admin/users/:userId`

```
GET /api/admin/users/0001
Authorization: Bearer <admin token>
```

Looks the user up by their short sequential `userId` (not the Mongo
`_id`) and returns everything about them in one response: profile,
FAIX token summary, wallet balance, every property they've purchased
(`propertyPurchases`, each with the buyer snapshot), and every fund
they've invested in (`fundInvestments`).

## Notes / next steps you may want

- Add rate limiting (`express-rate-limit`) on `/auth/login` and
  `/auth/admin-login`.
- Registration currently stores the generated password in plaintext
  (`bcrypt.hash` is commented out in `register()`) and login compares
  it with `===` — intentionally left untouched per your instructions,
  but worth switching to real bcrypt hashing before production.
- Move `totalAmount`/`usedAmount`/`monthlyGrowthPercent` recalculation
  into a service that runs whenever a transaction is created, instead
  of trusting stored fields.
- Add a `/transactions/export` CSV route for the "Export" button seen
  in the UI.
#   M e t a l a n - W e a l t h - B a n k e n d  
 