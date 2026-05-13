# SAMS API Documentation

Welcome to the **Student Academic Management System (SAMS)** API Documentation. This document provides a comprehensive overview of the available RESTful endpoints, intended for frontend developers building the Admin Dashboard and Mobile Application.

## Base URL
All API endpoints are prefixed with: `/api`
Example: `https://diit-sams-api.onrender.com/api/`

## Authentication & Authorization
All secured endpoints require a JWT token passed in the `Authorization` header.
Format: `Authorization: Bearer <token>`

### Roles & Hierarchy
The system uses a strict role hierarchy:
1. **Super Admin (`super_admin`)**: Unrestricted access. Implicitly allowed anywhere `admin` is allowed.
2. **Admin (`admin`)**: Can manage all academic data, teachers, and students. Cannot create or modify Super Admins/Admins.
3. **Teacher (`teacher`)**: Can mark attendance, enter marks, and view assigned classes/students.
4. **Accountant (`accountant`)**: Can manage fines, fee waivers, and financial reports.
5. **Parent/Student (`parent`, `student`)**: Read-only access to their specific records.

---

## 1. Authentication (`/api/auth`)

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Register a new user | `super_admin`, `admin` |
| `POST` | `/login` | Authenticate and receive JWT | Public |
| `GET`  | `/me` | Get current logged-in user details | All authenticated |
| `PUT`  | `/update-profile` | Update profile details | All authenticated |
| `PUT`  | `/change-password` | Change account password | All authenticated |
| `PUT`  | `/first-login-password` | Change password for the first time | All authenticated |

> **Note on Login**: If `isFirstLogin` is true, the login response will include `mustChangePassword: true` in the `data` object. The user MUST then call `/first-login-password` before continuing.

---

## 2. User Management (`/api/users`)

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/` | Get all users (paginated, searchable) | `super_admin`, `admin` |
| `POST` | `/` | Create a new user (with role restrictions) | `super_admin`, `admin` |
| `GET`  | `/:id` | Get single user by ID | `super_admin`, `admin` |
| `PUT`  | `/:id` | Update user details | `super_admin`, `admin` |
| `DELETE`| `/:id` | Deactivate a user | `super_admin`, `admin` |
| `GET`  | `/teachers` | Get list of all active teachers | `super_admin`, `admin` |

---

## 3. Academic Structure (`/api/classes`, `/api/batches`, `/api/sections`, `/api/subjects`)

### Classes (`/api/classes`)
| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/` | List all classes | `super_admin`, `admin`, `teacher`, `accountant` |
| `POST` | `/` | Create a new class | `super_admin`, `admin` |
| `PUT/DEL`| `/:id` | Update / Delete a class | `super_admin`, `admin` |

### Sections (`/api/sections`)
*Endpoints follow standard CRUD similar to Classes.*
* Teachers can only manage/view data for sections they are explicitly assigned to.

---

## 4. Student Management (`/api/students`)

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/` | Get all students (filterable by class/section) | `super_admin`, `admin`, `teacher`, `accountant`, `parent` |
| `POST` | `/` | Enroll a single student | `super_admin`, `admin` |
| `POST` | `/bulk` | Bulk enroll students (via array) | `super_admin`, `admin` |
| `PUT`  | `/:id` | Update student profile | `super_admin`, `admin` |
| `GET`  | `/:id/attendance-summary` | Get student attendance stats | `super_admin`, `admin`, `teacher`, `parent` |
| `GET`  | `/:id/academic-summary` | Get student academic stats | `super_admin`, `admin`, `teacher`, `parent` |

---

## 5. Fines & Fees (`/api/fines`)

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/types` | List all fine types (e.g., Late Fee) | `super_admin`, `admin`, `accountant` |
| `POST` | `/types` | Create a new fine type | `super_admin`, `admin`, `accountant` |
| `POST` | `/` | Issue a fine to a student | `super_admin`, `admin`, `accountant` |
| `POST` | `/bulk` | Bulk issue fines | `super_admin`, `admin`, `accountant` |
| `PATCH`| `/:id/pay` | Mark fine as paid | `super_admin`, `admin`, `accountant` |
| `PATCH`| `/:id/waive`| Waive a fine | `super_admin`, `admin`, `accountant` |
| `GET`  | `/student/:id/summary` | Fines summary for a student | `super_admin`, `admin`, `accountant`, `parent` |

---

## 6. Reports & Exports (`/api/reports`)
*Used heavily by the Admin Dashboard for downloadable records.*

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/export/pdf/fine/student/:id` | Download Student Fine PDF | `super_admin`, `admin`, `accountant`, `parent` |
| `GET`  | `/export/pdf/fine/section/:id` | Download Section Fines PDF | `super_admin`, `admin`, `accountant` |
| `GET`  | `/export/pdf/record/section/:id` | Download Section Academic Record | `super_admin`, `admin`, `teacher` |
| `GET`  | `/export/excel/attendance/:id` | Download Attendance Excel | `super_admin`, `admin`, `teacher` |
| `GET`  | `/export/excel/results/:id` | Download Results Excel | `super_admin`, `admin`, `teacher` |

--

## 7. Results & Examinations (`/api/results`, `/api/examMarks`)

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `POST` | `/results/generate` | Auto-calculate grades & GPA | `super_admin`, `admin` |
| `GET`  | `/results/transcript/:id` | Get detailed transcript | `super_admin`, `admin`, `teacher`, `parent` |
| `PATCH`| `/results/:id/publish` | Publish a result | `super_admin`, `admin` |

---

## 8. CSV Bulk Operations (`/api/csv`)
*Used for administrative automation and bulk data entry.*

| Method | Endpoint | Description | Allowed Roles |
| :--- | :--- | :--- | :--- |
| `GET`  | `/template` | Download CSV student upload template | `super_admin`, `admin` |
| `POST` | `/upload-students` | Bulk upload students via CSV | `super_admin`, `admin` |
| `POST` | `/resend-credentials/:studentId` | Reset password and resend welcome email | `super_admin`, `admin`, `accountant` |

### Student CSV Format
Required columns: `student_id, name, email, mobile, class, batch, section`

---

## Postman / Mobile App Integration Tips
1. **Initial Login**: Always test the flow starting with `POST /api/auth/login` using the `admin@diit.com` Super Admin credentials. Save the resulting `token` to your app's secure storage or global state.
2. **Error Handling**: The API returns standard JSON errors in the format: `{ "success": false, "error": "Error message" }`.
3. **Pagination**: Most `GET` routes returning lists accept `?page=1&limit=20` query parameters. Total counts and pages are returned in the response wrapper.
4. **Offline Support (Mobile)**: Use the `/api/sync` endpoints to pull down base master data (Classes, Subjects, Sections) to store in local SQLite/AsyncStorage to reduce redundant network calls.
