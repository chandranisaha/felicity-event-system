# Felicity Event Management System

A full-stack MERN platform for Felicity event operations with three role-based portals: Participant, Organizer, and Admin.

This project centralizes event registration, merchandise workflows, ticketing, QR attendance, organizer governance, and forum communication into one system.

## 1. Assignment Context

Course: **Design & Analysis of Software Systems**  
Deliverable Type: **MERN full-stack implementation (Part 1 + selected Part 2 tiers)**

## 2. Tech Stack and Justification

### Backend (Node.js + Express + MongoDB)
- **Express.js**: REST API routing and role-based middleware control.
- **MongoDB + Mongoose**: schema-driven modeling, references across users/events/tickets, and fast iteration for dynamic forms.
- **bcryptjs**: password hashing (no plaintext credentials).
- **jsonwebtoken (JWT)**: stateless auth for protected endpoints.
- **nodemailer**: real SMTP ticket delivery.
- **qrcode**: QR generation for ticket validation and attendance.
- **socket.io**: real-time forum messaging and notifications.
- **cors + dotenv**: environment safety and cross-origin frontend/backend operation.

### Frontend (React)
- **React + Vite**: fast dev loop and modular role-based portal UI.
- **react-router-dom**: protected routing and role redirection.
- **socket.io-client**: live discussion updates.
- **html5-qrcode**: organizer-side camera and image-based QR scanning.

## 3. System Roles

- **Participant**: IIIT or Non-IIIT user, event registration and tracking.
- **Organizer (Club/Council/Fest Team)**: event lifecycle, analytics, moderation, merchandise approvals.
- **Admin**: organizer provisioning, governance, and reset request handling.

Each user has exactly one role.

## 4. Assignment Compliance Matrix (Part 1)

### 4.1 Authentication and Security
- Participant registration/login implemented.
- Organizer self-registration blocked; organizer accounts created by admin only.
- Admin is backend-provisioned; no UI admin registration flow.
- Passwords hashed with bcrypt.
- JWT auth + role middleware on protected routes.
- Session persistence via stored auth token; logout clears token.
- CAPTCHA support and login rate-limit foundation implemented (configurable by env).
- IIIT participant flow includes domain validation and optional CAS path (env-driven).

### 4.2 User Onboarding and Preferences
- Post-signup participant onboarding supports:
  - multi-select interests,
  - follow clubs/organizers,
  - skip-and-complete-later behavior.
- Preferences stored in DB and editable in profile.
- Browse/recommendation ordering can prioritize followed organizers/interests.

### 4.3 Data Models
Implemented model set includes:
- `Participant`
- `Organizer`
- `Admin`
- `Event`
- `Ticket`
- `OrganizerPasswordResetRequest`
- `ForumMessage`
- `ParticipantNotification`
- `OrganizerNotification`

Participant fields include first/last name, email, participant type, college/org, contact number, password hash, preferences.
Organizer fields include name, category, description, contact email, auth state, and reset history.

### 4.4 Event System
- Event type support:
  - **Normal Event (individual)**
  - **Merchandise Event (individual purchase)**
- Required event attributes implemented:
  - name, description, event type, eligibility,
  - registration deadline,
  - start/end date,
  - registration limit,
  - registration fee,
  - organizer reference,
  - tags.
- Dynamic status computed on fetch (upcoming/ongoing/completed) with manual override support.

### 4.5 Participant Features
- Navbar includes dashboard, browse events, clubs/organizers, profile, logout.
- My Events dashboard includes upcoming + categorized history.
- Event records include ticket/status and event linking.
- Browse events supports search/filter workflow and trending display.
- Event details include registration/purchase validation checks.
- Profile supports editable and non-editable field split.
- Clubs listing + follow/unfollow implemented.
- Organizer details page includes organizer profile + upcoming/past events.

### 4.6 Event Registration Workflows
- **Normal events**:
  - custom field validation,
  - registration constraints,
  - ticket creation,
  - ticket email with QR,
  - history visibility.
- **Merchandise events**:
  - variant and quantity handling,
  - stock/purchase-limit checks,
  - payment workflow integration,
  - approval-gated ticket + QR generation.

### 4.7 Organizer Features
- Organizer navigation and dashboard implemented.
- Event analytics available per event and aggregate views.
- Participant listing and attendance controls available.
- CSV attendance export implemented.
- Event create/edit flow supports draft and publish paths.
- Form builder supports text/dropdown/checkbox/file-URL with required flags and ordering.
- Form lock enforced after first registration.
- Organizer profile includes Discord webhook setting.

### 4.8 Admin Features
- Admin dashboard, organizer management, and reset-request tabs implemented.
- Create organizer (manual password or auto-generated password).
- Disable/enable organizer account.
- Permanent organizer delete with cascade data removal.
- Organizer password reset request review and resolution.

## 5. Advanced Features (Part 2)

### Tier A (2 selected, 8 marks each)
1. **Merchandise Payment Approval Workflow**
2. **QR Scanner and Attendance Tracking**

#### A1. Merchandise Payment Approval Workflow
- Participant submits order with payment proof URL.
- Order state transitions: Pending -> Approved/Rejected.
- No QR and no final ticket confirmation until approval.
- Stock decremented on approval only.
- Approval triggers final ticketing and email confirmation.

#### A2. QR Scanner and Attendance Tracking
- QR payload and QR image generated per valid ticket.
- Attendance scan by payload/camera/image.
- Duplicate scan blocked with conflict response.
- Attendance metadata: timestamp, scanner, audit trail.
- CSV export endpoint for attendance records.

### Tier B (2 selected, 6 marks each)
1. **Real-Time Discussion Forum**
2. **Organizer Password Reset Workflow**

#### B1. Real-Time Discussion Forum
- Event-level live message threads (Socket.IO).
- Organizer moderation (pin/delete).
- Reactions support.
- Notification pipeline for relevant event participants/organizers.

#### B2. Organizer Password Reset Workflow
- Organizer can submit reset request with reason.
- Admin lists and resolves requests.
- On approval, system generates a new password and stores hash.
- Request status tracking + organizer reset history preserved.

### Tier C (1 selected, 2 marks)
1. **Add to Calendar Integration**

#### C1. Calendar Integration
- `.ics` export for registered events.
- Google Calendar and Outlook launch links.

## 6. Key API Surface

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/cas/start`
- `GET /api/auth/cas/callback`

### Events
- `GET /api/events/public`
- `GET /api/events/public/:eventId`
- `GET /api/events/my-events` (Organizer)
- `POST /api/events` (Organizer)
- `PATCH /api/events/:eventId` (Organizer)
- `POST /api/events/:eventId/register` (Participant)
- `POST /api/events/:eventId/cancel-merchandise` (Participant)

### Organizer
- `GET /api/organizers/analytics`
- `GET /api/organizers/events/:eventId/analytics`
- `GET /api/organizers/events/:eventId/attendance/export`
- `POST /api/organizers/attendance/scan`
- `POST /api/organizers/orders/:ticketId/approve`
- `POST /api/organizers/orders/:ticketId/reject`
- `POST /api/organizers/password-reset/request`
- `GET /api/organizers/notifications`
- `DELETE /api/organizers/notifications/:notificationId`

### Participant
- `GET /api/participants/my-events`
- `GET /api/participants/profile`
- `PATCH /api/participants/profile`
- `POST /api/participants/profile/change-password`
- `GET /api/participants/onboarding/options`
- `POST /api/participants/onboarding/complete`
- `GET /api/participants/organizers`
- `GET /api/participants/organizers/:organizerId`
- `POST /api/participants/organizers/:organizerId/follow`
- `DELETE /api/participants/organizers/:organizerId/follow`
- `GET /api/participants/notifications`
- `DELETE /api/participants/notifications/:notificationId`

### Admin
- `POST /api/admin/create-organizer`
- `GET /api/admin/organizers`
- `PATCH /api/admin/organizer/:id/toggle-active`
- `DELETE /api/admin/organizer/:id/permanent`
- `GET /api/admin/password-reset-requests`
- `PATCH /api/admin/password-reset-requests/:id`

### Forum
- `GET /api/events/:eventId/forum/messages`
- `POST /api/events/:eventId/forum/messages`
- `PATCH /api/events/:eventId/forum/messages/:messageId/pin`
- `PATCH /api/events/:eventId/forum/messages/:messageId/react`
- `DELETE /api/events/:eventId/forum/messages/:messageId`

## 7. Local Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MongoDB Atlas connection string

### Install
```bash
cd backend
npm install
cd ../frontend
npm install
```

### Environment
Create `backend/.env` from `backend/.env.example`.

Minimum required:
```env
PORT=5000
MONGO_URI=<your_mongo_uri>
JWT_SECRET=<strong_secret>
```

For email/QR and advanced verification:
```env
EMAIL_USER=<smtp_user>
EMAIL_PASS=<smtp_password_or_app_password>
EMAIL_FROM=Felicity Event System <your_email@example.com>
```

Optional hardening:
```env
CAPTCHA_ENFORCE=false
CAPTCHA_PROVIDER=turnstile
TURNSTILE_SECRET_KEY=
RECAPTCHA_SECRET_KEY=
LOGIN_RATE_LIMIT_MAX_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_BLOCK_MS=900000
```

Optional CAS:
```env
CAS_ENABLED=false
CAS_LOGIN_URL=https://login.iiit.ac.in/cas/login
CAS_VALIDATE_BASE_URL=https://login-new.iiit.ac.in/cas
CAS_FALLBACK_VALIDATE_BASE_URL=https://login.iiit.ac.in/cas
FRONTEND_BASE_URL=http://localhost:5173
```

### Run
```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## 8. Utility Scripts

From `backend`:
```bash
npm run provision:admin
npm run seed:events
```

- `provision:admin`: ensures backend-only admin provisioning.
- `seed:events`: seeds realistic organizer/event data for demo/testing.

## 9. Deployment Notes

As per assignment, include root-level `deployment.txt` containing:
- Frontend production URL
- Backend base API URL

Suggested hosting:
- Frontend: Vercel/Netlify
- Backend: Render/Railway/Fly/Heroku-style Node service
- Database: MongoDB Atlas

## 10. Implementation Notes

- Organizer/club terms are treated as equivalent entities.
- Eligibility logic supports IIIT/Non-IIIT/All use cases.
- Disabled organizers are blocked from future login issuance.
- Permanent organizer delete cascades related data.
- Ticket email delivery is implemented as real SMTP behavior.
- Dynamic event status is computed by event timing and can be manually overridden where needed.

## 11. Current Status

The project is implemented as a full multi-role MERN system with assignment-required core workflows plus selected advanced features from Tier A, Tier B, and Tier C.
