# Auth — End-to-End Trace

## Register

**Request shape** (Zod):
```typescript
{ name: string; email: string; password: string }
```
- `name`: 1-100 chars, trimmed
- `email`: valid email, trimmed
- `password`: min 8 chars

**Entry**: `POST /api/v1/auth/register`
[auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.routes.ts)

**Middleware**: None (register/login are public)

**Service**: `AuthService.register(name, email, password)`
1. `prisma.user.findUnique({ where: { email } })` → if exists → `Effect.fail(EmailAlreadyRegistered)`
2. `hasher.hash(password)` → bcrypt genSalt(10) + hash (via injectable `Hasher` interface)
3. `prisma.user.create({ data: { name, email, passwordHash, isPremium: false } })` — direct Prisma call
4. `tokenService.sign(userId, name, email, isPremium)` → JWT with 7-day expiry (via injectable `TokenService` interface)
5. Returns `{ user, token }`

**Constructors**: `AuthService(prisma, hasher, tokenService)` — Hasher defaults to `BcryptHasher`,
TokenService defaults to `JwtToken`

**Response shape**: `201`
```typescript
{ user: { id: string; name: string; email: string; isPremium: boolean }; token: string }
```

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails (bad email, short password, etc.) |
| Email taken | `EmailAlreadyRegistered` | 409 | `prisma.user.findUnique` returns a user |
| DB failure | `Error` | 500 | Prisma connection loss, constraint violation, etc. |
| Hash failure | `Error` | 500 | bcrypt unexpected error (rare) |

---

## Login

**Request shape**: `{ email: string; password: string }`

**Entry**: `POST /api/v1/auth/login`
[auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.routes.ts)

**Service**: `AuthService.login(email, password)`
1. `prisma.user.findUnique({ where: { email } })` → if null → `Effect.fail(InvalidCredentials)`
2. `hasher.compare(password, user.passwordHash)` → if false → `Effect.fail(InvalidCredentials)`
3. `tokenService.sign(...)` → JWT
4. Returns `{ user, token }`

**Response shape**: `200` — same as register response

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails |
| Bad credentials | `InvalidCredentials` | 401 | Email not found or password mismatch |
| DB/Hash failure | `Error` | 500 | Infrastructure failure |

---

## GET /me

**Request shape**: No body. Requires `Authorization: Bearer <token>` header.

**Entry**: `GET /api/v1/auth/me`
[auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/features/auth/auth.routes.ts)

**Service**: `AuthService.getMe(userId)`
1. `prisma.user.findUnique({ where: { id: userId } })` — reads fresh DB data (not JWT claims)
2. Returns `{ id, name, email, isPremium }` — ensures isPremium matches DB

**Middleware**: [auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/middleware/auth.middleware.ts)
- Extracts `Bearer <token>` from Authorization header
- `jwt.verify(token, JWT_SECRET)` → decodes `{ userId, name, email, isPremium }`
- Sets `req.user` or returns 401

**Response shape**: `200` `{ id, name, email, isPremium }`

**Failure modes**:
| Error | HTTP | When |
|-------|------|------|
| No token / malformed | 401 | Missing or non-Bearer Authorization header |
| Expired / invalid token | 401 | `jwt.verify` throws (expired, bad signature) |
