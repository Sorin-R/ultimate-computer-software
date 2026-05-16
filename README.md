
Start postgre: brew services start postgresql@16

# Ultimate Computer Software — Technology News Platform

A full-stack worldwide technology news platform built with React, Express, TypeScript, and PostgreSQL.

**Domain:** https://www.ultimatecomputersoftware.com/

## Tech Stack

### Frontend
- React 19 + Vite
- TypeScript
- Tailwind CSS 4
- React Router 7
- React Quill (rich text editor)
- React Helmet Async (SEO)
- Axios

### Backend
- Node.js + Express 5
- TypeScript
- PostgreSQL + Prisma ORM
- JWT authentication with refresh tokens
- bcrypt password hashing
- Helmet, CORS, rate limiting
- Zod validation
- DOMPurify HTML sanitisation

## Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm

## Setup

### 1. Clone and install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables

Copy the example file and edit it:

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://your_user:your_password@localhost:5432/ultimate_computer_software?schema=public"
JWT_SECRET="generate-a-strong-random-secret-here"
JWT_REFRESH_SECRET="generate-another-strong-random-secret-here"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=4000
NODE_ENV="development"
FRONTEND_URL="http://localhost:5173"
SITE_URL="https://www.ultimatecomputersoftware.com"
TWO_FACTOR_ENCRYPTION_KEY="set-a-long-random-secret-for-2fa-encryption"
TWO_FACTOR_ISSUER="Ultimate Computer Software"
TRUST_PROXY="0"
COOKIE_SAME_SITE="lax"
COOKIE_SECURE="false"
CAPTCHA_REQUIRED="false"
CAPTCHA_VERIFY_URL="https://challenges.cloudflare.com/turnstile/v0/siteverify"
CAPTCHA_SECRET=""
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-smtp-user"
SMTP_PASS="your-smtp-password"
SMTP_FROM_EMAIL="noreplay@ultimatecomputersoftware.com"
SMTP_FROM_PRIVACY="privacy@ultimatecomputersoftware.com"
SMTP_FROM_COPYRIGHT="copyright@ultimatecomputersoftware.com"
SMTP_FROM_SUPPORT="support@ultimatecomputersoftware.com"
SMTP_FROM_NOREPLY="noreplay@ultimatecomputersoftware.com"
```

SMTP is required for registration email verification, password reset, and transactional notifications.

Optional frontend canonical URL override (`frontend/.env`):

```env
VITE_SITE_URL="https://www.ultimatecomputersoftware.com"
VITE_TURNSTILE_SITE_KEY=""
```

### 3. Create the PostgreSQL database

```bash
createdb ultimate_computer_software
```

Or via psql:

```sql
CREATE DATABASE ultimate_computer_software;
```

### 4. Run database migrations

```bash
cd backend
npx prisma migrate dev --name init
```

### 5. Seed the database

This creates 10 categories, 50 technology topics, and an admin user.

```bash
cd backend
npx prisma db seed
```

**Default admin credentials:**
- Email: `admin@ultimatecomputersoftware.com`
- Password: `Admin@12345`

**Change the admin password immediately after first login.**

### 6. Run the development servers

In two terminal windows:

**Backend:**
```bash
cd backend
npm run dev
```

**Frontend:**
```bash
cd frontend
npm run dev
```

The frontend runs on http://localhost:5173 and proxies API requests to the backend on http://localhost:4000.

## Project Structure

```
ultimate-computer-software/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Database models
│   │   └── seed.ts             # Seed data (categories, topics, admin)
│   └── src/
│       ├── config/             # Database and env configuration
│       ├── controllers/        # Route handlers
│       ├── middleware/          # Auth, validation, error handling
│       ├── routes/             # Express route definitions
│       ├── utils/              # Sanitisation, slug generation
│       ├── validators/         # Zod validation schemas
│       ├── app.ts              # Express app setup
│       └── server.ts           # Server entry point
├── frontend/
│   └── src/
│       ├── api/                # Axios client with interceptors
│       ├── components/         # Shared components (Navbar, Footer, etc.)
│       ├── context/            # Auth context provider
│       └── pages/
│           ├── public/         # Home, Article, Category pages
│           ├── auth/           # Login, Register
│           ├── dashboard/      # User dashboard, article editor
│           └── admin/          # Admin panel pages
└── README.md
```

## API Routes

### Authentication
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user (email verification required before login) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/login/2fa` | Complete login with 2FA code |
| POST | `/api/auth/verify-email` | Verify account email with token |
| POST | `/api/auth/resend-verification` | Resend verification email |
| GET | `/api/auth/csrf` | Issue CSRF cookie/token |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/2fa/setup` | Start 2FA setup |
| POST | `/api/auth/2fa/verify` | Verify and enable 2FA |
| POST | `/api/auth/2fa/disable` | Disable 2FA |
| POST | `/api/auth/password-reset/request` | Request password reset |
| POST | `/api/auth/password-reset/confirm` | Confirm password reset |

### Articles
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/articles` | List published articles |
| GET | `/api/articles/mine` | List user's own articles |
| GET | `/api/articles/:slug` | Get article by slug |
| POST | `/api/articles` | Create article |
| PUT | `/api/articles/:id` | Update article |
| DELETE | `/api/articles/:id` | Delete article |

### Categories
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/categories` | List active categories |
| GET | `/api/categories/tags` | List all tags |
| GET | `/api/categories/:slug` | Get category with articles |
| POST | `/api/categories` | Create category |

### Admin (requires ADMIN or MODERATOR role)
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/articles` | All articles with filters |
| GET | `/api/admin/articles/pending` | Pending articles |
| PUT | `/api/admin/articles/:id/approve` | Approve and publish |
| PUT | `/api/admin/articles/:id/reject` | Reject article |
| DELETE | `/api/admin/articles/:id` | Delete article |
| GET | `/api/admin/users` | List users (ADMIN only) |
| PUT | `/api/admin/users/:id/role` | Change user role (ADMIN only) |
| GET | `/api/admin/categories` | All categories |
| PUT | `/api/admin/categories/:id` | Update category |
| DELETE | `/api/admin/categories/:id` | Delete category |

### Trust & Safety
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/users/:id/block` | Block any user |
| DELETE | `/api/users/:id/block` | Unblock user |
| GET | `/api/me/blocks` | List blocked users |
| GET | `/api/users/:id/policy-compliance` | Public policy compliance log |
| POST | `/api/admin/users/:id/policy-compliance` | Create public policy entry (admin/mod) |
| POST | `/api/reports` | Submit report (article/comment/user) |
| GET | `/api/reports/mine` | Reporter-facing report history |
| GET | `/api/admin/reports` | Moderator report queue |
| PUT | `/api/admin/reports/:id` | Update report status/notes |

### Growth & SEO
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/sitemap.xml` | Dynamic sitemap for public URLs |
| GET | `/robots.txt` | Robots policy + sitemap reference |
| GET | `/rss/author/:slug.xml` | Author RSS feed |
| GET | `/rss/category/:slug.xml` | Category RSS feed |
| GET | `/rss/tag/:slug.xml` | Tag RSS feed |
| GET | `/embed/author/:slug` | Public embeddable author card |
| GET | `/api/stats` | Public community statistics |
| GET | `/api/me/referrals` | Referral dashboard data |

## User Roles

- **USER** — can register, create articles, save drafts, submit for review
- **MODERATOR** — can approve/reject articles, manage categories
- **ADMIN** — full access, can manage users and change roles

## Article Workflow

1. User creates article and saves as **Draft**
2. User submits article → status becomes **Submitted**
3. Moderator/Admin reviews → **Approve** (publishes) or **Reject**
4. Published articles appear on the public site with SEO-friendly URLs

## Security Notes

- `TWO_FACTOR_ENCRYPTION_KEY` should be set in production so TOTP secrets are encrypted with a dedicated key.
- Password reset requests always return a generic success message to avoid account enumeration.
- Cookie-authenticated mutating API calls are protected by double-submit CSRF checks (`X-CSRF-Token` + `ucs_csrf_token` cookie).
- Refresh tokens are stored as hashed, rotatable sessions in `refresh_sessions`; each `/api/auth/refresh` call rotates and revokes the previous session token.
- Public contact and data-request forms use CAPTCHA verification when `CAPTCHA_REQUIRED=true`.
- Report and comment-report submission endpoints are rate limited.
- DM-specific moderation/rate-limit hooks are scaffolded, but full DM enforcement depends on adding the DM subsystem.

## Useful Commands

```bash
# Open Prisma Studio (database GUI)
cd backend && npx prisma studio

# Generate Prisma client after schema changes
cd backend && npx prisma generate

# Create a new migration
cd backend && npx prisma migrate dev --name your_migration_name

# Build frontend for production
cd frontend && npm run build

# Build backend for production
cd backend && npm run build
```
