# University Student Management System API

Complete RESTful API for a University Student Academic Management System. Built with Node.js, Express, and MongoDB.

## Features & Modules

*   **Auth & Users**: Role-based access control with hierarchy (Super Admin -> Admin -> Teacher -> Parent -> Student). Super Admins have full system control, while Admins manage teachers and classes.
*   **Academic Structure**: Classes, Batches, Sections, Subjects.
*   **Students**: Comprehensive records, profiles, parent links.
*   **Attendance**: Daily tracking, bulk holiday marking, status updates.
*   **Examinations**: Midterm/Final marks, auto-grade calculation.
*   **Lab Management**: Lab sessions, equipment tracking, practical marks.
*   **Class Tests**: Test series, best-of-N scoring logic.
*   **Fines & Fees**: Recurring fine rules (daily/weekly/monthly), waivers, payment tracking.
*   **Results**: Aggregate generation, SGPA/CGPA calculation, rank assignment, transcript generation.
*   **Reports & Exports**: PDF & Excel generation for attendance, fines, marks, and section records.
*   **Dashboard**: High-level stats, trends, pending tasks.

## Setup Instructions

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Setup:**
    Check the `.env` file. It already contains the MongoDB URI you provided:
    `MONGO_URI=mongodb+srv://diitsamsDB:P7TBuF14DwCVs1PU@cluster0.adild.mongodb.net/diitsamsDB?retryWrites=true&w=majority&appName=Cluster0`

3.  **Seed the Database (Load Demo Data):**
    ```bash
    npm run seed
    ```
    *To destroy all data later: `npm run seed:destroy`*

4.  **Create Super Admin:**
    ```bash
    npm run seed:superadmin
    ```
    *(Creates the root super admin account with full privileges)*

5.  **Run the Server:**
    ```bash
    # Development mode
    npm run dev
    
    # Production mode
    npm start
    ```

## Demo Credentials (after running seed and createSuperAdmin)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@diit.com` | `Sams@2026` |
| **Admin** | `admin@university.edu` | `admin123` |
| **Accountant** | `accounts@university.edu` | `accounts123` |
| **Teacher 1** | `teacher1@university.edu` | `teacher123` |
| **Teacher 2** | `teacher2@university.edu` | `teacher123` |
| **Teacher 3** | `teacher3@university.edu` | `teacher123` |
| **Teacher 4** | `teacher4@university.edu` | `teacher123` |
| **Parent** | `parent@university.edu` | `parent123` |

## API Endpoints

### Auth
*   `POST /api/auth/register` (Super Admin/Admin)
*   `POST /api/auth/login` (Public)
*   `GET /api/auth/me` (Private)
*   `PUT /api/auth/update-profile` (Private)

### Academic Entities
*   `GET/POST/PUT/DELETE /api/classes`
*   `GET/POST/PUT/DELETE /api/batches`
*   `GET/POST/PUT/DELETE /api/sections`
*   `GET/POST/PUT/DELETE /api/subjects`

### Core
*   `GET/POST/PUT/DELETE /api/students`
*   `POST /api/attendance/mark`
*   `POST /api/fines/issue`
*   `POST /api/results/generate`

*(Check routes folders for complete list of endpoints).*
