# NOVA Email Verification API Reference

## Backend Endpoints

### 1. Send OTP Email

**Endpoint:** `POST /api/auth/send-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to your email",
  "email": "user@example.com",
  "expiresIn": 300
}
```

**Error Responses:**
```json
// Invalid email
{
  "success": false,
  "error": "Invalid email format"
}

// Missing email
{
  "success": false,
  "error": "Email is required"
}

// Rate limited (too soon after last send)
{
  "success": false,
  "error": "Please wait 25 seconds before requesting a new code",
  "retryAfter": 25
}

// Brevo API error
{
  "success": false,
  "error": "Failed to send verification email. Please try again."
}
```

**Rate Limits:**
- Minimum 30 seconds between sends to same email
- OTP valid for 5 minutes
- Unique OTP generated per request (old OTP invalidated)

---

### 2. Verify OTP

**Endpoint:** `POST /api/auth/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "user@example.com",
  "verified": true
}
```

**Error Responses:**
```json
// Invalid OTP
{
  "success": false,
  "error": "Invalid OTP. 2 attempts remaining.",
  "attemptsRemaining": 2
}

// OTP expired
{
  "success": false,
  "error": "OTP has expired. Please request a new code."
}

// Max attempts exceeded
{
  "success": false,
  "error": "Maximum attempts exceeded. Please request a new code."
}

// OTP not found (never requested)
{
  "success": false,
  "error": "OTP not found. Please request a new code."
}

// Missing parameters
{
  "success": false,
  "error": "Email is required"
}
```

**Security Features:**
- Maximum 3 attempts per OTP
- OTP automatically deleted after successful verification
- OTP automatically deleted after max attempts exceeded
- OTP automatically deleted after expiration
- SHA-256 hashing prevents OTP comparison attacks

---

## Frontend Integration

### Component Props

**EmailVerificationView**
```typescript
interface EmailVerificationViewProps {
  email: string;                          // Email being verified
  onVerificationSuccess: () => void;      // Called on success
  onChangeEmail: () => void;              // Called when user wants to change email
}
```

### AuthView Props

```typescript
interface AuthViewProps {
  onLoginSuccess: (
    name: string,
    email: string,
    phone: string,
    isSignUp?: boolean,
    address?: string,
    pinCode?: string
  ) => void;
  onProceedToEmailVerification?: (
    email: string,
    name: string,
    address?: string,
    pinCode?: string
  ) => void;
  initialMode?: 'login' | 'signup';
}
```

---

## Environment Variables

### Optional (Development)
```env
# For testing without email delivery
BREVO_API_KEY=           # Leave empty for dev mode
```

### Required (Production)
```env
BREVO_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=NOVA Vision Labs
```

---

## Screen IDs and Navigation

### Screen ID Type
```typescript
type ScreenId = 
  | ... (existing screens)
  | 'email-verification'   // NEW
  | ...
```

### Navigation Flow

**Signup Path:**
```
'signup' (AuthView)
    ↓
[User clicks Continue]
    ↓
/api/auth/send-otp
    ↓
'email-verification' (EmailVerificationView)
    ↓
[User enters OTP]
    ↓
/api/auth/verify-otp
    ↓
'setup-preferences' (SetupPreferencesView)
    ↓
'profile' (ProfileView)
    ↓
'home' (HomeView)
```

**Login Path (Unchanged):**
```
'login' (AuthView)
    ↓
[User enters phone]
    ↓
'home' (HomeView)
```

---

## Caching & State Management

### Session Storage
- `pendingEmailVerification` - Stores email, name, address, PIN during verification
- Cleared after successful verification
- Can be reset if user clicks "Change Email"

### Local Storage (Existing)
- `isLoggedIn` - Updated after verification
- `userName` - Set during verification
- `userEmail` - Set during verification
- `userAddress` - Set if provided
- `userPinCode` - Set if provided

---

## Testing with cURL

### Send OTP
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

### Verify OTP (with 123456)
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","otp":"123456"}'
```

---

## Postman Collection

**Send OTP Request:**
- Method: POST
- URL: `{{base_url}}/api/auth/send-otp`
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "email": "test@example.com"
  }
  ```

**Verify OTP Request:**
- Method: POST
- URL: `{{base_url}}/api/auth/verify-otp`
- Headers: `Content-Type: application/json`
- Body:
  ```json
  {
    "email": "test@example.com",
    "otp": "123456"
  }
  ```

---

## Firebase Integration

After successful OTP verification, the app automatically:

1. Creates Firebase Authentication user
   - Email: user@example.com
   - Email verified: true

2. Creates Firestore document
   - Collection: `users`
   - Document ID: Firebase UID
   - Fields include: uid, email, emailVerified: true, createdAt, updatedAt, preferences, wardrobeCount, etc.

---

## Performance Metrics

| Operation | Time | Notes |
|-----------|------|-------|
| OTP Generation | < 1ms | Cryptographic generation |
| OTP Hashing | < 1ms | SHA-256 hashing |
| Email Send | 1-2s | Brevo API call |
| OTP Verification | < 10ms | Hash comparison + validation |
| Firebase Create | 2-3s | Auth + Firestore |

---

## Troubleshooting

### "OTP not found" error
- User never requested OTP
- OTP expired (> 5 minutes)
- OTP was already verified and deleted
- Solution: Request new OTP

### "Max attempts exceeded"
- User entered wrong OTP 3 times
- Solution: Request new OTP

### Email not received
- Check BREVO_API_KEY is set
- Check sender email is authorized in Brevo
- Check spam folder
- In dev mode, check server console logs

### Network timeout
- Ensure backend is running (`npm run dev`)
- Check network connectivity
- Verify BREVO_API_KEY format
- Check Brevo API status

---

## Code Examples

### Frontend: Calling Send OTP
```typescript
const handleSendOTP = async (email: string) => {
  try {
    const response = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('OTP sent to:', data.email);
      // Navigate to verification screen
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

### Frontend: Calling Verify OTP
```typescript
const handleVerifyOTP = async (email: string, otp: string) => {
  try {
    const response = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Email verified!');
      // Create Firebase user and proceed
    } else {
      console.error('Verification failed:', data.error);
      // Show error message
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};
```

---

## Related Files

- Backend: `/server/authRouter.ts`
- Frontend: `/src/components/EmailVerificationView.tsx`
- Updated Components: `/src/components/AuthView.tsx`
- Updated App: `/src/App.tsx`
- Types: `/src/types.ts`
- Server Entry: `/server.ts`
- Documentation: `/EMAIL_VERIFICATION_GUIDE.md`
