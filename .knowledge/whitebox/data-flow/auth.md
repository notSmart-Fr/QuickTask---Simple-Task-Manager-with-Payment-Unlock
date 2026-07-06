# Auth — End-to-End Trace

## Register

**Request shape** (from [shared/schemas.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/shared/schemas.ts)):
```typescript
{ name: string; email: string; password: string }
```
- `name`: 1-100 chars, trimmed
- `email`: valid email, trimmed
- `password`: min 8 chars

**Entry**: `POST /api/v1/auth/register`
[backend/src/api/auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts#L22-49)

**Middleware**: None (register/login are public)

**Service**: [AuthService.register()](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/auth/auth.service.ts#L28-63)
1. `userRepo.findByEmail(email)` → if exists → `Effect.fail(EmailAlreadyRegistered)`
2. `hasher.hash(password)` → bcrypt genSalt(10) + hash
3. `userRepo.create({ name, email, passwordHash })` → Prisma `user.create`
4. `tokenService.sign(userId, name, email, isPremium)` → JWT with 7-day expiry
5. Returns `{ user, token }`

**Repository**: [PrismaUserRepository](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/adapters/prisma/prisma-user.repository.ts)
- `findByEmail`: `prisma.user.findUnique({ where: { email } })`
- `create`: `prisma.user.create({ data: { name, email, passwordHash, isPremium: false } })`

**Response shape**: `201`
```typescript
{ user: { id: string; name: string; email: string; isPremium: boolean }; token: string }
```

**Failure modes**:
| Error | _tag | HTTP | When |
|-------|------|------|------|
| Shape invalid | — | 400 | Zod safeParse fails (bad email, short password, etc.) |
| Email taken | `EmailAlreadyRegistered` | 409 | `userRepo.findByEmail` returns a user |
| DB failure | `Error` | 500 | Prisma connection loss, constraint violation, etc. |
| Hash failure | `Error` | 500 | bcrypt unexpected error (rare) |

---

## Login

**Request shape**: `{ email: string; password: string }`

**Entry**: `POST /api/v1/auth/login`
[backend/src/api/auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts#L51-76)

**Service**: [AuthService.login()](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/core/auth/auth.service.ts#L66-99)
1. `userRepo.findByEmail(email)` → if null → `Effect.fail(InvalidCredentials)`
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
[backend/src/api/auth.routes.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/auth.routes.ts#L78-83)

**Middleware**: [auth.middleware.ts](file:///i:/QuickTask%20–%20Simple%20Task%20Manager%20with%20Payment%20Unlock/backend/src/api/middleware/auth.middleware.ts)
- Extracts `Bearer <token>` from Authorization header
- `jwt.verify(token, JWT_SECRET)` → decodes `{ userId, name, email, isPremium }`
- Sets `req.user` or returns 401

**Response shape**: `200` `{ id, name, email, isPremium }`

**Failure modes**:
| Error | HTTP | When |
|-------|------|------|
| No token / malformed | 401 | Missing or non-Bearer Authorization header |
| Expired / invalid token | 401 | `jwt.verify` throws (expired, bad signature) |
