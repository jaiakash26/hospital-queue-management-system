// File: backend/src/utils/slots.js
// Generates a doctor's slots for a date and marks which are free.
const { toMinutes, toTime, dayOfWeek, todayStr, nowMinutes } = require('./helpers');

// "db" can be the pool OR a transaction client (both have .query)
async function getSlots(db, doctorId, date) {
  // 1. Is the doctor on leave that day?
  const leave = await db.query(
    'SELECT 1 FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
    [doctorId, date]
  );
  if (leave.rowCount > 0) return { onLeave: true, slots: [] };

  // 2. Working hours for this weekday
  const schedule = await db.query(
    `SELECT start_time, end_time, slot_minutes FROM doctor_schedules
     WHERE doctor_id = $1 AND day_of_week = $2 AND is_available = TRUE
     ORDER BY start_time`,
    [doctorId, dayOfWeek(date)]
  );

  // 3. Slots already taken (cancelled / no_show slots are free again)
  const booked = await db.query(
    `SELECT slot_start FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2 AND slot_start IS NOT NULL
       AND status IN ('booked', 'in_progress', 'completed')`,
    [doctorId, date]
  );
  const bookedSet = new Set(booked.rows.map((r) => r.slot_start.slice(0, 5))); // "09:20:00" -> "09:20"

  const isToday = date === todayStr();
  const now = nowMinutes();

  // 4. Cut the working hours into slots
  const slots = [];
  for (const row of schedule.rows) {
    const end = toMinutes(row.end_time);
    for (let t = toMinutes(row.start_time); t + row.slot_minutes <= end; t += row.slot_minutes) {
      const start = toTime(t);
      slots.push({
        start,
        end: toTime(t + row.slot_minutes),
        // free only if not booked AND (not today OR still in the future)
        available: !bookedSet.has(start) && !(isToday && t <= now),
      });
    }
  }
  return { onLeave: false, slots };
}

module.exports = { getSlots };