# Viewing Backend Login Logs

## Morgan HTTP Logs

With Morgan middleware enabled, you'll see HTTP requests in your terminal:

```
POST /auth/login 200 234ms - 456
POST /auth/login 401 123ms - 45
```

Format: `METHOD PATH STATUS_CODE RESPONSE_TIME SIZE`

## Detailed Login Logs

The backend now logs detailed information about login attempts:

### Successful Login:
```
[AuthController] Login attempt for email: alice@example.com
[AuthService] Validating user: alice@example.com
[AuthService] Login successful for: alice@example.com (role: Master)
[AuthController] Login successful for email: alice@example.com
POST /auth/login 200 234ms
```

### Failed Login:
```
[AuthController] Login attempt for email: wrong@example.com
[AuthService] Validating user: wrong@example.com
[AuthService] User not found: wrong@example.com
[AuthService] Login failed for: wrong@example.com
[AuthController] Login failed for email: wrong@example.com
POST /auth/login 401 123ms
```

## Viewing Logs

1. **In Terminal** - All logs appear in your backend terminal where you ran `npm run start:dev`

2. **Search for Login Attempts**:
   ```bash
   # In backend terminal, you'll see all requests
   # Look for lines containing "Login" or "POST /auth/login"
   ```

3. **Common Log Messages**:
   - `Login attempt for email: [email]` - Request received
   - `User not found: [email]` - Email doesn't exist in database
   - `Invalid password for user: [email]` - Password doesn't match
   - `Login successful for: [email]` - Authentication successful
   - `Login failed for: [email]` - Authentication failed

## Test Users

Use these seeded users to test:
- `alice@example.com` / `password123` - Master
- `charlie@example.com` / `password123` - Company Admin
- `bob@example.com` / `password123` - Department Head
- `jane@example.com` / `password123` - Manager
- `john@example.com` / `password123` - Staff

## Troubleshooting

If login fails, check logs for:
1. **401 Unauthorized** - Invalid credentials
2. **500 Internal Server Error** - Database/backend error
3. **404 Not Found** - Route not found (check backend is running)
4. **Network Error** - Backend not accessible from frontend




