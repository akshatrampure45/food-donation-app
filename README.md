# FoodShare - Food Donation Platform

Donors (hotels, restaurants, canteens, hostels, events, individuals) <-> NGOs / food banks.
Verified signup, live photos, nearby search, chat, location agreement, one-time QR handover.

Stack: FastAPI + MySQL (Aiven) + React (Vite). Deploy: Render (backend) + Vercel (frontend).

Folder layout after extracting:

    food-donation-app/
      backend/    (FastAPI)
      frontend/   (React)
      README.md

======================================================================
PART A - RUN ON YOUR COMPUTER (no accounts needed)
======================================================================
Example location: D:\Projects\food-donation-app\

A1. Backend (open Command Prompt)
    cd D:\Projects\food-donation-app\backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    copy .env.example .env
    uvicorn app.main:app --reload

    Check: http://127.0.0.1:8000/docs  (API page opens)
    The default .env uses a local SQLite file, so no MySQL is needed.
    DEV_MODE=true prints OTPs in this window AND shows them on the verify page.

A2. Frontend (open a SECOND Command Prompt)
    cd D:\Projects\food-donation-app\frontend
    copy .env.example .env
    npm install
    npm run dev

    Open http://localhost:5173

A3. Test the full flow
    1. Sign up as a Donor (allow camera + location). Verify using the test-mode OTPs shown.
    2. Sign up as an NGO in another browser / incognito window.
    3. Login as admin: admin@example.com / Admin@12345 (from backend\.env) -> approve the NGO.
    4. Donor: "Post surplus food". NGO: "Find food" -> "Request this food".
    5. Donor accepts -> both chat -> propose pickup place/time -> both approve.
    6. Donor shows the QR; NGO -> "Scan QR". Done. Scanning again says "already used".
    Tip: camera/location work on http://localhost. On a phone you need https (use the deployed site).

======================================================================
PART B - DEPLOY (all free tiers)
======================================================================
B1. Database - Aiven MySQL
    1. console.aiven.io -> create a free MySQL service.
    2. Copy Host, Port, User, Password, Database name.
    3. Download "CA certificate" (ca.pem) and put it at:
       D:\Projects\food-donation-app\backend\ca.pem
       (ca.pem is in .gitignore for safety. If you deploy from GitHub, add it to Render as a Secret File named ca.pem.)

B2. Backend - Render
    1. Push the project to GitHub.
    2. render.com -> New -> Web Service -> pick your repo.
       Root Directory: backend
       Build Command:  pip install -r requirements.txt
       Start Command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
    3. Environment variables:
       PYTHON_VERSION = 3.12.3
       DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  (from Aiven)
       DB_SSL_CA      = ca.pem   (Secret File path: /etc/secrets/ca.pem if you use a Secret File)
       DATABASE_URL   = (leave empty / do not add)
       SECRET_KEY     = any long random text
       FRONTEND_URL   = https://your-app.vercel.app
       DEV_MODE       = false
       ADMIN_EMAIL, ADMIN_PASSWORD = your admin login
       MSG91_AUTH_KEY, MSG91_TEMPLATE_ID, BREVO_API_KEY, BREVO_SENDER_EMAIL
    4. Deploy. Tables are created automatically on first start.
    Note: Render free services sleep after inactivity; first request can take ~50 seconds.

B3. Frontend - Vercel
    1. vercel.com -> Add New Project -> same repo.
       Root Directory: frontend   (Framework: Vite)
    2. Environment variables:
       VITE_API_URL         = https://your-backend.onrender.com
       VITE_GOOGLE_MAPS_KEY = your Google Maps key
    3. Deploy. Then put the Vercel URL into FRONTEND_URL on Render.

B4. Google Maps
    console.cloud.google.com -> create API key -> enable "Maps JavaScript API" and "Geocoding API".
    Restrict the key to your Vercel domain + localhost. Without a key the app still works
    (current-location button + manual coordinates + "Directions" links).

B5. OTP providers
    MSG91 (SMS): create an OTP template and note its Template ID. In India, SMS templates need DLT approval.
    Brevo (email): create an API key and verify a sender email address (BREVO_SENDER_EMAIL).
    Until keys are set, keep DEV_MODE=true (testing only). NEVER use DEV_MODE=true in production.

======================================================================
HOW THE SECURITY WORKS
======================================================================
- Both phone OTP and email OTP are required before login (OTPs expire in 10 min, max 5 wrong tries).
- NGO accounts need admin approval (admin sees org photo + registration number).
- Donors must give registration/FSSAI number (hotel/restaurant/hostel/canteen) or event details.
- Food needs a live photo, cooking time and expiry time. Expired food cannot be requested or scanned.
- Phone/email of the other side is shown only after the request is accepted.
- QR: created only after BOTH sides approve; random one-time token; only the matching NGO can scan it;
  the database marks it used atomically so it can never work twice. Cancelling invalidates it.
- Photos are stored in the database (nothing is lost when Render redeploys) with random unguessable URLs.

======================================================================
API DOCS
======================================================================
Open  <backend-url>/docs  for the full interactive API list.
