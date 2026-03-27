# Worker Environment Variables Guide

## Overview
This document describes all environment variables used by the Cloudflare Worker for the MCQ platform.

## Configuration Files
- **Development**: `.env.development`
- **Production**: `.env.production`
- **Testing**: `.env.test`
- **Wrangler Config**: `wrangler.jsonc`

---

## Authentication Variables

### Session Management
```
SESSION_SECRET=<random-32-char-string>
  Description: Secret key for session encryption
  Required: Yes
  Format: At least 32 random characters
  Example: "3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s"
```

### Turnstile (CAPTCHA)
```
TURNSTILE_SITE_KEY=<public-key>
  Description: Public key for Turnstile CAPTCHA widget
  Required: Yes for registration/password reset
  Format: Alphanumeric string
  From: https://dash.cloudflare.com/

TURNSTILE_SECRET_KEY=<secret-key>
  Description: Secret key for verifying Turnstile tokens
  Required: Yes for registration/password reset
  Format: Alphanumeric string
  From: https://dash.cloudflare.com/
```

### Email Configuration

#### Resend
```
RESEND_API_KEY=<api-key>
  Description: API key for Resend email service
  Required: Only if using Resend
  Format: String starting with 're_' or similar
  From: https://resend.com/api-keys

RESEND_FROM_EMAIL=<sender@example.com>
  Description: Sender email address for Resend
  Required: Yes if RESEND_API_KEY is set
  Format: Valid email address
```

#### Postmark
```
POSTMARK_API_TOKEN=<token>
  Description: API token for Postmark email service
  Required: Only if using Postmark
  Format: 32-character alphanumeric string
  From: https://account.postmarkapp.com/servers

POSTMARK_FROM_EMAIL=<sender@example.com>
  Description: Sender email address for Postmark
  Required: Yes if POSTMARK_API_TOKEN is set
  Format: Valid email address
```

### Database Configuration

```
DB=<d1-binding-name>
  Description: Cloudflare D1 database binding name
  Required: Yes
  Format: String (typically "DB" or "MCQ_DB")
  From: wrangler.jsonc [[d1_databases]]

DB_NAME=<database-name>
  Description: D1 database identifier
  Required: No (inferred from binding)
  Format: String
```

---

## Analytics & Heatmap Variables

```
HEATMAP_DATABASE=<d1-binding-name>
  Description: D1 database for heatmap data
  Required: Optional
  Format: String (D1 binding name)

HEATMAP_ENABLED=true|false
  Description: Enable/disable heatmap tracking
  Required: No (default: true if DB configured)
  Format: Boolean

ANALYTICS_RETENTION_DAYS=90
  Description: Days to retain analytics data
  Required: No (default: 90)
  Format: Integer (1-365)

HEATMAP_EVENT_RETENTION_DAYS=90
  Description: Days to retain heatmap events
  Required: No (default: 90)
  Format: Integer (1-365)

HEATMAP_REPLAY_RETENTION_DAYS=14
  Description: Days to retain session replays
  Required: No (default: 14)
  Format: Integer (1-30)
```

---

## AI/LLM Variables

```
AI_MODEL=<model-name>
  Description: AI model to use for explanations
  Required: Optional
  Format: String (e.g., "gpt-3.5-turbo", "claude-instant")
  Options: "gpt-3.5-turbo", "gpt-4", "claude-instant", "claude-3"

AI_PROVIDER=<provider>
  Description: AI service provider
  Required: Optional
  Format: String
  Options: "openai", "anthropic", "cloudflare"

OPENAI_API_KEY=<key>
  Description: OpenAI API key
  Required: Only if AI_PROVIDER=openai
  Format: String starting with 'sk-'
  From: https://platform.openai.com/api-keys

ANTHROPIC_API_KEY=<key>
  Description: Anthropic API key
  Required: Only if AI_PROVIDER=anthropic
  Format: String
  From: https://console.anthropic.com/

AI_REQUEST_TIMEOUT_MS=30000
  Description: Timeout for AI requests
  Required: No (default: 30000)
  Format: Integer (milliseconds)

AI_MAX_TOKENS=500
  Description: Maximum tokens for AI responses
  Required: No (default: 500)
  Format: Integer
```

---

## Admin Variables

```
ADMIN_TOKEN=<secure-token>
  Description: Bearer token for admin API access
  Required: Yes for admin panel
  Format: 32+ character random string
  Generation: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

ADMIN_EMAIL_ALLOWLIST=admin1@example.com,admin2@example.com
  Description: Comma-separated admin emails allowed to access admin routes
  Required: Yes for admin panel access
  Format: Comma-separated valid email addresses

ADMIN_AUTO_PROVISION=false
  Description: Whether admin login can auto-create missing allowlisted users
  Required: No (default: false)
  Format: true/false

ADMIN_SESSION_TTL_MS=2592000000
  Description: Admin session time-to-live (30 days default)
  Required: No
  Format: Integer (milliseconds)

ADMIN_RESET_UNDO_TTL_MS=900000
  Description: Undo window for admin resets (15 minutes default)
  Required: No
  Format: Integer (milliseconds)
```

---

## Rate Limiting Variables

```
RATE_LIMIT_WINDOW_MINUTES=15
  Description: Rate limit window for general API
  Required: No (default: 15)
  Format: Integer

RATE_LIMIT_IP_MAX=15
  Description: Max requests per IP in window
  Required: No (default: 15)
  Format: Integer

RATE_LIMIT_EMAIL_MAX=8
  Description: Max requests per email in window
  Required: No (default: 8)
  Format: Integer

AI_RATE_LIMIT_WINDOW_MINUTES=10
  Description: Rate limit window for AI endpoints
  Required: No (default: 10)
  Format: Integer

AI_RATE_LIMIT_IP_MAX=20
  Description: Max AI requests per IP in window
  Required: No (default: 20)
  Format: Integer

HEATMAP_RATE_LIMIT_WINDOW_MINUTES=10
  Description: Rate limit window for heatmap tracking
  Required: No (default: 10)
  Format: Integer

HEATMAP_RATE_LIMIT_IP_MAX=1500
  Description: Max heatmap events per IP in window
  Required: No (default: 1500)
  Format: Integer
```

---

## Password Reset Variables

```
PASSWORD_RESET_TTL_MS=1800000
  Description: Password reset token TTL (30 minutes default)
  Required: No
  Format: Integer (milliseconds)

RESET_RATE_LIMIT_WINDOW_MINUTES=30
  Description: Rate limit window for password resets
  Required: No (default: 30)
  Format: Integer

RESET_RATE_LIMIT_EMAIL_MAX=5
  Description: Max password reset requests per email in window
  Required: No (default: 5)
  Format: Integer

PASSWORD_RESET_BASE_URL=https://example.com
  Description: Base URL for password reset links
  Required: Yes if reset email enabled
  Format: Valid URL (https://)
```

---

## Session Variables

```
COOKIE_NAME=mcq_session
  Description: Name of session cookie
  Required: No (default: "mcq_session")
  Format: String

SESSION_TTL_MS=2592000000
  Description: Session time-to-live (30 days default)
  Required: No
  Format: Integer (milliseconds)

HEATMAP_VISITOR_COOKIE=mcq_visitor
  Description: Name of visitor ID cookie
  Required: No (default: "mcq_visitor")
  Format: String

HEATMAP_VISITOR_TTL_SECONDS=31536000
  Description: Visitor ID TTL (1 year default)
  Required: No
  Format: Integer (seconds)
```

---

## Platform Variables

```
ENVIRONMENT=production|development|staging
  Description: Deployment environment
  Required: No (default: production)
  Format: String

VERSION=1.0.0
  Description: API version
  Required: No
  Format: Semantic version

BASE_URL=https://example.com
  Description: Base URL for the application
  Required: No
  Format: Valid URL (https://)

CF_REGION=us-west-2
  Description: Cloudflare region
  Required: No (auto-detected)
  Format: Cloudflare region code
```

---

## CORS Variables

```
ALLOWED_ORIGINS=https://example.com,https://www.example.com
  Description: Comma-separated list of allowed origins
  Required: No
  Format: Comma-separated URLs

CORS_CREDENTIALS=true|false
  Description: Allow credentials in CORS requests
  Required: No (default: true)
  Format: Boolean
```

---

## Logging Variables

```
LOG_LEVEL=info|debug|warn|error
  Description: Minimum log level
  Required: No (default: info)
  Format: String

LOG_FORMAT=json|text
  Description: Log output format
  Required: No (default: json)
  Format: String

DEBUG=true|false
  Description: Enable debug mode
  Required: No (default: false)
  Format: Boolean
```

---

## Setting Up Environment Variables

### In wrangler.jsonc
```toml
[env.production]
vars = { ENVIRONMENT = "production", VERSION = "1.0.0" }
d1_databases = [{ binding = "DB", database_name = "mcq_db" }]
```

### In .env files
```bash
# .env.production
ADMIN_TOKEN=your-secure-token-here
SESSION_SECRET=your-session-secret-here
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key
RESEND_API_KEY=your-resend-key
ENVIRONMENT=production
```

### In Cloudflare Dashboard
1. Navigate to Workers
2. Click on your worker
3. Go to Settings → Variables
4. Add each variable with its value

---

## Validation Checklist

Before deploying, verify:
- [ ] `SESSION_SECRET` is set (32+ chars)
- [ ] `TURNSTILE_SITE_KEY` and `SECRET_KEY` are configured
- [ ] `DB` binding exists in wrangler.jsonc
- [ ] Email provider (`RESEND_API_KEY` or `POSTMARK_API_TOKEN`) is set
- [ ] `ADMIN_TOKEN` is secure (32+ chars)
- [ ] `PASSWORD_RESET_BASE_URL` is correct
- [ ] Rate limit values are reasonable
- [ ] Log level is appropriate for environment
- [ ] CORS origins are correctly specified

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Use environment-specific files** (.env.production, .env.development)
3. **Rotate API keys** regularly
4. **Use strong SESSION_SECRET** (32+ random characters)
5. **Use HTTPS only** for base URLs
6. **Keep secrets** in Cloudflare dashboard, not in code
7. **Audit environment variables** for sensitive data
8. **Use different tokens** for different environments

---

## Troubleshooting

### Health Check Fails
- Verify `DB` binding exists
- Check `SESSION_SECRET` is set
- Ensure `TURNSTILE_*` keys are valid

### Email Not Sending
- Verify `RESEND_API_KEY` or `POSTMARK_API_TOKEN`
- Check sender email is verified
- Verify `PASSWORD_RESET_BASE_URL` is correct

### Heatmap Not Tracking
- Verify `HEATMAP_DATABASE` binding exists
- Check `HEATMAP_ENABLED` is not false
- Verify D1 database is configured

### AI Explanations Not Working
- Verify `AI_PROVIDER` is set
- Check API key for selected provider
- Ensure `AI_MODEL` is valid

---

## Example Configuration

### Minimal Setup (Auth Only)
```bash
SESSION_SECRET=<32-char-random>
TURNSTILE_SITE_KEY=<key>
TURNSTILE_SECRET_KEY=<key>
ENVIRONMENT=production
```

### Full Setup (All Features)
```bash
# Authentication
SESSION_SECRET=<32-char-random>
TURNSTILE_SITE_KEY=<key>
TURNSTILE_SECRET_KEY=<key>

# Email
RESEND_API_KEY=<key>
RESEND_FROM_EMAIL=noreply@example.com
PASSWORD_RESET_BASE_URL=https://example.com

# Analytics
HEATMAP_ENABLED=true
ANALYTICS_RETENTION_DAYS=90

# Admin
ADMIN_TOKEN=<32-char-random>
ADMIN_EMAIL_ALLOWLIST=admin@example.com
ADMIN_AUTO_PROVISION=false

# Platform
ENVIRONMENT=production
VERSION=1.0.0
```

---

**Last Updated:** March 26, 2026  
**Version:** 1.0.0
