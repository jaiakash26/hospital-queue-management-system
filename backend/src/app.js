// File: backend/src/app.js
// Builds the Express app: middleware + all routes.
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL })); // allow our React app to call us
app.use(express.json());                            // read JSON request bodies

// Quick check that the server is alive
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'Hospital Queue Management System' }));

// Each file handles one area of the project
app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));               // departments, doctors, slots
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/doctor', require('./routes/doctorPanel'));    // doctor's own schedule and leaves
app.use('/api/prescriptions', require('./routes/prescriptions'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

app.use(errorHandler); // must be LAST

module.exports = app;