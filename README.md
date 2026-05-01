# Hotel Booking System

Professional full-stack hotel booking system built with:

- Frontend: AngularJS (1.8) + Bootstrap 5
- Backend: Node.js + Express.js
- Database: MongoDB + Mongoose
- Auth: JWT (role-based admin/user access)

## Project Structure

- `client/` - AngularJS single-page application
- `server/` - REST API with authentication, CRUD, and reports

## Features Implemented

- Secure authentication (`/api/auth/register`, `/api/auth/login`, `/api/auth/me`)
- Role-based authorization (`admin`, `user`)
- Room management CRUD (admin protected for create/update/delete)
- Booking creation, listing, cancellation
- Dashboard analytics report for admins
- Room search and filtering (`type`, `minPrice`, `maxPrice`, `guests`)
- Contact form API (`POST /api/contact`) connected to frontend Contact page
- Admin can review contact submissions from dashboard (`GET /api/contact`, admin only)
- Responsive modern UI with dashboard, booking flows, and admin panel

## Backend Setup

1. Go to backend folder:
   - `cd server`
2. Copy env template:
   - create `.env` using `.env.example`
3. Install dependencies:
   - `npm install`
4. Run in dev mode:
   - `npm run dev`

API default runs on `http://localhost:5000`.

## Frontend Setup

You can open `client/index.html` directly, or use a local static server for best results.

Quick option with Node:

1. From project root:
   - `npx http-server client -p 8080`
2. Open:
   - `http://localhost:8080`

The frontend is configured to call backend API at `http://localhost:5000/api`.

## Suggested Next Upgrades

- Add payment gateway integration
- Add room image upload and cloud storage
- Add date overlap validation for room availability
- Add unit/integration tests with Jest + Supertest
- Deploy with Docker + CI pipeline
