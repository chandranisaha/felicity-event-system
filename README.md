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

## 12. Design Choices, Workflows, and Technical Decisions (Final Report Section)

### 12.1 Library, Framework, and Module Justification

#### Backend Justification
- **Express.js** was selected for clear REST route organization and middleware composition across role-based access control.
- **Mongoose** was selected to enforce schema-level validation, references, and lifecycle hooks for complex entities (events, tickets, forum, notifications).
- **bcryptjs** was used to satisfy secure password storage requirements and avoid plaintext password persistence.
- **jsonwebtoken** was selected for stateless session/auth handling and role checks in protected routes.
- **nodemailer** was used for SMTP-based ticket emails in local and standard deployments.
- **Resend API integration** was added as a provider alternative for reliable hosted email delivery on production platforms.
- **qrcode** was selected for deterministic QR generation tied to ticket identity.
- **socket.io** was selected for real-time forum updates and in-app communication.
- **cors** was used to support frontend-backend separation during local/dev/prod deployment.
- **dotenv** was used to isolate secrets and environment-specific runtime settings.

#### Frontend Justification
- **React** was selected for modular, component-based role portals.
- **Vite** was selected for fast local dev and optimized production builds.
- **react-router-dom** was selected for protected role-based routing and dashboard flows.
- **socket.io-client** was selected for live forum/event updates.
- **html5-qrcode** was selected to support organizer attendance scanning via camera and image upload.

#### UI Library Note
- The assignment allows any UI framework (Tailwind, Bootstrap, Material UI, etc.).
- This implementation uses custom CSS with React components to maintain direct control of style consistency and avoid dependency lock-in.

### 12.2 End-to-End User Workflows

#### Participant Workflow
1. Register (IIIT / Non-IIIT path) and login.
2. Complete or skip onboarding preferences (interests, followed clubs).
3. Browse/search/filter events and open details.
4. Register for normal event (dynamic form) or place merchandise order.
5. Receive ticket record and QR (immediate for normal, post-approval for merchandise).
6. Track history, notifications, and profile preferences.

#### Organizer Workflow
1. Login with admin-provisioned credentials.
2. Create event as draft, configure fields, publish.
3. View analytics and participant/ticket data.
4. Approve/reject pending merchandise requests.
5. Mark attendance via QR (camera/image/payload fallback).
6. Export attendance CSV and moderate forum.

#### Admin Workflow
1. Login using backend-provisioned admin account.
2. Create organizer accounts (manual or generated password).
3. Disable/enable or permanently delete organizers.
4. Review and resolve organizer password reset requests.

### 12.3 Advanced Feature Selection Justification

#### Tier A Choices
1. **Merchandise Payment Approval Workflow**: selected for strong business-process modeling (pending -> approved/rejected), stock integrity, and approval-gated ticketing.
2. **QR Scanner & Attendance Tracking**: selected for operational event-day utility, duplicate scan prevention, and measurable attendance reporting.

#### Tier B Choices
1. **Real-Time Discussion Forum**: selected to provide live event communication and organizer-moderated collaboration.
2. **Organizer Password Reset Workflow**: selected to satisfy admin-governed account recovery requirements with auditable status flow.

#### Tier C Choice
1. **Add to Calendar Integration**: selected as a practical user-experience enhancement that improves attendance and schedule management.

### 12.4 Key Technical Decisions
- **Role isolation**: each API path is guarded by JWT + role middleware.
- **Event status rendering**: computed dynamically by date, with manual override where applicable.
- **Form locking rule**: organizer form structure becomes locked after first registration to protect data consistency.
- **Merchandise stock safety**: stock decremented on approval stage, not at pending stage.
- **Email resilience**: registration and approval logic proceed even when email dispatch fails, returning warning metadata.
- **Approval idempotency**: repeated approve calls on already approved orders return safe success response.
- **Large proof handling**: body size limits and client-side image compression mitigate payload rejection.

### 12.5 Local Setup and Installation Summary
- Install backend and frontend dependencies via npm.
- Configure backend `.env` values (DB, JWT, email provider).
- Run backend and frontend servers in separate terminals.
- Use provided utility scripts for admin provisioning and seed data.

### 12.6 Submission Directory Structure (Required)
The project is organized for ZIP submission as:

```text
<roll_no>/
|-- backend/
|-- frontend/
|-- README.md
|-- deployment.txt
```

- `node_modules` is excluded from source submission.
- Deployment links are provided in `deployment.txt`.
