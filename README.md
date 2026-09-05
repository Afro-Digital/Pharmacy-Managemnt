# TilexPharmacy — Enterprise Pharmacy & Cosmetics Management System

TilexPharmacy is a full-stack, bilingual (English & Amharic) pharmacy and cosmetics enterprise management platform specifically engineered for community and retail pharmacies.

---

## 💡 What Sets TilexPharmacy Apart: Unique Approach vs. Basic Systems

Most conventional pharmacy and generic POS systems treat sales as single-user transactions, collapse all daily cash into an undifferentiated lump sum, or allow cashiers to freely modify pharmaceutical orders. **TilexPharmacy takes a fundamentally different, clinically sound, and operationally isolated approach:**

| Dimension | Typical / Basic POS Systems | TilexPharmacy Unique Architecture |
| :--- | :--- | :--- |
| **Shift Management** | Single daily register; subsequent shifts overwrite or conflict with each other. | **Isolated Multi-Shift Tracking**: Cashiers start shifts with an opening drawer float and independently close out and reconcile their shift. Calculations never collide. |
| **Daily Reconciliation** | Either anyone can close the day or it auto-closes without oversight. | **Two-Tier Reconciliation**: Cashier shifts close independently on handover. The **Daily Master Reconciliation** remains open until approved by the **Super Admin / Owner**. |
| **Dispensing Security** | Cashiers can change quantities, swap drugs, or alter prices at the counter. | **Strict Two-Step Separation of Concerns**: Only pharmacists configure, dose, and approve orders. Cashiers operate a **read-only, locked queue** strictly for payment. |
| **Prescription Digitization** | Requires heavy hardware scanners or mandatory patient registration. | **Zero-Setup WebQR Camera Stream**: Instant desktop QR code; scanning with any mobile phone streams the physical prescription photo straight to the pharmacist screen. No app or registration needed. |
| **Inventory Topology** | Single flat stock count or generic warehouse. | **Dual-Location (Store ↔ Dispensary)**: Tracks bulk warehouse independently from retail counter with atomic transfers and **FEFO (First-Expiry-First-Out)** auto-batch selection. |
| **Batch Expiration Control** | Expiration dates locked after creation or forgotten until expired. | **In-Place Expiration & Batch Editing**: Direct expiry editing across Store and Dispensary batches with mandatory audit reasons and real-time notification alerts. |
| **Ethiopian Localization** | Generic VAT and unsupported payment workflows. | **Native Compliance**: Strictly tax-free drug calculation, dual English & Amharic (አማርኛ) UI and receipts, plus native support for **Telebirr**, **CBE**, and Bank Transfers. |
| **POS Usability** | Entire browser window scrolls, hiding checkout buttons on small screens. | **Viewport-Locked Ergonomics**: Screen fits 100% viewport with pinned action bars; only lists scroll. Clean Light/Dark mode with white default. |

---

## 🌟 Core System Features

### 1. Multi-Staff Shift Tracking & Drawer Handover
Designed for pharmacies with multiple pharmacists and cashiers working morning, evening, or night shifts:
- **Opening Float Tracking**: When starting a shift, cashiers record their starting cash drawer float.
- **Real-Time Drawer Monitoring**: Live tracking of cash collected, digital payments (Telebirr, CBE, Bank), sales counts, and total expected cash in drawer.
- **Isolated Shift Close-Out**: When a cashier's shift ends, they input their physical drawer count, review auto-calculated discrepancies, enter hand-over notes, and close their shift.
- **Seamless Handover**: The next cashier starts a fresh shift with their own float. Sales and reconciliations from previous shifts remain sealed and unaffected.

### 2. Owner / Super Admin Daily Master Reconciliation
- **Consolidated Daily Oversight**: Super Admin (Owner) monitors real-time active staff on duty, completed cashier shifts, and pharmacist clinical output side-by-side.
- **Master Approval**: The daily master reconciliation aggregates all completed cashier drawers for the day and remains open until explicitly verified and approved or flagged by the Owner.
- **Audit & Export**: Full historical audit trail with CSV export and line-by-line payment method breakdowns.

### 3. Two-Step Pharmacist-to-Cashier Workflow
- **Pharmacist Station**:
  - Searches medicines and cosmetics with live stock and expiry indicators.
  - Automatically verifies batch availability (FEFO).
  - Configures dosages, links prescriptions, and approves the sale order (`PENDING_PAYMENT`).
- **Cashier Station**:
  - Accesses the real-time **Pending Orders Queue**.
  - Order details, quantities, and pricing are locked (read-only) to protect clinical integrity.
  - Collects payment (Cash, Telebirr, CBE, Bank Transfer, or split payments) and records transaction reference numbers.
  - Confirms payment (`COMPLETED`) and prints an Ethiopian-format 80mm thermal receipt.

### 4. Zero-Setup WebQR Prescription Camera Stream
- Pharmacists click **"Upload via Phone"** to display a dynamic, cryptographically secure QR code on the desktop monitor.
- Any smartphone camera scans the QR code to open an instant, mobile-optimized upload interface.
- No app download, login, or patient profile creation required.
- The photo streams instantly back into the pharmacist's active desktop dispensing session.

### 5. Dual-Location Inventory & FEFO Batch Management
- **Store (Bulk Warehouse) ↔ Dispensary (Retail Counter)**: Independent stock tracking across both locations.
- **Smart Batch Auto-Selection**: Automatically detects single-batch items during transfers and locks batch parameters. Prompts with selection dialogs only when multiple batches exist.
- **Batch Expiration Editing**: Add, update, or correct batch numbers and expiry dates directly from the inventory list with reason-logged audit records.

### 6. Mass Product Upload & Standardized Template
- Download pre-configured CSV template directly from the browser (`product_import_template.csv`).
- Includes pre-filled sample rows for both `MEDICINE` and `COSMETIC` products with dual-language headers.
- Pre-import validation preview detects missing fields or invalid categories before touching the database.

### 7. Bilingual Experience & Theme Customization
- **Amharic & English (አማርኛ / English)**: Instant language switcher updating all menus, labels, badges, and receipts. Dual-language product naming (`name` and `name_am`).
- **Ergonomic Design**: Pinned header and action bars ensure critical buttons (e.g., "Confirm Payment") are never pushed off-screen.
- **Light & Dark Mode**: Persistent theme toggle defaulting to crisp white.
- **Notification Center**: Dynamic alerts for out-of-stock items, critical low inventory, and medicines nearing expiration (30/60/90 days).

---

## 👥 Role-Based Access Control (RBAC)

| Capability | Super Admin (Owner) | Pharmacist | Cashier |
| :--- | :---: | :---: | :---: |
| **System Settings & User Management** | ✅ | ❌ | ❌ |
| **Add / Edit / Delete Products** | ✅ | ✅ | ❌ |
| **Direct Batch & Expiry Editing** | ✅ | ✅ | ❌ |
| **Mass CSV Product Upload** | ✅ | ❌ | ❌ |
| **Prescription Review & Camera Stream** | ✅ | ✅ | ❌ |
| **Select & Approve Sale Orders** | ✅ | ✅ | ❌ |
| **Cashier Queue Checkout & Payment** | ✅ | ❌ | ✅ |
| **Start & Close Personal Shift Drawer** | ✅ | ✅ | ✅ |
| **Cashier Shift Reconciliation Close-Out** | ✅ | ❌ | ✅ |
| **Approve Daily Master Reconciliation** | ✅ | ❌ | ❌ |
| **View Store & Dispensary Inventory** | ✅ | ✅ | Read-Only |

---

## 🛠️ Tech Stack

- **Frontend**:
  - React 18, Vite
  - Tailwind CSS (viewport-locked layout, CSS variables theming)
  - Lucide React Icons
  - `i18next` & `react-i18next` (English & Amharic)
  - Zustand (state management) & Axios
- **Backend**:
  - Node.js & Express
  - Prisma ORM with PostgreSQL
  - JWT Authentication & Role-Based Middleware
  - Multer (prescription and bulk file uploads)
  - Supertest & Jest (comprehensive integration test suites)
- **Database**:
  - PostgreSQL 15+ (with strict schema constraints, foreign keys, and audit logging)

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** running locally or via Docker

### 2. Environment Configuration
Create or verify `server/.env`:
```env
DATABASE_URL="postgresql://<user>@localhost:5432/tilexpharmacy"
JWT_SECRET="tilexpharmacy-jwt-secret-change-in-production-2026"
JWT_REFRESH_SECRET="tilexpharmacy-refresh-secret-change-in-production-2026"
PORT=5000
CLIENT_URL=http://localhost:5173
```

### 3. Database Setup & Seeding
```bash
cd server
npx prisma db push
node prisma/seed.js
```

### 4. Running the Application
From the project root:
```bash
# Runs backend API (port 5000) and frontend (port 5173) concurrently
npm run dev
```

Or run them individually in separate terminals:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 👥 Default Demo Credentials

| Role | Username | Password |
| :--- | :--- | :--- |
| **Super Admin (Owner)** | `admin` | `admin123` |
| **Pharmacist** | `pharmacist1` | `pharma123` |
| **Cashier** | `cashier1` | `cashier123` |

---

## 🧪 Testing

Run the automated integration test suites (verifying authentication, inventory, two-step sales, QR sessions, shift tracking, and reconciliations):

```bash
cd server
npm test
```

To build the client for production:
```bash
cd client
npm run build
```

---

## 📄 License

Proprietary — Developed for TilexPharmacy & Afro-Digital. All rights reserved.
