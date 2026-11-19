# AP Higher Education - PDF Document Library
*Government Degree College Useful Information*

A modern, responsive full-stack PDF library application with a two-level hierarchy (**Section > Subsection > PDF documents**). Built with Node.js, Express, SQLite, and vanilla ES6+ web components.

---

## Features

### 1. Two-Level Hierarchy & Seed Data
Documents are organized strictly under **Sections** and **Subsections**:
- **PRC**: `2015 PRC`, `2022 PRC`
- **Service**: `Service`
- **Leave**: `Earned Leave`, `ML/HPL`, `EOL`
- **UGC**: `UGC RPS-2006`, `UGC RPS-2016`, `CAS`
- **DA**: `DA GOs`
- **RTF**: `RTF`
- **Fees**: `Special fee`, `Restructured fee`

### 2. Roles & Layout
- **Viewer (Public / No login required)**:
  - **Fixed Left Sidebar**: Lists all main sections (PRC, Service, Leave, UGC, DA, RTF, Fees). Sections expand accordion-style with rotating chevrons to display subsections. On mobile, collapses into a slide-out drawer opened with a menu button.
  - **Single Subsection Direct-Load**: If a section has only one subsection (such as `Service` or `RTF`), clicking it directly loads its documents into the main area without requiring a second click.
  - **Initial Neutral Placeholder**: On initial load, a clean placeholder prompts the user to select a section from the left panel.
  - **Excel-Style Documents Table**: Displays documents in clean grid-styled rows with visible borders, sticky header row, and alternating zebra shading:
    1. `S.No` (Numbered row index)
    2. `Title` (with small muted line below for file size and upload date)
    3. `Description` (neat text wrapping)
    4. `Preview` (button; launches in-browser PDF modal preview)
    5. `Download` (button; downloads official PDF attachment named after title)
  - **In-Table Search Filter**: Instant title/description search box above the table filtering rows of the selected subsection.
  - Strictly read-only access (no upload, edit, or delete controls).
- **Admin**:
  - Secure login with bcrypt password hashing and JWT authentication.
  - Rate-limited login attempts (max 5 attempts per 15 minutes) to protect against brute-force attacks.
  - Upload PDF documents using cascading Section > Subsection dropdowns (Title, Description, Section, and Subsection).
  - Client and server-side PDF validation: PDF format only (MIME type, file extension `.pdf`, and `%PDF` magic byte verification), maximum 10 MB file size limit.
  - Stored on disk with collision-proof unique filenames and served with sanitized user-given titles on download.
  - Edit document metadata (and optionally replace the PDF file).
  - Delete documents with confirmation modal (cleans up physical files from disk).
  - Full management of Sections & Subsections: Add, rename, or delete sections and subsections.

### 3. Cascading Dropdowns & Dynamic Data
- The Admin Upload form and Admin Edit modal use the reusable cascading dropdown component (`public/js/cascading-dropdown.js`).
- The Viewer Sidebar and Admin forms dynamically populate sections and subsections from the API endpoints (`GET /api/sections` and `GET /api/sections/:id/subsections`), never using hardcoded values.

---

## Admin Credentials

| Username | Password |
| :--- | :--- |
| `madhuri` | `m2007` |

### How to Change the Admin Password

#### Method 1: Using the CLI Script
You can update the password for any admin directly from the command line:
```bash
node change-password.js <username> <new_password>
```
**Example:**
```bash
node change-password.js admin MyNewSecurePassword99!
```

#### Method 2: Via API / Authenticated Admin
When logged in as admin:
```http
PUT /api/auth/change-password
Content-Type: application/json
Authorization: Bearer <token>

{
  "currentPassword": "admin123",
  "newPassword": "MyNewSecurePassword99!"
}
```

---

## Setup & Running Locally

### Prerequisites
- **Node.js** (v18.0.0 or v22.0.0+)
- **npm** (v9+ or v10+)

### Installation
1. Clone or open the repository directory:
   ```bash
   cd project_1
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Run the database seed manually:
   ```bash
   npm run seed
   ```
   *(Note: The server will also automatically seed the database on initial start if tables are unseeded).*

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

---

## Project Structure

```
project_1/
├── package.json              # Project dependencies and npm scripts
├── server.js                 # Express server configuration, middleware, and route mounting
├── db.js                     # SQLite database setup (tables, schema, foreign key constraints)
├── seed.js                   # Seed script for admin, sections, subsections, and sample documents
├── change-password.js        # CLI utility to update admin passwords
├── library.db                # SQLite database file (created on initial run)
├── uploads/                  # Storage directory for uploaded PDF documents
├── middleware/
│   └── auth.js               # JWT verification and admin role protection middleware
├── routes/
│   ├── auth.js               # Login, logout, me, and change-password endpoints (rate-limited)
│   ├── sections.js           # Public and admin endpoints for section hierarchy
│   ├── subsections.js        # Public and admin endpoints for subsections
│   └── documents.js          # Public viewing/downloading and admin upload/edit/delete routes
└── public/
    ├── index.html            # Single page app interface (Viewer, Admin Dashboard, Modals)
    ├── css/
    │   └── styles.css        # Clean responsive styles, badges, cards, dropzone, and modals
    └── js/
        ├── api.js            # Unified client-side API layer
        ├── cascading-dropdown.js # Reusable Section > Subsection cascading dropdown component
        ├── viewer.js         # Public viewer search, filtering, and document rendering
        ├── admin.js          # Admin dashboard, uploads, editing, deletion, and hierarchy manager
        ├── auth.js           # Client authentication state, login modal, and session checks
        └── app.js            # App controller, tab switching, and PDF preview modal
```

---

## API Reference

### Public Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/sections` | List all sections with subsection and document counts |
| `GET` | `/api/sections/:id` | Get details of a single section |
| `GET` | `/api/sections/:id/subsections` | List subsections belonging to section `:id` |
| `GET` | `/api/subsections` | List all subsections (supports `?section_id=` filter) |
| `GET` | `/api/documents` | List documents (supports `?section_id=`, `?subsection_id=`, `?search=`) |
| `GET` | `/api/documents/:id` | Get single document metadata |
| `GET` | `/api/documents/:id/download` | Download PDF file attachment named after the document title |
| `GET` | `/api/documents/:id/view` | Stream PDF file for inline browser preview |

### Authentication Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Sign in with username and password; returns JWT and sets cookie |
| `POST` | `/api/auth/logout` | Public | Clears session cookie |
| `GET` | `/api/auth/me` | Admin | Get currently authenticated admin profile |
| `PUT` | `/api/auth/change-password` | Admin | Update current admin password |

### Admin Write Endpoints (Protected by Auth Middleware)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/documents` | Upload a PDF document (`title`, `description`, `subsection_id`, `pdf` multipart file) |
| `PUT` | `/api/documents/:id` | Update document details or replace existing PDF file |
| `DELETE` | `/api/documents/:id` | Delete document from database and delete physical file from disk |
| `POST` | `/api/sections` | Create a new section (`{ name }`) |
| `PUT` | `/api/sections/:id` | Rename section (`{ name }`) |
| `DELETE` | `/api/sections/:id` | Delete section (cascades to subsections and removes files) |
| `POST` | `/api/subsections` | Create a new subsection (`{ section_id, name }`) |
| `PUT` | `/api/subsections/:id` | Rename subsection (`{ name, section_id }`) |
| `DELETE` | `/api/subsections/:id` | Delete subsection and its documents |

---

## Security Highlights

1. **Authentication**: Passwords hashed using `bcrypt` (10 salt rounds). Authentication powered by JWT with expiration and optional HTTP-only cookie support.
2. **Brute Force Protection**: Login attempts are strictly rate-limited using `express-rate-limit` (5 attempts per 15 minutes per IP).
3. **Upload Validation**:
   - MIME type check: `application/pdf`.
   - File extension check: `.pdf`.
   - Magic byte verification: validates initial `%PDF` bytes to prevent disguised executables.
   - Size limit: strictly enforced 10 MB maximum.
4. **Safe Filename Handling**: Files are stored on disk with randomized unique identifiers (`doc_<timestamp>_<random>.pdf`) preventing directory traversal, while downloads use the sanitized admin-given title.
5. **Cascading Cleanup**: Deleting sections or subsections cleans up all associated documents from the database and removes the physical files from the `uploads/` directory on disk.
#   A P _ G D C _ W O R K _  
 