// File: backend/src/services/cron.js
// Runs the reminder job every day at 6 PM India time.
const cron = require('node-cron');
const { sendTomorrowReminders } = require('./notificationService');

function startCronJobs(io) {
  // "0 18 * * *" = minute 0, hour 18, every day
  cron.schedule('0 18 * * *', () => {
    sendTomorrowReminders(io).catch(console.error);
  }, { timezone: 'Asia/Kolkata' });
  console.log('Reminder job scheduled: daily at 6 PM IST');
}

module.exports = { startCronJobs };