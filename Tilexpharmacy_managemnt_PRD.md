# TilexPharmacy — Product Requirements Document

**Pharmacy & Cosmetics Management System**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | September 2026 |
| **Currency** | ETB (Ethiopian Birr) |
| **Languages** | English, Amharic (አማርኛ) |
| **Platform** | Responsive Web Application |

---

## Table of Contents

1. [Cover Page](#1-cover-page)
2. [Executive Summary](#2-executive-summary)
3. [Introduction & Problem Statement](#3-introduction--problem-statement)
4. [System Overview](#4-system-overview)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Functional Requirements](#6-functional-requirements)
   - 6.1 Authentication & User Management
   - 6.2 Product Management
   - 6.3 Inventory Management
   - 6.4 Prescription Processing
   - 6.5 Billing & Point of Sale (POS)
   - 6.6 Payment Method Management
   - 6.7 Patient Management
   - 6.8 Reporting & Analytics
   - 6.9 Store Management & Settings
   - 6.10 Internationalization (i18n)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Database Design](#8-database-design)
9. [API Design](#9-api-design)
10. [UI/UX Specifications](#10-uiux-specifications)
11. [Code Snippets & Implementation Patterns](#11-code-snippets--implementation-patterns)
12. [Testing Plan](#12-testing-plan)
13. [Deployment Plan](#13-deployment-plan)
14. [Customization Guide](#14-customization-guide)
15. [Appendices](#15-appendices)

---

## 1. Cover Page

- **Document Title:** TilexPharmacy — Product Requirements Document
- **Subtitle:** Pharmacy & Cosmetics Management System
- **Version:** 1.0
- **Date:** September 2026

*Note: Branding in this document (name, logo references, colors) is fully customizable via the system settings. See Section 14: Customization Guide.*

## 2. Executive Summary

TilexPharmacy is a comprehensive, bilingual Pharmacy & Cosmetics Management System specifically designed for the Ethiopian market. The system streamlines the daily operations of pharmacies that dispense both traditional pharmaceutical medicines and cosmetic products. 

### Key Capabilities
- **Inventory Management:** Robust tracking across two physical locations: the Store (warehouse) and the Dispensary (front counter), including one-directional transfer tracking.
- **Prescriptions:** Digital management of patient prescriptions, dispensing workflows, and prescription-linked sales.
- **Billing & POS:** A fast, intuitive Point of Sale interface designed for OTC, prescription, and walk-in sales.
- **Payments:** Flexible payment handling supporting Cash, Telebirr, CBE (Commercial Bank of Ethiopia), and Bank Transfers, including split payments.
- **Reporting:** Detailed analytics on sales, inventory levels, expiring products, and financial performance.

### Target Audience & Context
- **Target Users:** Ethiopian pharmacies operating dual-inventory systems (Store and Dispensary) and selling mixed product lines (medicines and cosmetics).
- **Localization:** Fully bilingual interface supporting English and Amharic (አማርኛ).
- **Financial Context:** All transactions are in Ethiopian Birr (ETB). The system strictly excludes tax calculations to match local operational requirements.
- **Platform:** A responsive web application accessible via mobile, tablet, and desktop devices.

### Tech Stack Summary
The system is built on a modern, scalable web stack:
- Frontend: React (18+) with Tailwind CSS
- Backend: Node.js and Express.js
- Database: PostgreSQL (15+) with Prisma ORM
- Auth: JWT-based authentication

## 3. Introduction & Problem Statement

### Pain Points in the Ethiopian Context
Many pharmacies in Ethiopia still rely on manual, paper-based systems or fragmented software solutions that are not localized. This leads to several critical pain points:
- **Disjointed Inventory Tracking:** Difficulty in tracking bulk stock in the back room (Store) versus active stock at the front counter (Dispensary).
- **Manual Prescription Records:** Paper prescriptions are easily lost, hard to read, and difficult to audit.
- **Payment Limitations:** Existing systems often struggle to handle modern digital payments (like Telebirr or CBE) seamlessly alongside cash.
- **Lack of Visibility:** No real-time alerts for low stock or expiring medications, leading to waste or stockouts.
- **Language Barriers:** Software that is only available in English can be challenging for some staff members to use efficiently.

### Objectives
- **Digitize Operations:** Transition from manual ledgers to a fully digital, centralized system.
- **Real-Time Inventory:** Provide up-to-the-minute visibility of stock levels across both the Store and Dispensary.
- **Accurate Billing:** Streamline the checkout process with a modern POS system.
- **Payment Flexibility:** Natively support popular local payment methods like Telebirr and CBE.
- **Bilingual Interface:** Empower staff to use the system in their preferred language (English or Amharic).

### Success Criteria
- Reduction in inventory discrepancies between Store and Dispensary.
- Zero lost prescription records.
- Decreased checkout time for customers.
- 100% adoption of digital payment tracking.

### Scope
- **IN SCOPE:** Medicine and cosmetics inventory management, prescription tracking, POS billing, multi-method payments, comprehensive reporting, and bilingual support (English/Amharic).
- **OUT OF SCOPE:** Insurance integration, online ordering/e-commerce, home delivery services, and multi-branch/multi-store management.

## 4. System Overview

### Module Descriptions
- **Auth:** Handles user login, logout, and token refresh using JWT.
- **Inventory:** Manages stock levels across the Store and Dispensary. Tracks batch numbers, expiry dates, and facilitates stock transfers.
- **Products:** Central catalog for Medicines (requiring pharmaceutical details) and Cosmetics.
- **Prescriptions:** Manages patient records and prescription fulfillment.
- **Billing/POS:** The primary interface for Cashiers to process sales, apply discounts, and generate receipts.
- **Payments:** Manages payment methods and transaction records.
- **Reports:** Generates insights on sales, inventory, and financials.
- **Settings:** Allows configuration of pharmacy details, branding, localization, and system defaults.

### Technology Stack & Rationale
- **Frontend (React 18+, React Router, Zustand/Context API):** Chosen for its component-based architecture, allowing for a highly interactive and stateful Single Page Application (SPA).
- **UI Framework (Tailwind CSS):** Enables rapid, utility-first styling for a clean, minimalist, and responsive design.
- **Backend (Node.js, Express):** Provides a fast, scalable, and non-blocking runtime environment for building RESTful APIs.
- **Database (PostgreSQL 15+):** A robust, ACID-compliant relational database, essential for handling critical financial and medical data.
- **ORM (Prisma):** Offers type-safe database access, simplifying schema management and migrations.
- **Auth (JWT):** Stateless authentication ideal for REST APIs, ensuring secure access across client and server.
- **i18n (react-i18next):** The standard solution for robust internationalization, powering the English/Amharic localization.

### Responsive Design Strategy
The application employs a **mobile-first approach**. UI components are designed to scale gracefully from mobile devices to large desktop monitors. This ensures that a Pharmacist using a tablet and a Cashier using a desktop terminal both experience an optimized interface. Touch targets are appropriately sized for mobile usage.

### Architecture Overview
TilexPharmacy uses a standard client-server architecture. The frontend is a React Single Page Application (SPA) that communicates with the Node.js/Express backend via a REST API. The backend handles business logic, authorization, and interacts with the PostgreSQL database.

## 5. User Roles & Permissions

The system implements Role-Based Access Control (RBAC) with three distinct roles.

### Role Descriptions
- **ADMIN:** The system owner or manager. Has unrestricted access to all modules, including user management, system settings, financial reports, inventory oversight, product editing, and sale processing.
- **PHARMACIST:** Responsible for clinical and stock operations. Selects medications and products for customers, updates product details, and approves sale orders (sending them to the Cashier queue). Can manage inventory, process stock transfers, and handle prescriptions. Cannot alter system settings or manage users.
- **CASHIER:** Primarily handles payment collection and receipt generation. Can view products and prices in read-only mode, but CANNOT edit product details. Receives pharmacist-approved orders, verifies payments (Cash, Telebirr, CBE, Bank Transfer, or split), confirms transactions, and issues receipts.

### Permission Matrix

| Feature | ADMIN | PHARMACIST | CASHIER |
| :--- | :---: | :---: | :---: |
| **Auth** | | | |
| Login / Logout | ✅ | ✅ | ✅ |
| **User Management** | | | |
| View / Create / Edit Users | ✅ | ❌ | ❌ |
| **Products & Categories** | | | |
| View Products | ✅ | ✅ | ✅ |
| Create / Edit / Delete Products | ✅ | ✅ | ❌ (Read-only) |
| Manage Categories | ✅ | ✅ | ❌ |
| **Inventory** | | | |
| View Inventory | ✅ | ✅ | ❌ |
| Add Stock (Store) | ✅ | ✅ | ❌ |
| Transfer (Store → Dispensary) | ✅ | ✅ | ❌ |
| Return (Dispensary → Store) | ✅ | ❌ | ❌ |
| **Patients & Prescriptions** | | | |
| View Patients | ✅ | ✅ | ❌ |
| Create / Edit Patients | ✅ | ✅ | ❌ |
| Create / View Prescriptions | ✅ | ✅ | ❌ |
| Dispense Prescriptions | ✅ | ✅ | ❌ |
| **Billing & POS (Two-Step Workflow)** | | | |
| Select Products & Approve Sale Order | ✅ | ✅ | ❌ |
| View Pending Orders Queue | ✅ | ✅ | ✅ |
| Confirm Payment & Issue Receipt | ✅ | ❌ | ✅ |
| Cancel Unpaid Sale Order | ✅ | ✅ | ✅ |
| View Past Sales | ✅ | ✅ | ✅ (Own sales) |
| Process Refunds | ✅ | ❌ | ❌ |
| **Reports** | | | |
| View Sales / Financial Reports | ✅ | ❌ | ❌ |
| View Inventory Reports | ✅ | ✅ | ❌ |
| **Settings & Config** | | | |
| Edit Store Settings | ✅ | ❌ | ❌ |
| Manage Payment Methods | ✅ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ | ❌ |

### Role Assignment & Default Setup
- Roles are assigned strictly during user creation by an ADMIN.
- Upon initial system deployment, a default Admin account must be created (e.g., via database seed script) to allow initial access and configuration.

## 7. Non-Functional Requirements

### Performance
- **Page Load:** The initial SPA load time should be under 2 seconds on standard 4G networks.
- **API Response:** 95% of API requests must complete in under 300ms.
- **Concurrency:** The system must seamlessly support up to 50 concurrent active users.

### Security
- **Authentication:** Passwords must be securely hashed using `bcrypt`. API routes must be protected using JWT (Access and Refresh tokens).
- **Communication:** All data in transit must be encrypted via HTTPS.
- **Data Protection:** 
  - Input validation on both client and server to prevent malicious data entry.
  - SQL Injection prevention guaranteed via Prisma ORM parameterized queries.
  - Cross-Site Scripting (XSS) prevention through React's default escaping and strict Content Security Policy (CSP).
- **Access Control:** Proper CORS configuration restricting access to authorized origins. Rate limiting implemented on authentication endpoints to prevent brute-force attacks.

### Scalability
- The system must efficiently handle a catalog of 10,000+ products.
- The database and API must comfortably process 1,000+ daily transactions without performance degradation.

### Accessibility & UI/UX
- **WCAG 2.1 AA:** The application should strive to meet WCAG 2.1 AA standards for contrast and keyboard navigability.
- **Localization:** Full support for English and Amharic (አማርኛ), with architecture that allows easy addition of future languages. RTL (Right-to-Left) considerations are not required for Amharic, but character encoding (UTF-8) must be strictly enforced.
- **Mobile Responsiveness:** Layouts must break down gracefully, supporting a minimum width of 320px. Interactive touch targets must be at least 44px by 44px to accommodate mobile usage.

### Compatibility
- **Browsers:** Full support for the latest two versions of Chrome, Firefox, Safari, and Edge.

### Reliability
- **Uptime:** The application targets a 99.5% uptime during standard operating hours.
- **Backups:** Automated, daily database backups must be implemented to prevent data loss.

---

## 6. Functional Requirements

### 6.1 Authentication & User Management
**Feature Description:**
Provides secure access to the system using JWT-based authentication. Supports role-based access control (RBAC) with ADMIN, PHARMACIST, and CASHIER roles, and includes user lifecycle management and first-time setup for the initial admin account.

**User Stories:**
- As a user, I want to log in securely with my username and password, so that I can access my role-specific dashboard.
- As an admin, I want to create, update, and deactivate user accounts, so that I can manage staff access to the system.
- As a user, I want my session to auto-logout after 30 minutes of inactivity, so that unauthorized users cannot access the system if I leave my desk.

**Acceptance Criteria:**
- System uses JWT access tokens (15-minute expiry) and refresh tokens (7-day expiry).
- Users are assigned one of three roles: ADMIN, PHARMACIST, or CASHIER.
- Passwords are securely hashed before storage.
- Auto-logout triggers after 30 minutes of inactivity.
- System provides a first-time setup flow to create the initial admin account.
- Admin can perform CRUD operations on users.

**Relevant Data Model:**
- Table: `users`
- Fields: `id`, `full_name`, `username`, `email`, `password_hash`, `role`, `phone`, `is_active`, `created_at`, `updated_at`

**Key API Endpoints:**
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/refresh`
- `GET /api/v1/auth/me`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `PUT /api/v1/users/:id`
- `DELETE /api/v1/users/:id`

### 6.2 Product Management
**Feature Description:**
Manages the catalog of products, distinguishing between MEDICINE and COSMETIC types. Captures essential details like names (in English and Amharic), categories, and pricing, with specialized pharmaceutical fields for medicines. Includes **Mass Product Upload** via customizable CSV templates.

**User Stories:**
- As a pharmacist, I want to add a new medicine with its generic name, dosage form, and strength, so that it can be correctly identified and tracked.
- As an admin or pharmacist, I want to download a customizable CSV template and bulk upload hundreds of products at once, so that inventory onboarding is fast and error-free.
- As a user, I want to search for products by name, category, or type, so that I can quickly find the required item.
- As an admin, I want to softly deactivate a product instead of deleting it, so that historical sales data is preserved.

**Acceptance Criteria:**
- Supports MEDICINE and COSMETIC product types.
- Shared fields include name, name_am, brand, manufacturer, unit_price, barcode, and category.
- Medicine-specific fields include generic_name, dosage_form, strength, and requires_prescription.
- Mass Product Upload feature with downloadable customizable template (`product_import_template.csv`) with sample rows.
- Bulk upload provides client-side validation preview (highlighting missing names, invalid prices, or mismatched types) before committing to the database.
- Search supports filtering by type, category, and name.
- Product deletion is a soft delete (updating `is_active` to false).

**Relevant Data Model:**
- Tables: `products`, `categories`
- `products` fields: `id`, `name`, `name_am`, `generic_name`, `category_id`, `product_type`, `dosage_form`, `strength`, `brand`, `manufacturer`, `unit_price`, `reorder_level`, `requires_prescription`, `barcode`, `description`, `is_active`, `created_at`, `updated_at`

**Key API Endpoints:**
- `GET /api/v1/products`
- `POST /api/v1/products`
- `GET /api/v1/products/import-template`
- `POST /api/v1/products/bulk-upload`
- `GET /api/v1/products/:id`
- `PUT /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `GET /api/v1/products/search?q=...`
- `GET /api/v1/categories`
- `POST /api/v1/categories`

### 6.3 Inventory Management
**Feature Description:**
Tracks product stock levels across two distinct locations: STORE and DISPENSARY. Handles stock transfers with **Smart Batch Auto-Selection**, returns, expiry tracking, and low-stock alerts.

**User Stories:**
- As a pharmacist, I want to transfer stock from the Store to the Dispensary (or vice-versa), and have the system automatically select the batch number if there is only one batch available.
- As a pharmacist, if a product has multiple batches, I want the system to prompt me with a clear dropdown showing batch numbers, available stock, and expiry dates, so I can pick the correct batch.
- As an admin, I want to view low-stock and expiry alerts, so that I can reorder products or remove expired items in time.
- As a pharmacist, I want to adjust stock levels with a specified reason, so that inventory discrepancies can be corrected and audited.

**Acceptance Criteria:**
- Tracks inventory separately for STORE and DISPENSARY locations.
- Captures quantity, batch_number, expiry_date, and shelf_location per inventory record.
- **Smart Batch Auto-Selection:**
  - When transferring stock, querying available batches at source location automatically selects the batch if only 1 exists.
  - If multiple batches exist, prompts user to select the appropriate batch with real-time stock and expiry indicators.
- Stock transfers decrement source quantity, increment destination quantity, and log a transfer record atomically.
- System generates alerts for items below `reorder_level` and items expiring within 30, 60, or 90 days.
- Stock adjustments require a reason and generate an audit trail.

**Relevant Data Model:**
- Tables: `inventory`, `inventory_transfers`, `audit_log`
- `inventory` fields: `id`, `product_id`, `location`, `batch_number`, `expiry_date`, `quantity`, `shelf_location`, `received_date`, `supplier_name`, `notes`, `created_at`, `updated_at`
- `inventory_transfers` fields: `id`, `product_id`, `batch_number`, `from_location`, `to_location`, `quantity`, `transferred_by`, `notes`, `created_at`

**Key API Endpoints:**
- `GET /api/v1/inventory`
- `POST /api/v1/inventory`
- `GET /api/v1/inventory/store`
- `GET /api/v1/inventory/dispensary`
- `GET /api/v1/inventory/batches?product_id=...&location=...`
- `POST /api/v1/inventory/transfer`
- `GET /api/v1/inventory/transfers`
- `GET /api/v1/products/low-stock`
- `GET /api/v1/products/expiring?days=30`

### 6.4 Prescription Processing
**Feature Description:**
Facilitates the creation, tracking, and dispensing of medical prescriptions with **WebQR-Based Automated Camera Capture**. Captures prescriptions without requiring an existing patient profile and allows digital transcription.

**User Stories:**
- As a pharmacist, I want to scan a WebQR code using a smartphone camera to take a photo of a doctor's prescription slip, which automatically uploads to my desktop screen in real-time.
- As a pharmacist, I want to process a prescription without requiring a patient profile, so walk-in patients with external paper slips can be served swiftly.
- As a pharmacist, I want to dispense a prescription, so that the system automatically decrements Dispensary inventory.

**Acceptance Criteria:**
- **WebQR Mobile Prescription Upload:**
  - Desktop displays a dynamic QR code encoding a secure session URL.
  - Mobile browser opens the upload page, requests native camera access, and uploads the prescription photo.
  - Desktop polls and detects image upload in real-time, displaying the photo side-by-side with prescribed medication selection.
  - **No patient profile is required** (`patient_id` is optional).
- Prescriptions are assigned an auto-generated number format: RX-YYYYMMDD-XXXX.
- Workflow statuses include PENDING, DISPENSED, COMPLETED, and CANCELLED.
- Dispensing a prescription checks Dispensary inventory, decrements stock, and updates `dispensed_qty`.
- Scanned prescription photos can be viewed in high resolution from the prescription list.

**Relevant Data Model:**
- Tables: `prescriptions`, `prescription_items`
- `prescriptions` fields: `id`, `prescription_no`, `patient_id` (optional), `image_url` (optional), `upload_session_id` (optional), `prescribed_by`, `dispensed_by`, `status`, `notes`, `created_at`, `updated_at`
- `prescription_items` fields: `id`, `prescription_id`, `product_id`, `quantity`, `dosage`, `duration`, `instructions`, `dispensed_qty`, `created_at`

**Key API Endpoints:**
- `POST /api/v1/prescriptions/upload-session` (Generate QR session)
- `POST /api/v1/prescriptions/upload-session/:sessionId` (Mobile camera upload)
- `GET /api/v1/prescriptions/upload-session/:sessionId` (Desktop poller)
- `GET /api/v1/prescriptions`
- `POST /api/v1/prescriptions`
- `GET /api/v1/prescriptions/:id`
- `PATCH /api/v1/prescriptions/:id/status`
- `POST /api/v1/prescriptions/:id/dispense`

### 6.5 Billing & Point of Sale (POS)
**Feature Description:**
Manages the checkout process for both prescription-based and walk-in sales via an Ethiopian-compliant **Two-Step Pharmacist-to-Cashier Workflow**:
1. **Pharmacist Step (Order Selection & Approval):** The Pharmacist selects medications or products for the customer, reviews dosage/quantities, links patient prescriptions if required, and approves the sale order. Dispensary stock is reserved immediately and the sale enters the `PENDING_PAYMENT` state. The pharmacist is solely responsible for modifying product details.
2. **Cashier Step (Payment Collection & Confirmation):** The Cashier accesses the live **Pending Orders Queue**, inspects the customer's order with a locked (read-only) item list, confirms the amount due, collects payment using one or more payment methods (Cash, Telebirr, CBE, Bank Transfer, or split payments), logs digital transaction references, and confirms payment. The transaction transitions to `COMPLETED`, and an 80mm thermal receipt is printed.
3. The cashier can view product prices but cannot edit or alter product records.

**User Stories:**
- As a pharmacist, I want to select medications for a customer and approve the order, so that the items are reserved and routed directly to the cashier counter.
- As a cashier, I want to view approved orders in a real-time queue with locked, read-only item lists, so that I can collect the exact amount without altering product records.
- As a cashier, I want to confirm split payments (e.g., partial Cash and partial Telebirr) and print the customer's receipt, so that the transaction is finalized.
- As a user, I want to cancel an unpaid order if the customer leaves, so that reserved products are automatically returned to Dispensary stock.
- As a user, I want to process a refund, so that returned items are added back to the Dispensary inventory.

**Acceptance Criteria:**
- Sales are assigned an auto-generated number format: SL-YYYYMMDD-XXXX.
- Implements two-step workflow: Pharmacist approves products (`PENDING_PAYMENT`) → Cashier confirms payment (`COMPLETED`).
- Cashier interface displays a real-time Pending Orders Queue and locked item lists.
- Pulls and reserves inventory exclusively from the Dispensary location.
- Calculates subtotal, applies discounts (percentage or flat), and computes the total. Does NOT calculate tax.
- Supports split payments across multiple methods with transaction reference numbers.
- Generates a printable receipt displaying pharmacy name, items, approving pharmacist, cashier, total, and payment info.
- Unpaid orders can be cancelled, instantly restoring reserved inventory.
- Full or partial refunds restock items to Dispensary.
- Includes searchable and filterable sales history.

**Relevant Data Model:**
- Tables: `sales`, `sale_items`, `payments`
- `sales` fields: `id`, `sale_number`, `prescription_id`, `patient_id`, `pharmacist_id`, `cashier_id`, `subtotal`, `discount_amount`, `total_amount`, `sale_type`, `status` (PENDING_PAYMENT, COMPLETED, REFUNDED, PARTIAL_REFUND, CANCELLED), `notes`, `created_at`
- `sale_items` fields: `id`, `sale_id`, `product_id`, `batch_number`, `quantity`, `unit_price`, `discount`, `total_price`, `created_at`

**Key API Endpoints:**
- `GET /api/v1/sales?status=PENDING_PAYMENT` (Queue for Cashier)
- `POST /api/v1/sales` (Pharmacist approves product selection)
- `POST /api/v1/sales/:id/pay` (Cashier confirms payment)
- `POST /api/v1/sales/:id/cancel` (Cancel unpaid order and restore stock)
- `GET /api/v1/sales/:id`
- `POST /api/v1/sales/:id/refund`
- `GET /api/v1/sales/:id/receipt`

### 6.6 Payment Method Management
**Feature Description:**
Allows administration of various payment methods used at checkout. Supports multiple active methods and split payments.

**User Stories:**
- As an admin, I want to add or remove payment methods, so that the pharmacy can accept new forms of payment like Telebirr or CBE.
- As a cashier, I want to select multiple payment methods for a single transaction, so that a customer can pay part in cash and part via bank transfer.
- As a cashier, I want to record a reference number for digital payments, so that the transaction can be verified later.

**Acceptance Criteria:**
- Admins can perform CRUD operations on payment methods.
- Default methods include Cash, Telebirr, CBE, and Bank Transfer.
- Supports split payments for a single sale (e.g., 500 ETB Cash + 300 ETB Telebirr).
- Captures a `reference_number` for digital payment transactions.
- Provides payment history per sale.

**Relevant Data Model:**
- Tables: `payment_methods`, `payments`
- `payment_methods` fields: `id`, `name`, `name_am`, `code`, `is_active`, `sort_order`, `created_at`
- `payments` fields: `id`, `sale_id`, `payment_method_id`, `amount`, `reference_number`, `created_at`

**Key API Endpoints:**
- `GET /api/v1/payment-methods`
- `POST /api/v1/payment-methods`
- `PUT /api/v1/payment-methods/:id`
- `DELETE /api/v1/payment-methods/:id`

### 6.7 Patient Management
**Feature Description:**
Manages patient demographic and medical records. Maintains a history of patient prescriptions and purchases.

**User Stories:**
- As a pharmacist, I want to create a patient profile with their contact details and allergies, so that I can provide safe prescription dispensing.
- As a user, I want to search for a patient by name or phone number, so that I can quickly access their records during a visit.
- As a pharmacist, I want to view a patient's prescription and purchase history, so that I understand their medical background and compliance.

**Acceptance Criteria:**
- Captures patient details: full_name, full_name_am, phone, date_of_birth, gender, address, allergies, and notes.
- Patient creation is optional for walk-in OTC or cosmetic sales.
- Provides search capability by name or phone.
- Displays associated prescription and purchase histories.

**Relevant Data Model:**
- Table: `patients`
- Fields: `id`, `full_name`, `full_name_am`, `phone`, `date_of_birth`, `gender`, `address`, `allergies`, `notes`, `created_at`, `updated_at`

**Key API Endpoints:**
- `GET /api/v1/patients`
- `POST /api/v1/patients`
- `GET /api/v1/patients/:id`
- `PUT /api/v1/patients/:id`
- `GET /api/v1/patients/:id/prescriptions`
- `GET /api/v1/patients/:id/purchases`

### 6.8 Reporting & Analytics
**Feature Description:**
Provides comprehensive insights into sales, inventory, financials, and prescriptions through various reports and a centralized dashboard.

**User Stories:**
- As an admin, I want to view a daily sales report, so that I can monitor daily revenue and transaction volume.
- As a pharmacist, I want to generate a stock movement report, so that I can audit transfers between the Store and Dispensary.
- As an admin, I want to export reports to CSV, so that I can perform further analysis in external tools.

**Acceptance Criteria:**
- **Sales Reports:** Provide data grouped by day/week/month, showing total sales, transaction counts, average value, and top-selling products.
- **Inventory Reports:** Display current stock levels by location, low stock items, expiring items, and movement history.
- **Financial Reports:** Show revenue summaries, daily breakdowns, payment method distributions, and discount summaries.
- **Prescription Reports:** Track total prescriptions, status breakdowns, top prescribed medicines, and prescriptions per patient.
- **Transfer Reports:** Monitor Store to Dispensary stock transfers.
- All reports are filterable by date range and exportable to CSV.
- A dashboard displays key metrics (today's sales, low stock count, expiring items, pending prescriptions).

**Relevant Data Model:**
- Data aggregated from: `sales`, `sale_items`, `inventory`, `inventory_transfers`, `prescriptions`, `payments`

**Key API Endpoints:**
- `GET /api/v1/reports/sales?from=...&to=...&group_by=day`
- `GET /api/v1/reports/inventory`
- `GET /api/v1/reports/financial?from=...&to=...`
- `GET /api/v1/reports/prescriptions?from=...&to=...`
- `GET /api/v1/reports/expiring-products`
- `GET /api/v1/reports/stock-movement`
- `GET /api/v1/reports/export?type=csv&report=sales`

### 6.9 Store Management & Settings
**Feature Description:**
Allows configuration of core pharmacy details, branding, and system defaults.

**User Stories:**
- As an admin, I want to update the pharmacy's name, address, and logo, so that the system and receipts reflect our current branding.
- As an admin, I want to configure the primary and secondary colors, so that the UI matches our corporate identity.
- As an admin, I want to set the operating hours and default language, so that the system operates according to our local requirements.

**Acceptance Criteria:**
- Stores pharmacy profile details including name, Amharic name, address, phone, email, logo, and license number.
- Allows configuration of primary and secondary UI theme colors.
- Supports currency display settings (default: ETB).
- Configures operating hours and default language (en or am).

**Relevant Data Model:**
- Table: `store_settings`
- Fields: `id`, `pharmacy_name`, `pharmacy_name_am`, `address`, `phone`, `email`, `logo_url`, `primary_color`, `secondary_color`, `currency`, `default_language`, `operating_hours`, `license_number`, `updated_at`

**Key API Endpoints:**
- `GET /api/v1/settings`
- `PUT /api/v1/settings`
- `POST /api/v1/settings/logo`

### 6.10 Internationalization (i18n)
**Feature Description:**
Ensures the application is fully accessible in both English and Amharic, accommodating local user preferences and data entry requirements.

**User Stories:**
- As a user, I want to toggle the UI language between English and Amharic, so that I can use the system in my preferred language.
- As a pharmacist, I want to input product names in both English and Amharic, so that receipts and labels are easily understood by local customers.
- As a user, I want numbers and currencies to be formatted correctly (e.g., 1,234.56 ETB), so that financial data is clear and professional.

**Acceptance Criteria:**
- UI includes a language toggle for English (en) and Amharic (am) in the header.
- All UI labels, buttons, and messages are translated based on the selected language.
- Dual language input is supported for product names, categories, and payment methods (e.g., `name` and `name_am`).
- Date format is strictly DD/MM/YYYY.
- Number format uses thousands separators (1,234.56).
- Currency is displayed with the symbol after the amount (e.g., 150.00 ETB).
- Amharic text is rendered using supported system fonts (Nyala, Abyssinica SIL).

**Relevant Data Model:**
- Tables with `_am` fields: `products` (`name_am`), `categories` (`name_am`), `payment_methods` (`name_am`), `patients` (`full_name_am`), `store_settings` (`pharmacy_name_am`)

**Key API Endpoints:**
- Settings and localized fields are handled through standard CRUD endpoints (e.g., `POST /api/v1/products`, `PUT /api/v1/settings`). Language preference is handled client-side.

---

## 8. Database Design

### Prisma Schema

The following represents the complete database schema for TilexPharmacy, converted into Prisma schema format.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Enums
enum Role {
  ADMIN
  PHARMACIST
  CASHIER
}

enum CategoryType {
  MEDICINE
  COSMETIC
  GENERAL
}

enum ProductType {
  MEDICINE
  COSMETIC
}

enum Location {
  STORE
  DISPENSARY
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum PrescriptionStatus {
  PENDING
  DISPENSED
  COMPLETED
  CANCELLED
}

enum SaleType {
  PRESCRIPTION
  OTC
  WALK_IN
}

enum SaleStatus {
  COMPLETED
  REFUNDED
  PARTIAL_REFUND
}

// Models
model User {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  full_name     String   @db.VarChar(255)
  username      String   @unique @db.VarChar(100)
  email         String?  @unique @db.VarChar(255)
  password_hash String   @db.VarChar(255)
  role          Role
  phone         String?  @db.VarChar(20)
  is_active     Boolean  @default(true)
  created_at    DateTime @default(now()) @db.Timestamptz
  updated_at    DateTime @default(now()) @db.Timestamptz

  inventory_transfers InventoryTransfer[]
  dispensed_prescriptions Prescription[] @relation("DispensedBy")
  sales         Sale[]
  audit_logs    AuditLog[]

  @@map("users")
}

model Category {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String   @db.VarChar(255)
  name_am     String?  @db.VarChar(255)
  type        CategoryType
  description String?  @db.Text
  created_at  DateTime @default(now()) @db.Timestamptz

  products    Product[]

  @@map("categories")
}

model Product {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name                  String   @db.VarChar(255)
  name_am               String?  @db.VarChar(255)
  generic_name          String?  @db.VarChar(255)
  category_id           String?  @db.Uuid
  product_type          ProductType
  dosage_form           String?  @db.VarChar(100)
  strength              String?  @db.VarChar(100)
  brand                 String?  @db.VarChar(255)
  manufacturer          String?  @db.VarChar(255)
  unit_price            Decimal  @db.Decimal(10,2)
  reorder_level         Int      @default(10)
  requires_prescription Boolean  @default(false)
  barcode               String?  @db.VarChar(100)
  description           String?  @db.Text
  is_active             Boolean  @default(true)
  created_at            DateTime @default(now()) @db.Timestamptz
  updated_at            DateTime @default(now()) @db.Timestamptz

  category              Category?             @relation(fields: [category_id], references: [id])
  inventory             Inventory[]
  inventory_transfers   InventoryTransfer[]
  prescription_items    PrescriptionItem[]
  sale_items            SaleItem[]

  @@map("products")
}

model Inventory {
  id             String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id     String    @db.Uuid
  location       Location
  batch_number   String?   @db.VarChar(100)
  expiry_date    DateTime? @db.Date
  quantity       Int       @default(0)
  shelf_location String?   @db.VarChar(100)
  received_date  DateTime? @default(dbgenerated("CURRENT_DATE")) @db.Date
  supplier_name  String?   @db.VarChar(255)
  notes          String?   @db.Text
  created_at     DateTime  @default(now()) @db.Timestamptz
  updated_at     DateTime  @default(now()) @db.Timestamptz

  product        Product   @relation(fields: [product_id], references: [id])

  @@unique([product_id, location, batch_number])
  @@map("inventory")
}

model InventoryTransfer {
  id             String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  product_id     String   @db.Uuid
  batch_number   String?  @db.VarChar(100)
  from_location  Location
  to_location    Location
  quantity       Int
  transferred_by String   @db.Uuid
  notes          String?  @db.Text
  created_at     DateTime @default(now()) @db.Timestamptz

  product        Product  @relation(fields: [product_id], references: [id])
  user           User     @relation(fields: [transferred_by], references: [id])

  @@map("inventory_transfers")
}

model Patient {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  full_name     String    @db.VarChar(255)
  full_name_am  String?   @db.VarChar(255)
  phone         String?   @db.VarChar(20)
  date_of_birth DateTime? @db.Date
  gender        Gender?
  address       String?   @db.Text
  allergies     String?   @db.Text
  notes         String?   @db.Text
  created_at    DateTime  @default(now()) @db.Timestamptz
  updated_at    DateTime  @default(now()) @db.Timestamptz

  prescriptions Prescription[]
  sales         Sale[]

  @@map("patients")
}

model Prescription {
  id              String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  prescription_no String             @unique @db.VarChar(50)
  patient_id      String             @db.Uuid
  prescribed_by   String?            @db.VarChar(255)
  dispensed_by    String?            @db.Uuid
  status          PrescriptionStatus @default(PENDING)
  notes           String?            @db.Text
  created_at      DateTime           @default(now()) @db.Timestamptz
  updated_at      DateTime           @default(now()) @db.Timestamptz

  patient         Patient            @relation(fields: [patient_id], references: [id])
  dispenser       User?              @relation("DispensedBy", fields: [dispensed_by], references: [id])
  items           PrescriptionItem[]
  sales           Sale[]

  @@map("prescriptions")
}

model PrescriptionItem {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  prescription_id String   @db.Uuid
  product_id      String   @db.Uuid
  quantity        Int
  dosage          String?  @db.VarChar(255)
  duration        String?  @db.VarChar(100)
  instructions    String?  @db.Text
  dispensed_qty   Int?     @default(0)
  created_at      DateTime @default(now()) @db.Timestamptz

  prescription    Prescription @relation(fields: [prescription_id], references: [id])
  product         Product      @relation(fields: [product_id], references: [id])

  @@map("prescription_items")
}

model Sale {
  id              String     @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sale_number     String     @unique @db.VarChar(50)
  prescription_id String?    @db.Uuid
  patient_id      String?    @db.Uuid
  cashier_id      String     @db.Uuid
  subtotal        Decimal    @db.Decimal(10,2)
  discount_amount Decimal?   @default(0) @db.Decimal(10,2)
  total_amount    Decimal    @db.Decimal(10,2)
  sale_type       SaleType   @default(WALK_IN)
  status          SaleStatus @default(COMPLETED)
  notes           String?    @db.Text
  created_at      DateTime   @default(now()) @db.Timestamptz

  prescription    Prescription? @relation(fields: [prescription_id], references: [id])
  patient         Patient?      @relation(fields: [patient_id], references: [id])
  cashier         User          @relation(fields: [cashier_id], references: [id])
  items           SaleItem[]
  payments        Payment[]

  @@map("sales")
}

model SaleItem {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sale_id      String   @db.Uuid
  product_id   String   @db.Uuid
  batch_number String?  @db.VarChar(100)
  quantity     Int
  unit_price   Decimal  @db.Decimal(10,2)
  discount     Decimal? @default(0) @db.Decimal(10,2)
  total_price  Decimal  @db.Decimal(10,2)
  created_at   DateTime @default(now()) @db.Timestamptz

  sale         Sale     @relation(fields: [sale_id], references: [id])
  product      Product  @relation(fields: [product_id], references: [id])

  @@map("sale_items")
}

model PaymentMethod {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name       String   @db.VarChar(100)
  name_am    String?  @db.VarChar(100)
  code       String   @unique @db.VarChar(50)
  is_active  Boolean  @default(true)
  sort_order Int?     @default(0)
  created_at DateTime @default(now()) @db.Timestamptz

  payments   Payment[]

  @@map("payment_methods")
}

model Payment {
  id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  sale_id           String   @db.Uuid
  payment_method_id String   @db.Uuid
  amount            Decimal  @db.Decimal(10,2)
  reference_number  String?  @db.VarChar(100)
  created_at        DateTime @default(now()) @db.Timestamptz

  sale              Sale          @relation(fields: [sale_id], references: [id])
  payment_method    PaymentMethod @relation(fields: [payment_method_id], references: [id])

  @@map("payments")
}

model AuditLog {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String?  @db.Uuid
  action      String   @db.VarChar(50)
  entity_type String   @db.VarChar(50)
  entity_id   String?  @db.Uuid
  details     Json?    @db.JsonB
  ip_address  String?  @db.VarChar(45)
  created_at  DateTime @default(now()) @db.Timestamptz

  user        User?    @relation(fields: [user_id], references: [id])

  @@map("audit_log")
}

model StoreSettings {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  pharmacy_name    String   @default("TilexPharmacy") @db.VarChar(255)
  pharmacy_name_am String?  @default("ቲሌክስ ፋርማሲ") @db.VarChar(255)
  address          String?  @db.Text
  phone            String?  @db.VarChar(20)
  email            String?  @db.VarChar(255)
  logo_url         String?  @db.VarChar(500)
  primary_color    String?  @default("#2563EB") @db.VarChar(7)
  secondary_color  String?  @default("#1E40AF") @db.VarChar(7)
  currency         String?  @default("ETB") @db.VarChar(10)
  default_language String?  @default("en") @db.VarChar(5)
  operating_hours  Json?    @db.JsonB
  license_number   String?  @db.VarChar(100)
  updated_at       DateTime @default(now()) @db.Timestamptz

  @@map("store_settings")
}
```

### Table Purposes & Details

*   **Users (`users`)**:
    *   **Purpose**: Manages system authentication and authorization for staff.
    *   **Key Fields**: `role` (determines RBAC: ADMIN, PHARMACIST, CASHIER), `password_hash`.
    *   **Relationships**: Has transfers, dispensed prescriptions, sales, and audit logs.
    *   **Indexes**: Add B-tree index on `username`, `email`, `role`, and `is_active`.

*   **Categories (`categories`)**:
    *   **Purpose**: Organizes products into logical groups (e.g., MEDICINE, COSMETIC).
    *   **Key Fields**: `type` ensures strict categorization. `name_am` supports Amharic localization.
    *   **Relationships**: Products belong to Categories.

*   **Products (`products`)**:
    *   **Purpose**: Central catalog for all medicines and cosmetics.
    *   **Key Fields**: `product_type`, `unit_price`, `requires_prescription`. Contains pharmaceutical-specific fields like `generic_name` and `dosage_form`.
    *   **Relationships**: Belongs to Categories. Linked to Inventory, Transfers, Prescription Items, Sale Items.
    *   **Indexes**: B-tree index on `barcode`, `product_type`, `category_id`, and `is_active`.

*   **Inventory (`inventory`)**:
    *   **Purpose**: Tracks actual physical stock quantities and batches at locations.
    *   **Key Fields**: `location` (STORE vs. DISPENSARY), `batch_number`, `expiry_date`, `quantity`.
    *   **Relationships**: References Products.
    *   **Indexes**: Unique constraint on `(product_id, location, batch_number)`. Index on `expiry_date` for expiring goods reports.

*   **Inventory Transfers (`inventory_transfers`)**:
    *   **Purpose**: Logs movement of items, typically Store → Dispensary.
    *   **Key Fields**: `from_location`, `to_location`, `quantity`.
    *   **Relationships**: References Products and Users.

*   **Patients (`patients`)**:
    *   **Purpose**: Stores customer profiles, primarily for prescription tracking.
    *   **Key Fields**: `full_name`, `phone`, `allergies`.
    *   **Indexes**: Index on `phone` for fast lookup.

*   **Prescriptions (`prescriptions`)**:
    *   **Purpose**: Records prescriptions provided by external doctors and managed by pharmacists.
    *   **Key Fields**: `prescription_no` (auto-generated), `status`.
    *   **Relationships**: Belongs to Patients, Dispensed by Users, linked to Prescription Items and Sales.
    *   **Indexes**: Unique index on `prescription_no`, index on `status`.

*   **Prescription Items (`prescription_items`)**:
    *   **Purpose**: The individual medications within a prescription.
    *   **Key Fields**: `quantity`, `dosage`, `dispensed_qty`.
    *   **Relationships**: Belongs to Prescriptions, references Products.

*   **Sales (`sales`)**:
    *   **Purpose**: The master record for a transaction/receipt.
    *   **Key Fields**: `sale_number`, `total_amount` (NO TAX involved), `sale_type`.
    *   **Relationships**: Processed by Users (Cashier), links to Patients and Prescriptions. Contains Sale Items and Payments.
    *   **Indexes**: Unique index on `sale_number`, index on `created_at` (for reporting).

*   **Sale Items (`sale_items`)**:
    *   **Purpose**: Line items for a sale.
    *   **Key Fields**: `quantity`, `unit_price`, `total_price`.
    *   **Relationships**: Belongs to Sales, references Products.

*   **Payment Methods (`payment_methods`)**:
    *   **Purpose**: Dynamic list of accepted payment forms (Cash, CBE, Telebirr).
    *   **Key Fields**: `code` (unique internal identifier).

*   **Payments (`payments`)**:
    *   **Purpose**: Records payments made against a Sale (allows split payments).
    *   **Key Fields**: `amount`, `reference_number`.
    *   **Relationships**: Belongs to Sales, references Payment Methods.

*   **Audit Log (`audit_log`)**:
    *   **Purpose**: Security and compliance log for critical system events.
    *   **Key Fields**: `action`, `entity_type`, `details` (JSON before/after).
    *   **Indexes**: Index on `entity_type` and `entity_id`.

*   **Store Settings (`store_settings`)**:
    *   **Purpose**: Singleton table containing global app configuration and branding.

### Key Relationships Summary
- **Products belong to Categories**: A 1-to-many relationship enabling structured inventory filtering.
- **Inventory references Products and has a location (STORE/DISPENSARY)**: Tracks the physical location and batch level detail for a single product record.
- **Transfers track movement between locations**: Providing an audit trail for stock movement, linking a User to the event.
- **Prescriptions belong to Patients, contain PrescriptionItems**: Encapsulates the medical order and the specific products to dispense.
- **Sales contain SaleItems, can link to Prescriptions**: Links the financial transaction to the medical transaction (if applicable) and updates revenue.
- **Payments belong to Sales and reference PaymentMethods**: Enabling a single Sale to have multiple Payments (split payments).
- **AuditLog tracks all changes**: Generalized logging tracking which user modified which entity.

## 9. API Design

### Resource: Auth
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | Authenticate and get tokens | No | All |
| POST | `/api/v1/auth/logout` | Invalidate current tokens | Yes | All |
| POST | `/api/v1/auth/refresh` | Get new access token via refresh token | No | All |
| GET | `/api/v1/auth/me` | Get current user profile | Yes | All |

**Example: `POST /api/v1/auth/login`**
Request:
```json
{
  "username": "admin1",
  "password": "Password123"
}
```
Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "username": "admin1",
      "role": "ADMIN"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "dGhpcy1pcy1hLXJlZnJlc2g..."
  },
  "message": "Login successful"
}
```

### Resource: Products
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| GET | `/api/v1/products` | List products | Yes | All |
| POST | `/api/v1/products` | Create a new product | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/products/:id` | Get product details | Yes | All |
| PUT | `/api/v1/products/:id` | Update a product | Yes | ADMIN, PHARMACIST |
| DELETE | `/api/v1/products/:id` | Soft-delete a product | Yes | ADMIN |
| GET | `/api/v1/products/search?q=...` | Search products | Yes | All |
| GET | `/api/v1/products/low-stock` | Get items below reorder level | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/products/expiring?days=30` | Get items nearing expiry | Yes | ADMIN, PHARMACIST |

**Example: `POST /api/v1/products` (Medicine)**
Request:
```json
{
  "name": "Paracetamol 500mg",
  "product_type": "MEDICINE",
  "category_id": "...",
  "generic_name": "Acetaminophen",
  "dosage_form": "Tablet",
  "strength": "500mg",
  "unit_price": 25.00,
  "requires_prescription": false
}
```

**Example: `POST /api/v1/products` (Cosmetic)**
Request:
```json
{
  "name": "Nivea Body Lotion",
  "product_type": "COSMETIC",
  "category_id": "...",
  "brand": "Nivea",
  "unit_price": 350.00,
  "requires_prescription": false
}
```

### Resource: Inventory & Transfers
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| GET | `/api/v1/inventory` | List all inventory | Yes | ADMIN, PHARMACIST |
| POST | `/api/v1/inventory` | Add new stock | Yes | ADMIN, PHARMACIST |
| PUT | `/api/v1/inventory/:id` | Adjust specific stock item | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/inventory/store` | Get store inventory | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/inventory/dispensary` | Get dispensary inventory | Yes | All |
| POST | `/api/v1/inventory/transfer` | Move stock Store -> Dispensary | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/inventory/transfers` | List transfer history | Yes | ADMIN, PHARMACIST |

**Example: `POST /api/v1/inventory/transfer`**
Request:
```json
{
  "product_id": "...",
  "batch_number": "BATCH-001",
  "from_location": "STORE",
  "to_location": "DISPENSARY",
  "quantity": 50,
  "notes": "Weekly restock"
}
```

### Resource: Prescriptions
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| GET | `/api/v1/prescriptions` | List prescriptions | Yes | ADMIN, PHARMACIST |
| POST | `/api/v1/prescriptions` | Create a prescription | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/prescriptions/:id` | Get prescription details | Yes | ADMIN, PHARMACIST |
| PUT | `/api/v1/prescriptions/:id` | Update prescription | Yes | ADMIN, PHARMACIST |
| PATCH | `/api/v1/prescriptions/:id/status` | Change status | Yes | ADMIN, PHARMACIST |
| POST | `/api/v1/prescriptions/:id/dispense` | Mark as dispensed | Yes | PHARMACIST |

**Example: `POST /api/v1/prescriptions`**
Request:
```json
{
  "patient_id": "...",
  "prescribed_by": "Dr. Smith",
  "items": [
    {
      "product_id": "...",
      "quantity": 10,
      "dosage": "1 tablet 3x daily",
      "duration": "3 days"
    }
  ]
}
```

### Resource: Sales
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| GET | `/api/v1/sales` | List all sales | Yes | ADMIN, PHARMACIST, CASHIER |
| POST | `/api/v1/sales` | Process new sale | Yes | ADMIN, CASHIER |
| GET | `/api/v1/sales/:id` | Get sale details | Yes | All |
| POST | `/api/v1/sales/:id/refund` | Process refund | Yes | ADMIN |
| GET | `/api/v1/sales/:id/receipt` | Get printable receipt data | Yes | All |

**Example: `POST /api/v1/sales` (Split Payment)**
Request:
```json
{
  "sale_type": "WALK_IN",
  "subtotal": 500.00,
  "discount_amount": 0.00,
  "total_amount": 500.00,
  "items": [
    {
      "product_id": "...",
      "batch_number": "B123",
      "quantity": 2,
      "unit_price": 250.00,
      "total_price": 500.00
    }
  ],
  "payments": [
    {
      "payment_method_id": "cash-uuid",
      "amount": 200.00
    },
    {
      "payment_method_id": "telebirr-uuid",
      "amount": 300.00,
      "reference_number": "T12345"
    }
  ]
}
```

### Resource: Reports
| Method | Path | Description | Auth Required | Roles |
|---|---|---|---|---|
| GET | `/api/v1/reports/sales` | Sales report | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/reports/inventory` | Inventory report | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/reports/financial` | Financial summary | Yes | ADMIN |
| GET | `/api/v1/reports/prescriptions` | Prescription report | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/reports/expiring-products` | Expiring items | Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/reports/stock-movement` | Stock movement report| Yes | ADMIN, PHARMACIST |
| GET | `/api/v1/reports/export` | Export reports (CSV) | Yes | ADMIN |

**Example: `GET /api/v1/reports/sales?from=2023-01-01&to=2023-01-31&group_by=day`**
Response:
```json
{
  "success": true,
  "data": {
    "total_revenue": 15000.00,
    "sales_count": 45,
    "daily_breakdown": [
      { "date": "2023-01-01", "revenue": 500.00 },
      { "date": "2023-01-02", "revenue": 1000.00 }
    ]
  },
  "message": "Report generated"
}
```

### Example Error Response
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 5 items left in Dispensary for Paracetamol."
  }
}
```

### Authentication Flow
1. User POSTs to `/api/v1/auth/login` with username and password.
2. Server validates, generates a short-lived Access Token (JWT) and a long-lived Refresh Token.
3. Access token is passed in `Authorization: Bearer <token>` header for subsequent requests.
4. When access token expires, client calls `/api/v1/auth/refresh` with refresh token to get a new access token.

### Pagination, Filtering, Sorting
- Pagination: Use `?page=1&limit=20`. Response includes `pagination` object with `page`, `limit`, `total`, `totalPages`.
- Search/Filtering: Use `?search=x` or explicit column queries like `?product_type=MEDICINE&location=DISPENSARY`.
- Sorting: `?sort=name&order=asc` (or desc).

## 10. UI/UX Specifications

### Design Principles
- **Minimalist & Clean:** Reduce visual clutter, prioritizing essential information for fast workflow.
- **Professional:** Healthcare-oriented aesthetics building trust.
- **Mobile-First:** Ensure the app is responsive, primarily for mobile tablets/phones used by staff.

### Theming & Typography
- **Colors:** Configurable via `store_settings`. Default Primary is `#2563EB` (Blue), Secondary `#1E40AF`.
- **Typography:** System fonts preferred (Inter, Roboto). Explicit support for standard Ethiopic fonts for accurate Amharic rendering.

### Navigation
- **Desktop:** Left-hand sidebar containing key modules (Dashboard, POS, Inventory, Prescriptions, Reports, Settings).
- **Mobile:** Bottom navigation bar for core daily tasks (POS, Inventory) with a hamburger menu for others.

### Key Pages
1. **Login Page:** Simple centered card with Username/Password. Branded logo at the top. Language toggle on the top right.
2. **Dashboard:** 
   - Top row: Key Metrics Cards (Today's Sales, Low Stock Alerts, Pending Prescriptions).
   - Below: Quick action buttons and a mini chart of weekly sales.
3. **Inventory List:** 
   - Top tabs: "Store" | "Dispensary" | "Transfers". 
   - Table view with columns for Product, Batch, Expiry, Qty. Includes a low-stock visual badge.
4. **Product Detail/Edit Form:** Form separated into Basic Info, Pharmaceutical Data (for Medicines), and Inventory Status.
5. **Transfer Form:** Simple two-column modal: select product/batch, define quantity to move Store -> Dispensary.
6. **Prescription List & Form:** View pending prescriptions. Form allows adding multiple line items to a single prescription ID.
7. **POS/Billing Page:** 
   - Split view on desktop: Left side is product search/scan + cart, right side is payment summary.
   - Mobile: Search first, tap cart icon to view and checkout.
   - Payment modal: Dropdowns for split payments (e.g., partial Cash, partial Telebirr).
8. **Patient List & Detail:** Standard CRUD view. Detail page shows prescription and purchase history tabs.
9. **Reports Page:** Tabs for Sales, Inventory, Financial, Prescriptions. Date range pickers and chart visualizations.
10. **Settings Page:** Manage store settings (name, colors, logo uploads), and payment methods.
11. **User Management:** Admin only. List of staff, roles, and status toggle.

### Mobile Adaptations
- **POS/Billing:** Uses a bottom sheet for the cart. The main view focuses heavily on product search and barcode scanning.
- **Inventory & Patients:** Tables stack vertically into card views to avoid horizontal scrolling on small screens.
- **Sidebar:** Collapses into a bottom navigation bar for primary routes, with a modal side-drawer for secondary routes.

### Component Library
- **Buttons:** Solid Primary, Outline Secondary, Text/Link.
- **Inputs:** Floating labels, clean borders.
- **Modals:** Slide-in for forms, centered for confirmations.
- **Tables:** Striped rows, sticky headers.
- **Cards:** White background, subtle shadow for metrics.
- **Alerts:** Colored banners for system notices.
- **Badges:** Color-coded (e.g., Red for Expired, Yellow for Low Stock).

### Language Toggle
- **Placement:** Always accessible in the top navigation header on desktop, or the main dropdown menu on mobile.
- **Behavior:** Instantly swaps i18next language context across the entire application without a page refresh.

## 11. Code Snippets & Implementation Patterns

### 1. Project Setup
**client/package.json**
```json
{
  "name": "tilexpharmacy-client",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.10.0",
    "react-i18next": "^12.2.0",
    "i18next": "^22.4.15",
    "axios": "^1.3.5",
    "zustand": "^4.3.7",
    "lucide-react": "^0.244.0"
  },
  "devDependencies": {
    "tailwindcss": "^3.3.0",
    "vite": "^4.3.0"
  }
}
```
**server/package.json**
```json
{
  "name": "tilexpharmacy-server",
  "version": "1.0.0",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^6.1.5",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "@prisma/client": "^4.14.0",
    "dotenv": "^16.0.3"
  },
  "devDependencies": {
    "prisma": "^4.14.0",
    "nodemon": "^2.0.22",
    "jest": "^29.5.0",
    "supertest": "^6.3.3"
  }
}
```

### 2. Prisma Schema
*(The complete schema.prisma file is provided in Section 8).*

### 3. Authentication Middleware
**server/src/middleware/auth.js**
```javascript
const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, error: { message: "Unauthorized" } });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { message: "Invalid Token" } });
  }
};

module.exports = { authenticate };
```

### 4. RBAC Middleware
**server/src/middleware/rbac.js**
```javascript
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: { message: "Forbidden: Insufficient privileges" } });
    }
    next();
  };
};

module.exports = { requireRole };
```

### 5. Inventory Transfer Service
**server/src/services/inventoryService.js**
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const transferStock = async (product_id, batch_number, quantity, from_location, to_location, user_id, notes) => {
  return await prisma.$transaction(async (tx) => {
    // Check source inventory
    const sourceInv = await tx.inventory.findUnique({
      where: {
        product_id_location_batch_number: {
          product_id, location: from_location, batch_number
        }
      }
    });

    if (!sourceInv || sourceInv.quantity < quantity) {
      throw new Error('Insufficient stock in source location');
    }

    // Decrement Source
    await tx.inventory.update({
      where: { id: sourceInv.id },
      data: { quantity: sourceInv.quantity - quantity }
    });

    // Increment/Create Destination
    const destInv = await tx.inventory.findUnique({
      where: {
        product_id_location_batch_number: {
          product_id, location: to_location, batch_number
        }
      }
    });

    if (destInv) {
      await tx.inventory.update({
        where: { id: destInv.id },
        data: { quantity: destInv.quantity + quantity }
      });
    } else {
      await tx.inventory.create({
        data: {
          product_id,
          location: to_location,
          batch_number,
          quantity,
          expiry_date: sourceInv.expiry_date
        }
      });
    }

    // Create Transfer Record
    const transfer = await tx.inventoryTransfer.create({
      data: {
        product_id, batch_number, from_location, to_location, quantity, transferred_by: user_id, notes
      }
    });

    // Audit Log
    await tx.auditLog.create({
      data: {
        user_id, action: 'TRANSFER', entity_type: 'INVENTORY', entity_id: transfer.id,
        details: { from: from_location, to: to_location, quantity }
      }
    });

    return transfer;
  });
};
module.exports = { transferStock };
```

### 6. Sales/Billing Service
**server/src/services/salesService.js**
```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateSaleNumber = () => `SL-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

const createSale = async (items, payments, cashier_id, prescription_id = null, patient_id = null, discount = 0, sale_type = 'WALK_IN') => {
  return await prisma.$transaction(async (tx) => {
    let subtotal = 0;

    for (let item of items) {
      const inv = await tx.inventory.findUnique({
        where: {
          product_id_location_batch_number: {
             product_id: item.product_id, location: 'DISPENSARY', batch_number: item.batch_number
          }
        }
      });

      if (!inv || inv.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.product_id}`);
      }
      
      await tx.inventory.update({
        where: { id: inv.id },
        data: { quantity: inv.quantity - item.quantity }
      });
      subtotal += item.total_price;
    }

    const total_amount = subtotal - discount;

    const sale = await tx.sale.create({
      data: {
        sale_number: generateSaleNumber(),
        prescription_id,
        patient_id,
        cashier_id,
        subtotal,
        discount_amount: discount,
        total_amount,
        sale_type,
        items: {
          create: items.map(i => ({
            product_id: i.product_id,
            batch_number: i.batch_number,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount: i.discount,
            total_price: i.total_price
          }))
        },
        payments: {
          create: payments.map(p => ({
            payment_method_id: p.payment_method_id,
            amount: p.amount,
            reference_number: p.reference_number
          }))
        }
      },
      include: { items: true, payments: true }
    });

    return sale;
  });
};
module.exports = { createSale };
```

### 7. React: Customization/Theme Provider
**client/src/context/ThemeContext.jsx**
```jsx
import React, { createContext, useEffect, useState } from 'react';
import axios from 'axios';

export const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    axios.get('/api/v1/settings').then(res => {
      setSettings(res.data.data);
      // Inject CSS variables for Tailwind
      document.documentElement.style.setProperty('--color-primary', res.data.data.primary_color);
      document.documentElement.style.setProperty('--color-secondary', res.data.data.secondary_color);
    });
  }, []);

  if (!settings) return <div>Loading...</div>;

  return (
    <ThemeContext.Provider value={{ settings }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

### 8. React: i18n Setup
**client/src/i18n/index.js**
```javascript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../public/locales/en/translation.json';
import amTranslation from '../../public/locales/am/translation.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      am: { translation: amTranslation }
    },
    lng: "en", // default
    fallbackLng: "en",
    interpolation: { escapeValue: false }
  });

export default i18n;
```

### 9. React: POS/Billing Component
**client/src/components/sales/POSPage.jsx**
```jsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const POSPage = () => {
  const { t } = useTranslation();
  const [cart, setCart] = useState([]);
  
  const addToCart = (product) => {
    setCart([...cart, { ...product, quantity: 1, total: product.unit_price }]);
  };

  const handleCheckout = () => {
    // Process sale checkout and split payments
  };

  return (
    <div className="flex h-screen">
      <div className="w-2/3 p-4 border-r">
        <h2>{t('pos.search_products')}</h2>
        {/* Search Input & Results... onClick={addToCart} */}
      </div>
      <div className="w-1/3 p-4 bg-gray-50">
        <h2>{t('pos.current_sale')}</h2>
        {cart.map((item, i) => (
          <div key={i} className="flex justify-between">
            <span>{item.name}</span>
            <span>{item.quantity} x {item.unit_price} ETB</span>
          </div>
        ))}
        <button onClick={handleCheckout} className="w-full bg-blue-600 text-white mt-4 p-2 rounded">
          {t('pos.checkout')}
        </button>
      </div>
    </div>
  );
};

export default POSPage;
```

### 10. Sample Translation Files
**client/public/locales/en/translation.json**
```json
{
  "pos": {
    "search_products": "Search Products",
    "current_sale": "Current Sale",
    "checkout": "Checkout"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

**client/public/locales/am/translation.json**
```json
{
  "pos": {
    "search_products": "ምርቶችን ይፈልጉ",
    "current_sale": "የአሁኑ ሽያጭ",
    "checkout": "ክፈል"
  },
  "common": {
    "save": "አስቀምጥ",
    "cancel": "ሰርዝ"
  }
}
```

### 11. Configuration File
**server/src/config/constants.js**
```javascript
module.exports = {
  APP_DEFAULTS: {
    NAME: 'TilexPharmacy',
    CURRENCY: 'ETB',
    DEFAULT_LANG: 'en',
    TAX_RATE: 0.00
  },
  ROLES: {
    ADMIN: 'ADMIN',
    PHARMACIST: 'PHARMACIST',
    CASHIER: 'CASHIER'
  }
};
```

## 12. Testing Plan

### Unit Testing Strategy
- **Backend (Jest):** Services, Middleware, Utilities. Focus heavily on stock decrement logic and auth logic.
- **Frontend (React Testing Library):** Component rendering, POS cart calculation logic, Context/Zustand store logic.

### Key Test Cases
- **Auth:** 
  - Login returns valid JWT.
  - Expired token is rejected.
  - Role protection blocks non-admin from creating users.
- **Inventory Transfer:** 
  - Should throw error if source stock < transfer amount.
  - Should accurately increment target and decrement source atomically.
- **Sales Creation:** 
  - Total calculations without tax should be exact.
  - Ensure payments sum >= total.
  - Dispense logic decrements stock accurately from DISPENSARY.
- **Prescription Workflow:** 
  - PENDING -> DISPENSED changes trigger appropriate state updates.

### Integration Tests
- **Supertest:** Test API endpoints against an in-memory or test database. Validate correct HTTP status codes (200, 400, 401, 403, 404) and JSON payload structures for primary CRUD operations.

### E2E Flow
- Launch system, login as Admin.
- Create new medicine, add stock to Store.
- Transfer stock Store -> Dispensary.
- Login as Cashier, process Walk-In sale for medicine with split payment.
- Verify receipt generation and final inventory counts.

### Test Data
- Provide a `seed.js` script that utilizes Prisma to populate predefined Admins, products, dummy stock, and settings.

## 13. Deployment Plan

### Hosting Options
- **Backend & DB:** Render, Railway, or DigitalOcean App Platform.
- **Frontend:** Vercel, Netlify, or Render static site hosting.

### Environment Variables (.env)
```bash
DATABASE_URL="postgresql://user:pass@host:5432/tilexpharmacy"
JWT_SECRET="super-secret-key-change-in-prod"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=5000
```

### Production Checklist
- **Database:** Run `npx prisma migrate deploy` on build.
- **Security:** Helmet for headers, CORS configured for frontend domain, express-rate-limit applied to auth endpoints.
- **SSL/HTTPS:** Provided natively by hosting platforms.
- **Backups:** Implement `pg_dump` cron job for automated daily DB backups to S3.

## 14. Customization Guide

### Brand Configuration (Admin UI)
Admins can navigate to **Settings** in the web app to modify the Pharmacy Name, upload a new Logo, and define Hex Codes for primary/secondary colors. This updates the `store_settings` table and broadcasts instantly via React Context to update the UI theme.

### Payment Methods
To add "Amole", navigate to **Settings > Payment Methods**, click "Add", and enter the Name and Code ("AMOLE"). It instantly appears in the POS split-payment dropdowns.

### Adding New Languages
1. Create a new folder (e.g., `client/public/locales/ti/` for Tigrinya).
2. Create `translation.json` in that folder mirroring English keys.
3. Import and add it to `client/src/i18n/index.js` under `resources`.
4. Add toggle option in UI dropdown.

### Code-Level Customizations
- **Roles:** To add a "DOCTOR" role, update the `Role` enum in `schema.prisma`, run migration, update `server/src/config/constants.js`, and adjust `requireRole` arrays on specific API routes.
- **Categories:** Add or modify categories via the Admin UI, which populates the `categories` table and dynamically updates product selection dropdowns.
- **Theming:** Tailwind CSS config accesses CSS variables set by the `ThemeContext` fetching `store_settings` to automatically apply brand colors across the app.

## 15. Appendices

### Glossary
- **Store (ስቶር):** Bulk warehouse storage.
- **Dispensary (ዲስፐንሰሪ):** Retail storefront/pharmacy counter.
- **OTC (ያለ ማዘዣ የሚሸጥ):** Over the counter (no prescription needed).
- **Batch Number (የምርት ቁጥር):** Manufacturer's batch ID for tracking expiry.

### Sample Seed Reference
**server/prisma/seed.js**
```javascript
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      full_name: 'Super Admin',
      username: 'admin',
      password_hash: adminPass,
      role: 'ADMIN'
    }
  });

  await prisma.storeSettings.create({
    data: { pharmacy_name: 'TilexPharmacy' }
  });

  await prisma.paymentMethod.createMany({
    data: [
      { name: 'Cash', code: 'CASH' },
      { name: 'Telebirr', code: 'TELEBIRR' },
      { name: 'CBE', code: 'CBE' }
    ]
  });
}
main();
```

### Document History

| Version | Date       | Author              | Notes                                                |
| ------- | ---------- | -------------------- | ---------------------------------------------------- |
| 1.0     | 2026-09-03 | TilexPharmacy Team   | Initial PRD — Complete document covering all 15 sections |

---

*This document is the sole reference for building the TilexPharmacy system. All branding, payment methods, categories, and settings are designed to be easily customizable. See Section 14: Customization Guide for details.*
