# Wearable Ledger - Secure Medical Records System

Wearable Ledger is a secure, blockchain-inspired medical records system designed to manage patient data with integrity and granular access control. It allows patients to own their records and securely share them with doctors and hospitals.

## Features

- **Role-Based Access Control**: specialized dashboards for Patients, Doctors, and Hospital Admins.
- **Blockchain Integrity**: Uses a local Merkle Tree and Ledger implementation to anchor record integrity (simulated blockchain).
- **Secure File Upload**: Patients can upload medical records (PDF, Images) which are hashed and secured.
- **Access Management**: Patients can grant or revoke doctor access to their records instantly.
- **Audit Logging**: Comprehensive audit trails for all record accesses by hospital staff.
- **Modern UI**: specialized Glassmorphism design with dark/light mode support.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+)
- **Backend**: Python (Flask)
- **Data Storage**: JSON-based local storage (simulated database)

## Project Structure

```
major_project2/
├── wearable_ledger/
│   ├── backend/        # Flask server (server.py)
│   ├── frontend/       # UI code (index.html, script.js, styles)
│   ├── uploads/        # Secured record storage
│   ├── ledger.json     # Blockchain ledger data
│   ├── users.json      # User credentials and roles
│   └── ...
└── README.md           # This file
```

## Setup & Running

### Prerequisites
- Python 3.x
- Flask (`pip install flask flask-cors`)

### Backend
1. Navigate to the backend directory:
   ```bash
   cd wearable_ledger/backend
   ```
2. Run the server:
   ```bash
   python server.py
   ```
   The server will start on `http://localhost:3003`.

### Frontend
1. Open `wearable_ledger/frontend/index.html` in your web browser.
2. OR, if the backend is configured to serve static files, visit `http://localhost:3003`.

## default Credentials
*(For testing purposes)*

- **Patient**: `user123` / `password` (check `users.json` for others)
- **Doctor**: Create via registration or check `users.json`.
- **Admin**: Create via registration or check `users.json`.

## License
[MIT](LICENSE)
