# Hospital Queue Management System (HQMS)

A web application where patients book hospital appointments online, track
their live queue position, and get notified when their turn is near.

**Live demo:** https://hqms-frontend.vercel.app

## Problem
Patients wait for hours in hospital queues without knowing when their turn
will come, and hospital staff handle bookings manually on paper.

## Features
- **Patient:** register, search doctors by department, book / cancel / reschedule,
  live token number and estimated waiting time, view and download prescriptions (PDF)
- **Doctor:** today's appointment list, call next patient, mark consultation completed,
  add prescriptions, set availability and leave days
- **Admin / Receptionist:** manage doctors and departments, handle walk-ins,
  reports (daily patients, busiest hours, doctor workload)
- **Notifications:** alert when the patient's turn is 3 patients away, appointment reminders

## Tech Stack
React, Tailwind CSS, Node.js, Express, PostgreSQL (Neon), Socket.io, JWT, bcrypt, Twilio (optional SMS)

## Run locally
1. Create a PostgreSQL database and run `database/schema.sql`, then `database/seed.sql`
2. `cd backend`, copy your settings into `.env`, then `npm install`, `npm run set-passwords`, `npm run dev`
3. `cd frontend`, `npm install`, `npm run dev`
4. Open http://localhost:5173

## Environment variables (backend/.env)
`DATABASE_URL`, `DATABASE_SSL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_URL`

## Demo accounts
Patients: `karthik@example.com`, `divya@example.com`, `mohan@example.com` (password: `password123`)

## Key ideas
- Double-booking is prevented twice: the code checks the slot, and a unique database index rejects duplicates
- Estimated wait = patients ahead x average consultation time (it becomes the real average after 3 finished patients)
- Live updates use Socket.io rooms, one room per doctor