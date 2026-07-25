# StoreTrack

StoreTrack is a React, Vite, Express, and MongoDB inventory application for small local shops. It includes administrator authentication, product and stock management, stock-level reporting, SKU uniqueness, and an inventory audit trail.

## Requirements

- Node.js 20 or newer
- MongoDB 7 or newer, or MongoDB Atlas

## Local setup

1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `ADMIN_USERNAME`, and a development `ADMIN_PASSWORD`.
3. Install dependencies with `npm install`.
4. Start the application with `npm run dev`.
5. Open `http://localhost:3000`.

Local development may use a temporary in-memory inventory when MongoDB is unavailable. This behavior is disabled in production and on Vercel so business data is never silently stored in an ephemeral process.

## Production configuration

Production requires these environment variables:

- `MONGODB_URI`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `JWT_SECRET`
- `NODE_ENV=production`

Generate a password hash:

```bash
npm run hash-password -- "use-a-long-unique-password"
```

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

The server refuses to start in production when required authentication secrets are missing. Do not commit `.env` files.

## Commands

```bash
npm run dev       # Development server with Vite middleware
npm run lint      # TypeScript checks
npm run build     # Build frontend and bundled Express server
npm run check     # Run type checks and production build
npm start         # Start built production server
```

## API summary

Public read endpoints:

- `GET /api/health`
- `GET /api/inventory`
- `GET /api/inventory/stats`

Administrator endpoints require `Authorization: Bearer <token>`:

- `POST /api/inventory`
- `PUT /api/inventory/:id`
- `PATCH /api/inventory/:id/stock`
- `DELETE /api/inventory/:id`
- `GET /api/audit`
- `POST /api/inventory/seed`

The production seed endpoint is disabled unless `ALLOW_DEMO_SEED=true`.

## Security behavior

- Production has no default credentials or JWT secret.
- Passwords are verified with bcrypt hashes in production.
- Login attempts are rate-limited.
- Mutation endpoints require an administrator JWT.
- MongoDB connection details and raw database errors are not exposed publicly.
- Production requests fail with `503` when the database is unavailable rather than falling back to temporary storage.
- Request body size and common browser security headers are configured.

## Deployment

For Vercel, add all production environment variables in the project settings before deployment. The Express entry point is `api/index.ts`, and `vercel.json` routes API traffic to that function and frontend traffic to the Vite application.
