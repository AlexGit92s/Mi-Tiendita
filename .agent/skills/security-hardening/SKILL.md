---
name: security-hardening
description: Application security hardening covering authentication, authorization, data protection, headers, and common vulnerability prevention.
license: MIT
---

# Security Hardening Guidelines

## Project Context
- **Project Path**: C:\laragon\www\Mi-Tiendita
- **Framework**: {{FRAMEWORK}}
- **Database**: Not specified

## Core Principles
- Assume all user input is hostile — validate, sanitize, and encode
- Follow the principle of least privilege — every component gets minimum permissions
- Defense in depth — multiple layers of security, not just one
- Never roll your own cryptography — use established libraries
- Log security events but never log sensitive data
- Regular dependency audits and updates

## Authentication
- Use established authentication libraries — don't build from scratch
- Hash passwords with bcrypt, argon2, or scrypt — never MD5/SHA1
- Implement rate limiting on login endpoints
- Use multi-factor authentication for admin accounts
- Use short-lived access tokens with refresh token rotation
- Invalidate sessions on password change

```typescript
// Password hashing (Node.js)
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

```python
# Password hashing (Python)
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

## JWT Security
- Use RS256 (asymmetric) for multi-service architectures, HS256 for single-service
- Set short expiration times (15 minutes for access tokens)
- Include `sub` (subject) and `iat` (issued at) claims
- Never store sensitive data in JWT payload — it's base64, not encrypted
- Use HTTP-only cookies for token storage, not localStorage

```typescript
// JWT best practices
const token = jwt.sign(
  { sub: user.id, role: user.role },
  privateKey,
  {
    algorithm: 'RS256',
    expiresIn: '15m',
    issuer: 'your-app',
    audience: 'your-app-users',
  }
);
```

## Authorization
- Implement role-based (RBAC) or attribute-based (ABAC) access control
- Check authorization at the API level AND the database level
- Use middleware/guards for route-level authorization
- Never trust client-side authorization checks

```typescript
// Authorization middleware
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

router.delete('/users/:id', requireRole('admin'), deleteUserHandler);
```

## Input Validation
- Validate ALL input — query params, headers, body, files, cookies
- Use schema validation (Zod, Joi, Pydantic, Form Requests)
- Never use string concatenation for SQL queries
- Set maximum sizes for request bodies and file uploads

```typescript
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s'-]+$/),
  role: z.enum(['user', 'admin']).default('user'),
});
```

## SQL Injection Prevention
- Always use parameterized queries or ORM
- Never concatenate user input into SQL strings
- Use stored procedures for complex queries
- Apply principle of least privilege to database users

```typescript
// ❌ VULNERABLE
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;

// ✅ SAFE — parameterized
const query = 'SELECT * FROM users WHERE email = $1';
const result = await db.query(query, [userEmail]);

// ✅ SAFE — ORM
const user = await db.user.findUnique({ where: { email: userEmail } });
```

## XSS Prevention
- Encode output based on context (HTML, attribute, JavaScript, URL, CSS)
- Use framework auto-escaping (React, Vue escape by default)
- Sanitize HTML input with DOMPurify if HTML is allowed
- Set `Content-Security-Policy` header

```html
<!-- CSP Header -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';">
```

## Security Headers
```typescript
// Express with Helmet
import helmet from 'helmet';
app.use(helmet());

// Headers set by Helmet:
// - Content-Security-Policy
// - X-Content-Type-Options: nosniff
// - X-Frame-Options: DENY
// - X-XSS-Protection
// - Strict-Transport-Security
// - Referrer-Policy
// - X-DNS-Prefetch-Control
// - X-Permitted-Cross-Domain-Policies
```

```nginx
# Nginx security headers
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## CORS Configuration
- Never use `*` in production
- Whitelist specific origins
- Restrict allowed methods and headers

```typescript
app.use(cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));
```

## File Upload Security
- Validate file type by magic bytes, not just extension
- Set maximum file size
- Store uploads outside web root or in cloud storage
- Rename files to prevent execution
- Scan for malware if user-facing uploads

```typescript
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';

const upload = multer({
  storage: multer.diskStorage({
    destination: '/var/uploads/',
    filename: (req, file, cb) => {
      cb(null, `${crypto.randomUUID()}.${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Invalid file type'));
    }
    cb(null, true);
  },
});
```

## Environment and Secrets
- Never commit `.env` files or secrets to version control
- Use secret management (AWS Secrets Manager, HashiCorp Vault, GitHub Secrets)
- Rotate secrets regularly
- Use different secrets for development, staging, production
- Audit dependencies for known vulnerabilities

```
# .gitignore
.env
.env.local
.env.*.local
*.pem
*.key
id_rsa
credentials.json
secrets/
```

## Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

// General API rate limit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.',
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
```

## Logging and Monitoring
- Log authentication attempts (success and failure)
- Log authorization failures
- Never log passwords, tokens, or PII
- Set up alerts for suspicious patterns
- Monitor for abnormal request patterns

```typescript
// Security event logging
function logSecurityEvent(event: string, details: Record<string, unknown>) {
  logger.warn({
    event,
    ...details,
    // Never include: password, token, credit_card, ssn, etc.
  });
}

// Usage
logSecurityEvent('login_failed', { email, ip: req.ip });
logSecurityEvent('unauthorized_access', { userId, resource: req.path });
```

## Dependency Security
- Run `npm audit`, `pip-audit`, `bundle-audit` regularly
- Use Dependabot or Renovate for automated updates
- Pin dependency versions
- Review new dependencies before adding

```bash
# Node.js
npm audit
npm audit fix

# Python
pip-audit

# Ruby
bundle audit
```

## Common Pitfalls
- ❌ Don't store tokens in localStorage — use HTTP-only cookies
- ❌ Don't log sensitive data — passwords, tokens, PII
- ❌ Don't trust client-side validation — always validate server-side
- ❌ Don't use `eval()` or `Function()` with user input
- ❌ Don't expose stack traces or error details in production
- ✅ Use parameterized queries for all database operations
- ✅ Set security headers (Helmet, CSP, HSTS)
- ✅ Implement rate limiting on auth and API endpoints
- ✅ Rotate secrets and update dependencies regularly
- ✅ Use principle of least privilege everywhere

## When to Use
- Setting up any new project
- Reviewing authentication or authorization code
- Adding file upload functionality
- Exposing API endpoints
- Before deploying to production
- During code reviews
