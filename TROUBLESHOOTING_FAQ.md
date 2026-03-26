# Troubleshooting FAQ - MCQ Platform

## Table of Contents
- [General Issues](#general-issues)
- [Authentication & Login](#authentication--login)
- [Questions & Content](#questions--content)
- [Performance & Speed](#performance--speed)
- [Admin Panel](#admin-panel)
- [Deployment & Infrastructure](#deployment--infrastructure)
- [Email & Notifications](#email--notifications)
- [Analytics & Heatmaps](#analytics--heatmaps)

---

## General Issues

### Q: The application won't load
**A:** Try these steps:
1. Clear browser cache: `Ctrl+Shift+Delete` (or `Cmd+Shift+Delete` on Mac)
2. Hard refresh: `Ctrl+F5` (or `Cmd+Shift+R` on Mac)
3. Check browser console for errors: `F12` → Console tab
4. Verify network connection
5. Try a different browser
6. Check `/health` endpoint: `curl http://localhost:3000/health`

### Q: Getting "Service Worker not available" error
**A:** Service Worker registration failed:
1. Ensure `https://` or `localhost` (SW requires secure context)
2. Check browser console for registration errors
3. Unregister previous SW:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   ```
4. Clear site data: DevTools → Application → Clear storage
5. Hard refresh page

### Q: "CORS error" or "Cross-Origin Request Blocked"
**A:** CORS configuration issue:
1. Verify `ALLOWED_ORIGINS` in environment variables
2. Check that API URL matches browser origin
3. For localhost: API should be `http://localhost:3000`
4. For production: API should match domain
5. Verify `Access-Control-Allow-Origin` header in response
6. Check preflight request in DevTools Network tab

---

## Authentication & Login

### Q: Can't sign up - getting "Email already exists"
**A:** This email is already registered:
1. Try signing in instead
2. If you forgot password: Use "Forgot Password" link
3. Contact admin if account was compromised
4. Each email can only have one account

### Q: "Invalid email format" error
**A:** Email validation failed:
1. Ensure email has valid format: `user@example.com`
2. Check for extra spaces
3. Use lowercase if possible
4. Verify email domain is correct
5. Some email providers may not work (check allowlist)

### Q: Password reset email not received
**A:** Email delivery failed:
1. Check spam/junk folder
2. Verify email address is correct
3. Check system time (tokens expire in 30 minutes)
4. Request new reset link if expired
5. Verify email provider is configured:
   ```bash
   curl http://localhost:3000/api/debug/reset-email
   ```
6. Check `/health` endpoint for email configuration:
   ```bash
   curl http://localhost:3000/api/auth/config
   ```

### Q: "Turnstile verification failed"
**A:** CAPTCHA verification failed:
1. Check that Turnstile keys are correct in environment
2. Verify Turnstile site key matches domain
3. Ensure browser can reach `https://challenges.cloudflare.com`
4. Check if Turnstile is properly loaded in DOM
5. Try different browser
6. Check Turnstile dashboard for errors: https://dash.cloudflare.com/

### Q: Session keeps expiring
**A:** Session TTL is too short:
1. Check `SESSION_TTL_MS` environment variable
2. Default is 30 days - increase if needed
3. Verify cookie is persisted:
   - DevTools → Application → Cookies
   - Look for `mcq_session` cookie
   - Check expiry date
4. Check browser cookie settings (not blocking cookies)

### Q: "Unauthorized" when accessing protected routes
**A:** Authentication token missing or invalid:
1. Check if logged in: Try going to home page
2. Check browser console for auth errors
3. Verify session cookie exists
4. Try signing out and back in
5. Clear browser storage and re-authenticate
6. Check if session expired

---

## Questions & Content

### Q: Questions not loading in test
**A:** Content fetch failed:
1. Check network tab in DevTools for 404 errors
2. Verify topic ID exists (check `/data/topics.json`)
3. Verify test ID matches (e.g., "01", "02")
4. For offline: Check Service Worker cache
5. Try cache busting: Add `?v=123` to data file path
6. Check file permissions on data files

### Q: Questions are shuffled differently each time
**A:** This is normal behavior:
1. Shuffle is saved in localStorage: `shuffle_{topicId}_{testId}`
2. Same shuffle used within same session
3. Different shuffle when clearing localStorage
4. To reset shuffle: Delete localStorage key in DevTools

### Q: Option text shows "A.", "B.", "C.", "D." prefix
**A:** This is intentional design:
1. Prefixes added automatically by app
2. Raw JSON has full text without prefixes
3. If prefix missing: Check raw JSON in data file
4. If unwanted: Modify `formatOptions()` in `js/app.js`

### Q: Images/HTML in questions not displaying
**A:** Rich content not rendered:
1. Check question text includes HTML/img tags
2. Verify `innerHTML` is used (not `textContent`)
3. Check `js/app.js` → `renderQuestion()` function
4. Enable HTML rendering: Might be sanitized
5. Check browser console for CSP errors

### Q: Can't submit answer
**A:** Form submission failed:
1. Ensure all required fields filled
2. Check browser console for errors
3. Verify network connection
4. Check that selected an option
5. Verify test not expired (if time-limited)
6. Check admin didn't close test

---

## Performance & Speed

### Q: Application is slow to load
**A:** Performance optimization needed:
1. Check network waterfall (DevTools → Network)
2. Look for slow API requests or large assets
3. Enable gzip compression in server
4. Implement lazy loading for questions
5. Reduce bundle size:
   ```bash
   npm run build --analyze
   ```
6. Check for blocking JavaScript:
   ```bash
   # In DevTools Performance tab, record and analyze
   ```

### Q: Test questions load slowly
**A:** Content loading is slow:
1. Check if using large data files (>1MB)
2. Split large files into multiple files
3. Implement pagination in question list
4. Use lazy loading for option text
5. Check server response time:
   ```bash
   time curl http://localhost:3000/api/questions?topic=ethics&test=01
   ```

### Q: Heatmap tracking slowing down page
**A:** Analytics tracking is impacting performance:
1. Disable heatmap during development
2. Reduce heatmap event batch size
3. Debounce events: Increase `HEATMAP_EVENT_DEBOUNCE_MS`
4. Send heatmap data asynchronously
5. Check how many events queued:
   ```javascript
   console.log('Heatmap queue:', window.heatmapQueue?.length);
   ```

### Q: High memory usage
**A:** Memory leak or inefficient caching:
1. Check DevTools Memory tab for leaks
2. Take heap snapshot before/after
3. Look for growing arrays (localStorage?)
4. Check if events cleaned up
5. Monitor with:
   ```javascript
   setInterval(() => {
     console.log('Memory:', performance.memory);
   }, 5000);
   ```

---

## Admin Panel

### Q: Admin panel won't load
**A:** Admin authentication failed:
1. Check token in localStorage:
   ```javascript
   console.log(localStorage.getItem('admin_token'));
   ```
2. Verify token is valid (not expired)
3. Check that `/api/admin/auth/verify` succeeds:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
     http://localhost:3000/api/admin/auth/verify
   ```
4. Verify ADMIN_TOKEN in environment variables
5. Try re-logging in

### Q: Can't create new questions
**A:** Question creation failed:
1. Check all required fields filled
2. Verify 4 options entered (not more, not less)
3. Check correct answer index is 0-3
4. Verify option feedback format
5. Check browser console for validation errors
6. Try in different browser
7. Check server logs for errors

### Q: Import CSV file fails
**A:** CSV parsing or validation failed:
1. Verify CSV format:
   - Headers: `topic,question,option_a,option_b,option_c,option_d,correct_answer,explanation`
   - No extra columns
   - Correct delimiter (comma, not semicolon)
2. Check for special characters that need escaping
3. Verify file encoding is UTF-8
4. Try smaller batch (< 100 rows) to identify issue
5. Check DevTools Console for specific error message

### Q: Export data shows error
**A:** Export failed:
1. Verify format is valid: "json", "csv", or "pdf"
2. Check topic exists and has questions
3. Ensure you have permission to export
4. Verify disk space available on server
5. Check file is being generated:
   ```bash
   ls -lah /tmp/ | grep export
   ```

### Q: Validation shows false positives
**A:** Validation too strict or incorrect:
1. Run specific validation:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
     "http://localhost:3000/api/admin/validate?topic=ethics&test=01"
   ```
2. Check validation rules in documentation
3. Verify data matches schema
4. Try disabling strict mode (if available)

---

## Deployment & Infrastructure

### Q: Worker not starting in development
**A:** Wrangler setup issue:
1. Verify Node.js installed: `node --version`
2. Verify wrangler installed: `npm list -g wrangler`
3. Update wrangler: `npm install -g wrangler@latest`
4. Check `wrangler.jsonc` syntax (JSON5 format)
5. Verify D1 database binding exists
6. Clear cache: `rm -rf .wrangler`
7. Try: `wrangler dev --local`

### Q: Database connection fails
**A:** D1 database not accessible:
1. Verify D1 binding in `wrangler.jsonc`:
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "mcq_db"
   ```
2. Check database exists: `wrangler d1 list`
3. Verify migrations ran: `wrangler d1 migrations list`
4. Check SQL syntax in migrations
5. Try connecting directly:
   ```bash
   wrangler d1 execute mcq_db --file migrations/0001.sql
   ```

### Q: Environment variables not being read
**A:** Configuration issue:
1. Check variable defined in `wrangler.jsonc` under `[vars]`
2. Verify variable name matches: `env.VARIABLE_NAME`
3. For local dev: Check `.env` file format
4. Verify no typos in variable names
5. Restart dev server after changing variables
6. Check that variables are exported in `wrangler.jsonc`

### Q: HTTPS not working locally
**A:** SSL certificate issue:
1. For localhost: Service Worker requires secure context
2. Use `http://localhost` for development (allowed exception)
3. For testing HTTPS locally:
   ```bash
   # Generate self-signed cert
   openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
   ```
4. Use ngrok for testing: `ngrok http 3000`

---

## Email & Notifications

### Q: Password reset email not sending
**A:** Email service not configured:
1. Check which provider: Resend or Postmark
2. Verify API key is set:
   ```bash
   curl http://localhost:3000/api/debug/reset-email
   ```
3. Check API key is valid (not expired)
4. Verify sender email is verified with provider
5. Check email provider rate limits
6. Look for API errors in server logs

### Q: Email goes to spam
**A:** Email not authenticated:
1. Set up SPF record:
   ```
   v=spf1 include:resend.com ~all
   ```
   (or include:mail.postmarkapp.com for Postmark)
2. Set up DKIM record (provider specific)
3. Set up DMARC record:
   ```
   v=DMARC1; p=none; rua=mailto:admin@example.com
   ```
4. Add domain to email provider verification
5. Test email authentication: `https://mxtoolbox.com/`

### Q: Email sending too slowly
**A:** Email delivery bottleneck:
1. Check API rate limits with email provider
2. Increase batch delay if applicable
3. Use async email sending (don't block user)
4. Check network connectivity to email API
5. Consider queue system for high volume

---

## Analytics & Heatmaps

### Q: Heatmap data not showing
**A:** Analytics tracking not working:
1. Verify heatmap database configured
2. Check if tracking enabled: `HEATMAP_ENABLED=true`
3. Verify events being sent:
   ```javascript
   console.log('Heatmap Queue:', window.heatmapQueue);
   ```
4. Check DevTools Network tab for `/api/heatmap/track` calls
5. Verify D1 database has heatmap table
6. Check data retention hasn't purged old data

### Q: Session replay not recording
**A:** Replay feature not working:
1. Verify `HEATMAP_REPLAY_RETENTION_DAYS` > 0
2. Check if session is tracked:
   ```javascript
   console.log('Session ID:', document.cookie);
   ```
3. Verify DOM elements have `id` or `class` for replay
4. Check DevTools Network for replay events
5. Verify database storage isn't full

### Q: Analytics query returning no data
**A:** Data not found in database:
1. Verify correct date range
2. Check if data older than retention period
3. Verify topic/test ID exists
4. Try broader query parameters
5. Check database query:
   ```bash
   wrangler d1 execute mcq_db --command "SELECT COUNT(*) FROM analytics"
   ```

### Q: Heatmap visualization too zoomed/scaled
**A:** Canvas rendering issue:
1. Check viewport settings in HTML
2. Verify device pixel ratio handling
3. Check CSS transform scale values
4. Try different browser/device
5. Check if recording at different resolution

---

## Getting More Help

### Resources
- **API Documentation**: `ADMIN_API_REFERENCE.md`
- **Setup Guide**: `ADMIN_INTEGRATION.md`
- **Quick Reference**: `ADMIN_QUICK_REFERENCE.md`
- **Environment Variables**: `WORKER_ENVIRONMENT_VARIABLES.md`

### Debugging Steps
1. Check browser console: `F12` → Console
2. Check network requests: `F12` → Network
3. Check server logs: Terminal where server running
4. Check database: `wrangler d1 execute mcq_db --command "SELECT..."`
5. Enable debug logging: `DEBUG=true` environment variable

### Reporting Issues
Include:
1. Error message (exact text)
2. Steps to reproduce
3. Browser/OS version
4. Network requests (screenshot)
5. Server logs (relevant section)
6. Expected vs actual behavior

---

**Last Updated:** March 26, 2026  
**Version:** 1.0.0
