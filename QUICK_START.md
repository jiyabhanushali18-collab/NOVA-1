# Quick Start Guide: Email Verification Testing

## 🚀 Get Started in 2 Minutes

### Step 1: Start the Development Server
```bash
cd NOVA-1
npm run dev
```

You should see:
```
✨ Server running at http://localhost:3000
```

### Step 2: Open the App
- Navigate to http://localhost:3000 in your browser
- You'll see the NOVA splash screen

### Step 3: Create an Account
1. Click **"Create Account"** tab on the login screen
2. Fill in the form:
   ```
   Full Name: John Doe
   Email: john@example.com
   Address: (optional) 123 Main St
   PIN Code: (optional) 560038
   ```
3. Click **"Continue"**

### Step 4: Watch the Magic ✨
- You'll see a loading message "Verification code sent to your email!"
- You'll automatically navigate to the **Email Verification** screen

### Step 5: Get the OTP
In the **server terminal** (where `npm run dev` is running), look for:
```
[DEV MODE] OTP for john@example.com: 123456
```

Copy this 6-digit code.

### Step 6: Enter the OTP
1. On the verification screen, you can:
   - **Type each digit** - automatically advances to next box
   - **Paste all digits** - Ctrl+V pastes the full code
   - **Use backspace** - deletes and moves to previous box

2. Once all 6 digits are entered, click **"Verify Email"**

### Step 7: Success! 🎉
- You'll see a success animation
- Automatically redirected to **Profile Setup**
- Continue setting up your profile

---

## 🧪 Test Different Scenarios

### Scenario A: Wrong OTP
1. Enter wrong code (e.g., "000000")
2. Click Verify
3. See error: "Invalid OTP. 2 attempts remaining."
4. Try again (max 3 times)

### Scenario B: Resend OTP
1. Click "Resend OTP"
2. See countdown: "00:30"
3. Wait 30 seconds (or scroll up and fake-wait)
4. New OTP appears in server logs

### Scenario C: Change Email
1. Click "Change Email" link
2. Return to signup form
3. Enter new email and continue

### Scenario D: Paste Full OTP
1. Copy OTP from server logs
2. Click any box in the OTP input
3. Paste (Ctrl+V)
4. All 6 digits populate
5. Click Verify

---

## 📝 What You're Testing

✅ **Backend:**
- OTP generation
- Email sending (logged to console)
- OTP verification
- Rate limiting
- Expiration logic

✅ **Frontend:**
- Beautiful UI matching NOVA design
- OTP input with auto-advance
- Paste support
- Error handling
- Loading states
- Success animation

✅ **Integration:**
- AuthView → Email Verification flow
- Firebase user creation
- Navigation to profile setup

---

## 🔍 Debugging Tips

### Check Server Logs
```
[DEV MODE] OTP for user@email.com: 123456
```

### Check Browser Console
- Open DevTools (F12)
- Check Console tab for errors
- Network tab shows API calls to `/api/auth/send-otp` and `/api/auth/verify-otp`

### Test API Directly
```bash
# Terminal 1: Check if backend is running
curl http://localhost:3000/api/auth/send-otp

# Terminal 2: Send OTP (will return error but confirms endpoint works)
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

---

## 📋 Checklist

- [ ] Server running (`npm run dev`)
- [ ] Navigate to `http://localhost:3000`
- [ ] Click "Create Account"
- [ ] Fill form and click "Continue"
- [ ] Email verification screen appears
- [ ] See OTP in server terminal
- [ ] Enter OTP and verify
- [ ] Success animation plays
- [ ] Navigate to profile setup

---

## ✅ Expected Behavior

| Step | Expected | Status |
|------|----------|--------|
| Click Continue | Navigate to verification screen | ✓ |
| Server logs OTP | See `[DEV MODE] OTP for ...` | ✓ |
| Type OTP | Auto-advance between boxes | ✓ |
| Click Verify | API call sent | ✓ |
| Success | Animation + navigation | ✓ |

---

## 🆘 Common Issues

### Issue: Server won't start
```
Error: Port 3000 already in use
```
**Solution:** 
```bash
# Kill process on port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -i :3000
kill -9 <PID>
```

### Issue: No OTP in server logs
**Check:**
- Is `BREVO_API_KEY` set? (should be empty for dev mode)
- Is server running in correct terminal?
- Look carefully at terminal output

### Issue: UI looks broken
**Check:**
- Browser zoom is 100%
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+F5)

### Issue: Verification says email not found
**Cause:** OTP expired (> 5 minutes)
**Solution:** Request new OTP via Resend button

---

## 📱 Test on Mobile (Optional)

### Android Emulator (Capacitor)
```bash
# Build APK
npm run build

# Run on emulator
npx cap run android

# Same testing process
```

### iOS Simulator
```bash
# Build and run
npx cap run ios
```

---

## 🎯 Next Steps

After successful test:
1. Get Brevo API key: https://www.brevo.com
2. Add to `.env.local`:
   ```env
   BREVO_API_KEY=your-actual-key
   BREVO_SENDER_EMAIL=noreply@yourapp.com
   ```
3. Restart server
4. Emails will be sent instead of logged

---

## 📚 Learn More

- Full guide: [EMAIL_VERIFICATION_GUIDE.md](./EMAIL_VERIFICATION_GUIDE.md)
- API docs: [API_REFERENCE.md](./API_REFERENCE.md)
- Code: Check `/server/authRouter.ts` and `/src/components/EmailVerificationView.tsx`

---

## ❓ Questions?

Check the comprehensive guides:
- **Implementation Details**: `EMAIL_VERIFICATION_GUIDE.md`
- **API Endpoints**: `API_REFERENCE.md`
- **Source Code**: 
  - Backend: `server/authRouter.ts`
  - Frontend: `src/components/EmailVerificationView.tsx`
  - Integration: `src/App.tsx`, `src/components/AuthView.tsx`

---

Enjoy testing! 🚀
