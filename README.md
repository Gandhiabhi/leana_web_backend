# Leana Professional — Backend API

Production-grade **NestJS + Prisma + PostgreSQL (Supabase)** backend for the Leana
Professional ecommerce platform. Modular monolith, REST, JWT auth with refresh-token
rotation, RBAC, Stripe payments, and Cloudinary media.

## Tech stack

| Concern        | Choice                                   |
| -------------- | ---------------------------------------- |
| Framework      | NestJS 11 (Express)                      |
| ORM            | Prisma 6                                 |
| Database       | PostgreSQL (Supabase)                    |
| Auth           | JWT (access + rotating refresh), bcrypt  |
| Validation     | class-validator / class-transformer      |
| Security       | Helmet, CORS, rate limiting, RBAC guards |
| Media          | Cloudinary                               |
| Payments       | Stripe (PaymentIntents + webhooks)       |
| Logging        | Pino (nestjs-pino)                       |
| Docs           | Swagger / OpenAPI                        |

## Project structure

```
src/
├── common/         # filters, interceptors, guards, decorators, dto, utils
├── config/         # typed configuration + env validation
├── prisma/         # PrismaModule + PrismaService
├── integrations/   # mail, cloudinary, stripe, supabase
└── modules/        # feature modules (auth, users, products, orders, ...)
```

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env        # then fill in DATABASE_URL, DIRECT_URL, secrets, keys

# 3. Generate the Prisma client
npm run prisma:generate

# 4. Run migrations against your database
npm run prisma:migrate

# 5. Seed baseline data (admin user, catalog, home content)
npm run db:seed

# 6. Start the dev server
npm run start:dev
```

API is served at `http://localhost:4000/api/v1`.
Swagger docs (non-production) at `http://localhost:4000/api/docs`.

### Default seeded admin

`admin@leana.com` / `Admin123!` (override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).

## Conventions

- **Response envelope:** every success returns
  `{ success, statusCode, message, data, meta?, timestamp, path }`.
- **Errors:** centralized via `AllExceptionsFilter` →
  `{ success: false, statusCode, message, error, details?, timestamp, path }`.
- **Auth:** all routes are protected by a global `JwtAuthGuard`; opt out with `@Public()`.
  Restrict by role with `@Roles(Role.ADMIN, ...)`.
- **Pagination:** list endpoints accept `?page=&limit=&search=&sortBy=&sortOrder=`.

## Docker

```bash
docker compose up --build
```

Brings up PostgreSQL + the API (runs `prisma migrate deploy` on boot).

## Build status

All backend modules are implemented and compile cleanly (`npm run build`).

| Phase | Scope | Status |
| ----- | ----- | ------ |
| 1 | Foundation: config, Prisma schema, common infra, auth, users, health | ✅ |
| 2 | Catalog: categories, collections, products | ✅ |
| 3 | Cart (guest + auth merge), wishlist | ✅ |
| 4 | Coupons, orders, payments (Stripe intents, webhooks, refunds, idempotency) | ✅ |
| 5 | Reviews, addresses | ✅ |
| 6 | CMS (pages/home/banners), upload (Cloudinary) | ✅ |
| 7 | Settings, notifications, inventory, integrations, admin/analytics | ✅ |
| 8 | Frontend integration (API client, auth, hooks) | 🚧 |

### Implemented modules

`auth` · `users` · `categories` · `collections` · `products` · `cart` · `wishlist`
· `coupons` · `orders` · `payments` · `reviews` · `addresses` · `upload` · `cms`
· `settings` · `notifications` · `inventory` · `integrations` · `admin` · `health`
