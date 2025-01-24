# Inventory Management Web Application Documentation

This documentation outlines the architecture, features, and functionality of the inventory management web application, including its OAuth integration with Discord, session handling using cookies, server-side logic, and various user flows.

---

## **Overview**
The application is an inventory management system for asset tracking and management. It allows teams to:

- Track and manage assets with dedicated pages.
- Reserve and check out equipment using booking workflows.
- Organize assets into kits and manage custody.
- Visualize bookings in a calendar view.
- Track the GPS location of assets.
- Provide customizable solutions for IT asset management, camera checkouts, educational resource tracking, etc.

### **Core Technologies**
- **Frontend**: React with Remix.js.
- **Backend**: Supabase (PostgreSQL, Authentication APIs).
- **Authentication**: OAuth with Discord.
- **Session Management**: Cookies and server-side logic.
- **Hosting**: Supabase-hosted services.

---

## **Features**

### 1. **Authentication**

#### **OAuth with Discord**
- Users authenticate via Discord.
- Discord provides:
  - `access_token`: Expires after 1 hour.
  - `refresh_token`: Allows fetching a new access token.
- User metadata from Discord includes:
  - Avatar, username, email, and unique Discord ID.

#### **Login Flow**
1. User clicks "Login with Discord."
2. User is redirected to the Discord OAuth page.
3. After successful login:
   - Discord sends `access_token`, `refresh_token`, and user metadata to the `/oauth/callback` endpoint.
   - `access_token` is used to fetch user details.
   - Refresh tokens are stored securely in Supabase for persistent session management.
4. The session is initialized with:
   - Access token expiry (1 hour).
   - A fallback to refresh tokens for seamless renewal.

#### **Session Expiry**
- **Without Refresh Tokens**:
  - Access token expires after 1 hour.
  - User must log in again.
- **With Refresh Tokens**:
  - Refresh tokens allow issuing a new access token, extending session validity indefinitely until the token is revoked or expired.

### 2. **Asset Management**

#### **Asset Pages**
Each asset has a dedicated page for storing:
- Metadata: Name, type, category-specific fields.
- Booking history.
- Current custodian.

#### **Booking Workflows**
- Users can book or check out equipment.
- Prevents double-booking with real-time availability checks.

#### **Custody Management**
- Links users or teams to assets.
- Logs usage history for tracking.

#### **Kit Management**
- Combine multiple assets into kits for group management.
- Customizable kits with images and descriptions.

### 3. **Search and Filtering**
- Search large databases quickly.
- Filter assets by category, availability, or location.

### 4. **Dashboard**
- Visualize asset valuation and statuses.
- Provide a high-level overview of the system.

---

## **System Design**

### **Frontend**
- Built with React and Remix.js.
- Routes:
  - **`/_layout.tsx`**: Manages layout and navigation for authenticated users.
  - **Authentication Routes**:
    - `/login`
    - `/oauth/callback`
  - **Inventory Management Routes**:
    - `/assets`
    - `/bookings`
    - `/kits`

### **Backend**
- **Supabase Database**:
  - Stores user information, asset details, bookings, and refresh tokens.
- **API Endpoints**:
  - **Authentication**:
    - `auth/service.server.ts`: Handles login, signup, and token refresh logic.
    - `/oauth/callback`: Processes tokens from Discord.
  - **Inventory Management**:
    - Asset CRUD operations.
    - Booking workflows.

### **Session Management**

#### **Cookies**
- Sessions are initialized and stored in cookies.
- Secure cookies store:
  - `access_token` (short-lived).
  - `refresh_token` (long-lived).

#### **Session Middleware**
- Middleware validates the session on every request.
- Checks if the `access_token` is expired.
  - If expired, attempts to refresh the token using the `refresh_token`.
  - If refreshing fails, redirects the user to `/login`.

### **OAuth Flow Integration**

#### **Key Files**
1. **`auth/service.server.ts`**
   - Manages:
     - Token exchanges with Discord.
     - Refreshing access tokens.
     - Handling authentication errors.
2. **`oauth.callback.tsx`**
   - Processes Discord's OAuth callback.
   - Initializes user sessions with tokens.
3. **`middleware.ts`**
   - Validates tokens on every request.
   - Implements refresh logic for expired tokens.

#### **Error Handling**
- **Expired Tokens**:
  - Automatically attempt token refresh.
- **Revoked Tokens or Errors**:
  - Logs the user out and redirects to `/login`.
- **SSO Users**:
  - Validates that users linked to SSO can only log in through the associated SSO provider.

### **Database Schema (Simplified)**
1. **Users Table**:
   - `id`, `email`, `discord_id`, `avatar`, `role`, `sso`.
2. **Assets Table**:
   - `id`, `name`, `type`, `location`, `custodian`, `booking_status`.
3. **Bookings Table**:
   - `id`, `asset_id`, `user_id`, `start_time`, `end_time`.
4. **Refresh Tokens Table**:
   - `id`, `token`, `user_id`, `revoked`, `expires_at`.

---

## **Development Notes**

### **Scenarios and Edge Cases**
1. **Session Timeout**:
   - Tokens expire in 1 hour, but refresh logic extends the session seamlessly.
2. **Revoked Refresh Tokens**:
   - Users are logged out immediately if the refresh token is invalid or revoked.
3. **Error Logging**:
   - Comprehensive error logs are generated using `Logger`.

### **Planned Enhancements**
1. **Signed Custody**:
   - Adding electronic signatures for custody handovers.
2. **Advanced Filtering**:
   - Dynamic search filters for specific asset types.
3. **Mobile App Integration**:
   - Synchronizing mobile apps with the web platform.

---

## **FAQs**

### How long are sessions valid?
- Without refresh tokens: 1 hour.
- With refresh tokens: Sessions last until the refresh token is revoked or expires.

### What happens if tokens expire?
- Access tokens are refreshed automatically using refresh tokens.
- If refreshing fails, the user is redirected to `/login`.

### Can sessions persist across devices?
- Yes, provided the refresh token is securely stored on each device.

### How secure is the system?
- All cookies are secure and HTTP-only.
- Short-lived access tokens minimize exposure risk.
- Refresh tokens are stored in the database for server-side validation.

### How are assets managed?
- Each asset has a dedicated page with booking workflows and metadata.
- Kits group assets for bulk management.
- Custody tracking links assets to users or teams.

