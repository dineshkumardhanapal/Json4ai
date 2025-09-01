# Google OAuth Setup Guide for JSON4AI

## Overview
This guide explains how to complete the Google OAuth integration for JSON4AI's login and registration system.

## Current Implementation Status
✅ **Frontend Integration Complete**
- Google Sign-In SDK loaded on login and register pages
- OAuth buttons implemented with proper styling
- JavaScript handlers for Google authentication
- Fallback error handling implemented

⚠️ **Backend Integration Required**
- Google OAuth endpoint needs to be implemented
- Client ID needs to be configured
- Token verification needs to be added

## Setup Steps

### 1. Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing project
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client IDs"
5. Configure the OAuth consent screen
6. Add authorized domains:
   - `https://json4ai.com`
   - `https://json4ai.onrender.com` (if using Render)
   - `http://localhost:3000` (for development)

### 2. Frontend Configuration
Update the Google Client ID in `frontend/js/auth.js`:

```javascript
// Replace this placeholder with your actual Google Client ID
const GOOGLE_CLIENT_ID = 'your-actual-google-client-id.googleusercontent.com';
```

### 3. Backend Implementation Required
Create a new endpoint at `/api/auth/google` that:

1. **Verifies the Google ID token:**
```javascript
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return payload;
}
```

2. **Extracts user information:**
```javascript
const { email, name, given_name, family_name, picture } = payload;
```

3. **Creates or updates user account:**
- Check if user exists by email
- If new user, create account with Google data
- If existing user, update last login
- Generate JWT tokens (access & refresh)
- Return tokens to frontend

### 4. Environment Variables
Add to your backend environment:
```env
GOOGLE_CLIENT_ID=your-google-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 5. Database Schema Updates
Ensure your user table supports:
- `google_id` (string, nullable)
- `provider` (string, default: 'email', can be 'google')
- `avatar_url` (string, nullable) - for Google profile picture
- `email_verified` (boolean) - Google users are pre-verified

## Security Considerations

1. **Token Validation:** Always verify Google ID tokens server-side
2. **HTTPS Required:** Google OAuth requires HTTPS in production
3. **Domain Validation:** Ensure authorized domains are correctly configured
4. **Rate Limiting:** Implement rate limiting for OAuth endpoints
5. **Error Handling:** Provide clear error messages for OAuth failures

## Testing

### Development Testing
1. Use `http://localhost:3000` as authorized domain
2. Test with multiple Google accounts
3. Test account linking scenarios
4. Test error cases (network failures, invalid tokens)

### Production Testing
1. Verify HTTPS configuration
2. Test with real domain
3. Monitor OAuth success/failure rates
4. Test mobile responsiveness

## Current Frontend Features

### Login Page (`frontend/login.html`)
- Google Sign-In button above email/password form
- Proper error handling and user feedback
- Seamless integration with existing login flow
- Mobile-responsive design

### Register Page (`frontend/register.html`)
- Google Sign-Up button above registration form
- Consistent styling with login page
- Proper form validation and error handling
- Terms of service integration

### JavaScript Implementation (`frontend/js/auth.js`)
- Google SDK initialization
- Token handling and API communication
- Error handling with user-friendly messages
- Automatic redirection on successful authentication

## Troubleshooting

### Common Issues
1. **"Google Sign-In is not available"**
   - Check if Google SDK is loaded
   - Verify client ID is set correctly
   - Check browser console for errors

2. **OAuth popup blocked**
   - Use `google.accounts.id.prompt()` instead of popup
   - Implement fallback messaging

3. **Invalid client ID**
   - Verify client ID in Google Cloud Console
   - Check authorized domains configuration

4. **CORS errors**
   - Ensure proper CORS headers on backend
   - Verify authorized origins in Google Console

## Next Steps
1. Implement backend OAuth endpoint
2. Configure Google Client ID
3. Test end-to-end authentication flow
4. Monitor authentication success rates
5. Add user profile picture support

## Support
For implementation questions, refer to:
- [Google Identity Documentation](https://developers.google.com/identity/gsi/web)
- [Google OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)

