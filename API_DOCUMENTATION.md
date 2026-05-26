# SAMS API Documentation

**Base URL:** `https://sams-api-server.onrender.com/api`  
**Health Check:** `GET /api/health`

---

## Authentication System

### Dual-Token Architecture

| Token | Location | Lifetime | Purpose |
|:------|:---------|:---------|:--------|
| **Access Token** | `Authorization: Bearer <token>` + `token` cookie | 15 minutes | Authenticate every API request |
| **Refresh Token** | `refreshToken` httpOnly cookie | 7 days | Silently renew the access token |

### Auth Flow for Frontend

1. Call `POST /auth/login` → receive `token` in JSON body + cookies set automatically.
2. Store the `token` in memory/state (NOT localStorage for security).
3. Attach to every request: `Authorization: Bearer <token>`.
4. When you get `401` with `isExpired: true`, call `POST /auth/refresh-token` (cookies auto-sent).
5. On success, you get a fresh `token` → retry the failed request.
6. If refresh also fails → redirect user to login page.

### Axios Interceptor (Copy-Paste Ready)

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://sams-api-server.onrender.com/api',
  withCredentials: true  // REQUIRED for cookies
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sams_token'); // or from state
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await api.post('/auth/refresh-token');
        localStorage.setItem('sams_token', data.token);
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return api(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('sams_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Roles & Permissions

| Role | Code | Access Level |
|:-----|:-----|:-------------|
| Super Admin | `super_admin` | Full unrestricted access. Inherits all `admin` permissions automatically. |
| Admin | `admin` | Manage all data. Cannot create/modify super_admin or admin accounts. |
| Teacher | `teacher` | Attendance, marks, lab, class tests for assigned sections only. |
| Accountant | `accountant` | Fines, payments, financial reports. |
| Parent | `parent` | Read-only access to own child's data. |
| Student | `student` | Read-only access to own data. |

---

## 1. Authentication — `/api/auth`

### POST `/auth/login`
**Access:** Public

**Request Body:**
```json
{
  "email": "admin@diit.edu.bd",
  "password": "admin123"
}
```
> Can also use `username` field with a registration number instead of `email`.

**Success Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "data": {
    "_id": "664a...",
    "name": "Admin User",
    "email": "admin@diit.edu.bd",
    "role": "admin",
    "phone": "01700000000",
    "mustChangePassword": true
  }
}
```
> **Important:** If `mustChangePassword` is `true`, the user MUST call `PUT /auth/first-login-password` before using other endpoints.

**Cookies Set:** `token` (15min) + `refreshToken` (7 days), both httpOnly.

---

### POST `/auth/register`
**Access:** `admin`, `super_admin`  
**Headers:** `Authorization: Bearer <token>`

```json
{
  "name": "New Teacher",
  "email": "teacher@diit.edu.bd",
  "password": "securepass123",
  "role": "teacher",
  "phone": "01700000001"
}
```

---

### POST `/auth/refresh-token`
**Access:** Public (requires `refreshToken` cookie)  
**No body needed.** The server reads the cookie automatically.

**Response:** Same as login (new `token` + new cookies).

---

### GET `/auth/me`
**Access:** All authenticated users  
**Returns:** Current user profile with populated `assignedClasses` and `assignedSections`.

---

### PUT `/auth/update-profile`
**Access:** All authenticated

```json
{ "name": "Updated Name", "phone": "01800000000" }
```

---

### PUT `/auth/change-password`
**Access:** All authenticated

```json
{ "currentPassword": "oldpass", "newPassword": "newpass123" }
```

---

### PUT `/auth/first-login-password`
**Access:** All authenticated

```json
{ "currentPassword": "temppass", "newPassword": "newpass123" }
```

---

### GET `/auth/logout`
**Access:** Public  
Clears `token` and `refreshToken` cookies.

---

## 2. User Management — `/api/users`

> All routes require `admin` or `super_admin` role.

### GET `/users`
**Query Params:** `role`, `isActive`, `search`, `page`, `limit`

**Example:** `GET /users?role=teacher&search=nasir&page=1&limit=20`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "total": 12,
  "totalPages": 1,
  "currentPage": 1,
  "data": [
    {
      "_id": "...",
      "name": "Teacher Name",
      "email": "teacher@diit.edu.bd",
      "role": "teacher",
      "phone": "017...",
      "employeeId": "EMP-001",
      "designation": "Lecturer",
      "department": "CSE",
      "employmentType": "Full-time",
      "employmentStatus": "active",
      "assignedClasses": [{ "_id": "...", "name": "CSE" }],
      "assignedSections": [{ "_id": "...", "name": "A" }],
      "isActive": true,
      "isFirstLogin": false
    }
  ]
}
```

### GET `/users/teachers`
Returns only active teachers with their assigned classes/sections.

### POST `/users`
Create a new user account.

```json
{
  "name": "John Doe",
  "email": "john@diit.edu.bd",
  "password": "pass123456",
  "role": "teacher",
  "phone": "01700000000",
  "employeeId": "EMP-002",
  "designation": "Lecturer",
  "department": "CSE",
  "assignedClasses": ["<classId>"],
  "assignedSections": ["<sectionId>"]
}
```

### PUT `/users/:id`
Update user. Password updates are blocked on this route.

### DELETE `/users/:id`
Soft delete (sets `isActive: false`).

---

## 3. Dashboard — `/api/dashboard`

> All routes require `admin`, `teacher`, or `accountant`.

### GET `/dashboard/stats`
**Response:**
```json
{
  "success": true,
  "data": {
    "totalStudents": 250,
    "totalTeachers": 15,
    "totalClasses": 5,
    "attendance": { "present": 180, "absent": 20, "percentage": 72 },
    "outstandingFines": 45000
  }
}
```

### GET `/dashboard/weekly-trend`
Returns last 7 days of attendance percentages.
```json
{ "data": [{ "date": "2026-05-07", "percentage": 85 }, ...] }
```

### GET `/dashboard/classes-summary`
```json
{ "data": [{ "classId": "...", "className": "CSE", "totalStudents": 120, "totalSections": 4 }] }
```

### GET `/dashboard/pending-attendance` — Admin only
Returns sections where attendance has NOT been marked today.

### GET `/dashboard/top-absentees`
Top 10 absent students this month.

### GET `/dashboard/pending-fines` — Admin, Accountant
Top 10 students with highest outstanding fines.

### GET `/dashboard/recent-activity` — Admin only
Last 10 activities (attendance marked, marks entered, fines issued).

---

## 4. Classes — `/api/classes`

| Method | Endpoint | Access | Description |
|:-------|:---------|:-------|:------------|
| GET | `/classes` | admin, teacher, accountant | List all classes |
| GET | `/classes/:id` | admin, teacher, accountant | Get class with batches & sections |
| POST | `/classes` | admin | Create class |
| PUT | `/classes/:id` | admin | Update class |
| DELETE | `/classes/:id` | admin | Soft delete class |

**Create/Update Body:**
```json
{ "name": "CSE", "description": "Computer Science & Engineering" }
```

---

## 5. Batches — `/api/batches`

| Method | Endpoint | Access | Description |
|:-------|:---------|:-------|:------------|
| GET | `/batches?classId=<id>` | admin, teacher, accountant | List batches (filter by class) |
| GET | `/batches/:id` | admin, teacher, accountant | Get single batch |
| POST | `/batches` | admin | Create batch |
| PUT | `/batches/:id` | admin | Update batch |
| DELETE | `/batches/:id` | admin | Soft delete |

**Create Body:**
```json
{ "name": "23rd", "year": 2023, "class": "<classId>" }
```

---

## 6. Sections — `/api/sections`

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/sections?classId=<id>&batchId=<id>` | admin, teacher, accountant |
| POST | `/sections` | admin |
| PUT | `/sections/:id` | admin |
| DELETE | `/sections/:id` | admin |

**Create Body:**
```json
{ "name": "A", "class": "<classId>", "batch": "<batchId>", "teacher": "<userId>" }
```

---

## 7. Subjects — `/api/subjects`

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/subjects?classId=<id>&type=theory` | admin, teacher, accountant, parent |
| POST | `/subjects` | admin |
| PUT | `/subjects/:id` | admin |
| DELETE | `/subjects/:id` | admin |

**Create Body:**
```json
{
  "name": "Data Structures",
  "code": "CSE-201",
  "class": "<classId>",
  "teacher": "<userId>",
  "type": "theory",
  "creditHours": 3
}
```

---

## 8. Students — `/api/students`

### GET `/students`
**Query Params:** `classId`, `batchId`, `sectionId`, `gender`, `isActive`, `search`, `semester`, `program`, `page`, `limit`

**Response:**
```json
{
  "success": true,
  "count": 20,
  "total": 120,
  "totalPages": 6,
  "currentPage": 1,
  "data": [
    {
      "_id": "...",
      "name": "Student Name",
      "rollNumber": "CSE-2022-001",
      "registrationNumber": "2022331001",
      "email": "student@gmail.com",
      "phone": "017...",
      "gender": "male",
      "semester": 4,
      "program": "B.Sc in CSE",
      "cgpa": 3.45,
      "totalFineAmount": 500,
      "totalFinePaid": 200,
      "class": { "_id": "...", "name": "CSE" },
      "batch": { "_id": "...", "name": "23rd", "year": 2023 },
      "section": { "_id": "...", "name": "A" },
      "isActive": true
    }
  ]
}
```

### POST `/students` — Admin
```json
{
  "name": "New Student",
  "rollNumber": "CSE-2022-003",
  "registrationNumber": "2022331003",
  "email": "new@gmail.com",
  "phone": "01700000000",
  "class": "<classId>",
  "batch": "<batchId>",
  "section": "<sectionId>",
  "gender": "male",
  "semester": 1
}
```
> Automatically creates a User account with `role: student` and default password = registration number.

### POST `/students/bulk` — Admin
```json
{ "students": [{ "name": "...", "rollNumber": "...", ... }, ...] }
```

### GET `/students/:id/attendance-summary`
Returns: `totalDays`, `presentDays`, `lateDays`, `absentDays`, `leaveDays`, `percentage`.

### GET `/students/:id/academic-summary`
Returns complete profile: student info + attendance + exam marks + fines + results + CGPA.

### PUT `/students/:id/update-cgpa` — Admin
Recalculates and updates student CGPA from all semester results.

---

## 9. Attendance — `/api/attendance`

### POST `/attendance/mark` — Admin, Teacher
```json
{
  "date": "2026-05-13",
  "classId": "<classId>",
  "batchId": "<batchId>",
  "sectionId": "<sectionId>",
  "subjectId": "<subjectId>",
  "records": [
    { "student": "<studentId>", "status": "present" },
    { "student": "<studentId>", "status": "absent" },
    { "student": "<studentId>", "status": "late", "remarks": "10 min late" }
  ]
}
```
> **Status values:** `present`, `absent`, `late`, `leave`, `holiday`  
> Automatically sends push notification to parents of absent students.

### GET `/attendance`
**Query:** `sectionId`, `classId`, `batchId`, `date`, `from`, `to`, `subjectId`, `page`, `limit`

### GET `/attendance/today/:sectionId`
Returns today's attendance + list of unmarked students.

### GET `/attendance/summary/section/:sectionId`
**Query:** `from`, `to`, `subjectId`  
Returns per-student aggregated attendance with percentages.

### PATCH `/attendance/:id/record/:studentId`
Update individual student status in an existing attendance record.
```json
{ "status": "present", "remarks": "Corrected" }
```

### POST `/attendance/bulk-holiday` — Admin
```json
{ "startDate": "2026-05-20", "endDate": "2026-05-22", "notes": "Eid Holiday" }
```

---

## 10. Exam Marks — `/api/exam-marks`

### GET `/exam-marks`
**Query:** `classId`, `sectionId`, `subjectId`, `examType`, `academicYear`, `semester`, `studentId`, `page`, `limit`

### POST `/exam-marks` — Admin, Teacher
```json
{
  "student": "<studentId>",
  "subject": "<subjectId>",
  "section": "<sectionId>",
  "class": "<classId>",
  "examType": "midterm",
  "academicYear": "2025-2026",
  "semester": 4,
  "totalMarks": 100,
  "obtainedMarks": 75,
  "examDate": "2026-05-01"
}
```
> **examType values:** `midterm`, `final`, `quiz`, `assignment`, `presentation`, `viva`

### POST `/exam-marks/bulk` — Admin, Teacher
```json
{ "marks": [{ "student": "...", "subject": "...", ... }, ...] }
```

### PATCH `/exam-marks/:id/verify` — Admin only
Verifies the mark and sends notification to parent.

### GET `/exam-marks/section-summary`
**Query:** `sectionId`, `subjectId`, `examType`, `academicYear`, `semester`  
Returns aggregated stats: avg marks, highest, lowest, pass%, grade distribution.

### GET `/exam-marks/student/:studentId/history`
Returns all marks grouped by semester.

---

## 11. Lab — `/api/lab`

### Lab Sessions

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/lab/sessions` | admin, teacher |
| POST | `/lab/sessions` | admin, teacher |
| PUT | `/lab/sessions/:id` | admin, teacher |
| DELETE | `/lab/sessions/:id` | admin, teacher |

### Lab Marks

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/lab/marks` | admin, teacher, parent |
| POST | `/lab/marks` | admin, teacher |
| POST | `/lab/marks/bulk` | admin, teacher |
| GET | `/lab/marks/summary/:sectionId` | admin, teacher |

---

## 12. Class Tests — `/api/class-tests`

### Test Series (Configuration)

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/class-tests/series` | admin, teacher |
| POST | `/class-tests/series` | admin, teacher |
| PUT | `/class-tests/series/:id` | admin, teacher |
| DELETE | `/class-tests/series/:id` | admin, teacher |

### Class Test Marks

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/class-tests/marks` | admin, teacher, parent |
| POST | `/class-tests/marks` | admin, teacher |
| POST | `/class-tests/marks/bulk` | admin, teacher |
| GET | `/class-tests/summary/:sectionId` | admin, teacher |
| GET | `/class-tests/section-report/:sectionId` | admin, teacher |

---

## 13. Fines — `/api/fines`

### Fine Types

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/fines/types` | admin, accountant |
| POST | `/fines/types` | admin, accountant |
| PUT | `/fines/types/:id` | admin, accountant |
| DELETE | `/fines/types/:id` | admin, accountant |

**Create Fine Type:**
```json
{ "name": "Late Fee", "code": "LF-001", "amount": 500, "isRecurring": true }
```

### Fines

### GET `/fines`
**Query:** `studentId`, `sectionId`, `classId`, `status`, `fineType`, `from`, `to`, `page`, `limit`  
> **Status values:** `pending`, `partial`, `paid`, `waived`

### POST `/fines` — Admin, Accountant
```json
{
  "student": "<studentId>",
  "fineType": "<fineTypeId>",
  "amount": 500,
  "reason": "Late submission",
  "section": "<sectionId>",
  "class": "<classId>",
  "semester": 4
}
```

### POST `/fines/bulk` — Admin, Accountant
```json
{
  "studentIds": ["<id1>", "<id2>"],
  "fineTypeId": "<fineTypeId>",
  "amount": 500,
  "reason": "Lab equipment damage",
  "sectionId": "<sectionId>",
  "classId": "<classId>"
}
```

### PATCH `/fines/:id/pay` — Admin, Accountant
```json
{ "paidAmount": 300, "paymentMethod": "cash" }
```
> **paymentMethod values:** `cash`, `bank`, `mobile_banking`, `online`  
> Returns a `receiptNumber` in the response.

### PATCH `/fines/:id/waive` — Admin, Accountant
```json
{ "reason": "Financial hardship" }
```

### GET `/fines/student/:studentId/summary`
Returns: `totalFines`, `totalAmount`, `totalPaid`, `outstanding`, `overdue`, `breakdown`.

### GET `/fines/section/:sectionId`
Per-student fine summary for a section.

### POST `/fines/auto-apply` — Admin, Accountant
Triggers automatic application of recurring fines.

---

## 14. Results — `/api/results`

### POST `/results/generate` — Admin
Generates results for an entire section. Calculates SGPA, CGPA, ranks.
```json
{ "sectionId": "<sectionId>", "academicYear": "2025-2026", "semester": 4 }
```

### GET `/results`
**Query:** `sectionId`, `academicYear`, `semester`, `studentId`, `page`, `limit`

### PATCH `/results/:id/publish` — Admin
Publishes the result and sends notification to parent.

### GET `/results/summary/:sectionId`
**Query:** `academicYear`, `semester`  
Returns: `avgSGPA`, `avgCGPA`, `highestSGPA`, `passPercentage`, `toppers`.

### GET `/results/transcript/:studentId`
Returns full student transcript across all semesters.

---

## 15. Reports — `/api/reports`

### Attendance Reports

| Endpoint | Query Params |
|:---------|:-------------|
| `GET /reports/attendance/class/:classId` | `from`, `to` |
| `GET /reports/attendance/batch/:batchId` | `from`, `to` |
| `GET /reports/attendance/section/:sectionId` | `from`, `to` |
| `GET /reports/attendance/date` | `date`, `classId` |
| `GET /reports/attendance/monthly` | `month`, `year`, `sectionId` |
| `GET /reports/attendance/low` | `threshold`, `sectionId` |

### Comprehensive Reports
| Endpoint | Description |
|:---------|:------------|
| `GET /reports/student/:studentId` | Full student report (attendance + marks + fines) |
| `GET /reports/section-record/:sectionId` | Complete section academic record |

### Export — PDF
| Endpoint | Description |
|:---------|:------------|
| `GET /reports/export/pdf/fine/student/:studentId` | Student fine receipt PDF |
| `GET /reports/export/pdf/fine/section/:sectionId` | Section fine summary PDF |
| `GET /reports/export/pdf/record/section/:sectionId` | Section record PDF |

### Export — Excel
| Endpoint | Description |
|:---------|:------------|
| `GET /reports/export/excel/attendance/:sectionId` | Attendance spreadsheet |
| `GET /reports/export/excel/marks/:sectionId/:subjectId` | Marks spreadsheet |
| `GET /reports/export/excel/results/:sectionId` | Results spreadsheet |

---

## 16. Academic Calendar — `/api/calendar`

| Method | Endpoint | Access |
|:-------|:---------|:-------|
| GET | `/calendar` | admin, teacher, accountant, parent |
| GET | `/calendar/:id` | admin, teacher, accountant, parent |
| POST | `/calendar` | admin |
| PUT | `/calendar/:id` | admin |
| DELETE | `/calendar/:id` | admin |

**Query Params:** `eventType`, `classId`, `sectionId`, `from`, `to`  
**eventType values:** `holiday`, `exam`, `event`, `deadline`, `meeting`

**Create Body:**
```json
{
  "title": "Midterm Exam",
  "description": "Semester 4 Midterm Exams",
  "startDate": "2026-06-01",
  "endDate": "2026-06-10",
  "eventType": "exam",
  "isGlobal": true,
  "affectedClasses": ["<classId>"],
  "affectedSections": ["<sectionId>"]
}
```

---

## 17. Notifications — `/api/notifications`

> All routes require authentication.

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| GET | `/notifications?page=1&limit=20` | Get user's notifications |
| PATCH | `/notifications/:id/read` | Mark single as read |
| PATCH | `/notifications/read-all` | Mark all as read |
| POST | `/notifications/register-token` | Register FCM push token |

**Register FCM Token:**
```json
{ "fcmToken": "firebase-cloud-messaging-token-here" }
```

---

## 18. CSV Import — `/api/csv`

| Method | Endpoint | Access | Description |
|:-------|:---------|:-------|:------------|
| GET | `/csv/template` | admin, super_admin | Download CSV template file |
| POST | `/csv/upload-students` | admin, super_admin | Upload students via CSV (multipart/form-data, field: `file`) |
| POST | `/csv/resend-credentials/:studentId` | admin, super_admin, accountant | Resend login credentials email |

**CSV Required Columns:** `student_id`, `name`, `email`, `section`, `batch`, `department`  
**Optional Columns:** `session`, `mobile`

---

## 19. File Upload — `/api/upload`

### POST `/upload`
**Access:** All authenticated  
**Content-Type:** `multipart/form-data`  
**Field name:** `image`  
**Allowed types:** jpeg, jpg, png, webp  
**Max size:** 5MB  
Uploads to Cloudinary and returns the URL.

---

## 20. Sync — `/api/sync`

### GET `/sync`
**Access:** All authenticated  
Returns bulk data for offline-first mobile apps.

---

## Standard Response Format

### Success
```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "totalPages": 5,
  "currentPage": 1,
  "data": [...]
}
```

### Error
```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

| Code | Meaning |
|:-----|:--------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (no/invalid/expired token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 429 | Too Many Requests (rate limited: 500 req/15min) |
| 500 | Server Error |

---

## Default Admin Credentials

| Field | Value |
|:------|:------|
| Email | `admin@diit.edu.bd` |
| Password | `admin123` |

> ⚠️ Change this immediately after first login.
