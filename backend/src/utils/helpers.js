// File: backend/src/utils/helpers.js
// Date/time helpers. The hospital works in India time.
const TZ = 'Asia/Kolkata';

// Today's date as "YYYY-MM-DD" in India time
function todayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

// Minutes since midnight now (India time). Example: 2:30 PM = 870
function nowMinutes() {
  const t = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hourCycle: 'h23' });
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

// Add n days to a "YYYY-MM-DD" string
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = Sunday ... 6 = Saturday
function dayOfWeek(dateStr) {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

// "09:30" or "09:30:00" -> 570
function toMinutes(t) {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

// 570 -> "09:30"
function toTime(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

module.exports = { todayStr, nowMinutes, addDays, dayOfWeek, toMinutes, toTime };