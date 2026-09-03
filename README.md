# TilexPharmacy — Pharmacy & Cosmetics Management System

TilexPharmacy is a full-stack, bilingual (English & Amharic) management platform designed specifically for Ethiopian pharmacies handling both pharmaceuticals and cosmetics.

---

## 🌟 Key Features

- **Dual-Location Inventory**: Tracks stock independently across **Store** (bulk warehouse) and **Dispensary** (retail counter) with atomic transfers and audit logs.
- **Two-Step Pharmacist-to-Cashier Workflow**:
  - **Pharmacist**: Selects medicines/products for the customer, configures dosage/quantities, links patient prescriptions, and approves the sale order (`PENDING_PAYMENT`). Responsible for adding and updating product details.
  - **Cashier**: Accesses the live **Pending Orders Queue**, reviews the locked (read-only) product list without editing capability, collects payment (Cash, Telebirr, CBE, Bank Transfer, or split payments), logs transaction references, confirms payment (`COMPLETED`), and prints receipts.
- **Point of Sale (POS)**: Real-time order queue, split payments, strictly tax-free calculation per Ethiopian regulations, and 80mm thermal receipt printing.
- **Prescription Workflow**: Digital prescriptions with auto-generated `RX-YYYYMMDD-XXXX` IDs, FEFO (First Expiry First Out) dispensing, and patient linkage.
- **Bilingual i18n**: Real-time language switching between English and Amharic (አማርኛ) across all UI elements, receipts, and dual-language product names (`name_am`).
- **Role-Based Access Control (RBAC)**:
  - **ADMIN**: Unrestricted management, user control, financial reports, system branding.
  - **PHARMACIST**: Clinical inventory, product management, stock transfers, prescriptions, sale order approval.
  - **CASHIER**: Read-only product inspection, pending orders queue checkout, payment collection, and receipt printing.
- **Dynamic Theming**: Configurable brand colors and store details updating in real-time via CSS variables.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Lucide Icons, i18next, Zustand, Axios
- **Backend**: Node.js, Express, Prisma ORM, JWT, Bcrypt, Multer
- **Database**: PostgreSQL 15+

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL running locally or via Docker

### 2. Environment Configuration
The server configuration is located in `server/.env`:
```env
DATABASE_URL="postgresql://<user>@localhost:5432/tilexpharmacy"
JWT_SECRET="tilexpharmacy-jwt-secret-change-in-production-2026"
JWT_REFRESH_SECRET="tilexpharmacy-refresh-secret-change-in-production-2026"
PORT=5000
CLIENT_URL=http://localhost:5173
```

### 3. Database Setup & Seeding
```bash
# Push schema and seed initial users and products
cd server
npx prisma db push
node prisma/seed.js
```

### 4. Running the Application
From the root directory:
```bash
# Runs backend API (port 5000) and frontend (port 5173) concurrently
npm run dev
```

Or run them individually:
```bash
# Terminal 1: Backend
npm run dev:server

# Terminal 2: Frontend
npm run dev:client
```

---

## 👥 Default Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| **Admin** | `admin` | `admin123` |
| **Pharmacist** | `pharmacist1` | `pharma123` |
| **Cashier** | `cashier1` | `cashier123` |

---

## 🧪 Testing

```bash
cd server
npm test
```
