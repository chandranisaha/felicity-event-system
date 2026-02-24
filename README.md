# Felicity Event Management System

A full-stack MERN platform for managing Felicity events with role-based portals for Participants, Organizers, and Admin.

## 1. Assignment Scope
This submission implements:
- Part 1 core system requirements (authentication, models, event workflows, participant/organizer/admin features)
- Part 2 advanced features with selected Tier A, Tier B, and Tier C items

## 2. Technology Stack (MERN)

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- bcryptjs (password hashing)
- jsonwebtoken (JWT auth)
- nodemailer (SMTP email)
- qrcode (ticket QR generation)
- socket.io (real-time forum updates)
- dotenv, cors

### Frontend
- React (Vite)
- react-router-dom (routing + role-protected pages)
- socket.io-client (forum real-time updates)
- html5-qrcode (camera/image attendance scan)

## 3. User Roles
- Participant (IIIT / Non-IIIT)
- Organizer (clubs/councils/fest teams)
- Admin

Each account has exactly one role.

## 4. Implemented Core Features (Part 1)

### 4.1 Authentication and Security
- Participant registration/login
- Organizer login only (no self-registration)
- Admin backend-provisioned (no UI registration)
- bcrypt password hashing
- JWT auth + role middleware
- Session persistence and logout token clear
- Optional CAPTCHA + login rate-limiting foundation
- Optional CAS flow support (env-controlled)

### 4.2 User Onboarding and Preferences
- Participant onboarding with:
  - interests (multi-select)
  - followed clubs/organizers
- Preferences persisted and editable in profile
- Used in recommendation/filtering flows

### 4.3 Data Models
- Participant
- Organizer
- Admin
- Event
- Ticket
- OrganizerPasswordResetRequest
- ForumMessage
- ParticipantNotification
- OrganizerNotification

### 4.4 Event Types and Attributes
- Normal Event (individual registration)
- Merchandise Event (individual purchase/registration)
- Required event attributes implemented:
  - name, description, eventType, eligibility
  - registration deadline
  - start/end dates
  - registration limit
  - registration fee
  - organizer reference
  - tags
- Dynamic event status on fetch (Upcoming/Ongoing/Completed) with manual override support

### 4.5 Participant Features
- Navbar: Dashboard, Browse Events, Clubs/Organizers, Profile, Logout
- My Events dashboard (upcoming/history categories)
- Browse with search/filters/trending
- Event details with registration/purchase constraints
- Profile edit + password change
- Clubs listing + follow/unfollow
- Organizer detail page (profile + events)
- In-app notifications

### 4.6 Registration Workflows
- Normal event registration:
  - dynamic form validation
  - ticket generation with QR
  - ticket email dispatch
- Merchandise flow:
  - variant/size/color/quantity support
  - purchase limit and stock checks
  - pending approval workflow
  - approval-based final ticket + QR

### 4.7 Organizer Features
- Dashboard with event controls and analytics
- Attendance marking (manual/QR scan)
- Attendance CSV export
- Pending merchandise approval actions
- Event create/edit with draft/publish flow
- Dynamic form builder with lock after first registration
- Organizer profile + Discord webhook config
- Organizer notification center

### 4.8 Admin Features
- Dashboard overview
- Organizer creation (manual/auto password)
- Disable/enable organizers
- Permanent organizer delete with cascading cleanup
- Organizer password reset request management

## 5. Advanced Features (Part 2)

### Tier A (2 selected)
1. Merchandise Payment Approval Workflow
2. QR Scanner and Attendance Tracking

### Tier B (2 selected)
1. Real-Time Discussion Forum
2. Organizer Password Reset Workflow

### Tier C (1 selected)
1. Add to Calendar Integration (.ics + Google + Outlook)

## 6. API Modules (High-Level)
- Auth: `/api/auth/*`
- Events: `/api/events/*`
- Forum: `/api/events/:eventId/forum/*`
- Participant: `/api/participants/*`
- Organizer: `/api/organizers/*`
- Admin: `/api/admin/*`

## 7. Local Setup

### Prerequisites
- Node.js 18+
- npm 9+
- MongoDB Atlas URI

### Install
```bash
cd backend
npm install
cd ../frontend
npm install
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

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

## 8. Environment Variables (Backend)
Minimum required:
```env
PORT=5000
MONGO_URI=<mongo_uri>
JWT_SECRET=<secret>
```

Email options:
```env
# SMTP
EMAIL_PROVIDER=smtp
EMAIL_USER=<gmail_or_smtp_user>
EMAIL_PASS=<app_password_or_smtp_pass>
EMAIL_FROM=Felicity Event System <sender@example.com>

# OR Resend
EMAIL_PROVIDER=resend
RESEND_API_KEY=<resend_api_key>
EMAIL_FROM=<verified_resend_sender>
```

Optional:
```env
CAPTCHA_ENFORCE=false
CAS_ENABLED=false
FRONTEND_BASE_URL=http://localhost:5173
```

## 9. Deployment

### Production URLs
- Frontend URL: https://felicity-event-system-beta.vercel.app
- Backend Base API URL: https://felicity-backend-suf9.onrender.com

### Hosting
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas

### Required Submission File
`deployment.txt` is included at repository root with production links.

## 10. Utility Scripts
From `backend`:
```bash
npm run provision:admin
npm run seed:events
```

## 11. Notes
- Organizer and club are treated as equivalent entities.
- Disabled organizers cannot log in again.
- Permanent organizer delete removes associated organizer-owned data.
- QR attendance includes duplicate-scan handling and audit-safe flows.
