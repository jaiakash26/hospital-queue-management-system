INSERT INTO departments (name, description) VALUES
('General Medicine', 'Common illnesses, fever and general check-ups'),
('Cardiology',       'Heart and blood pressure care'),
('Dermatology',      'Skin, hair and nail problems');

INSERT INTO users (name, email, phone, password_hash, role) VALUES
('Admin Kumar',       'admin@hqms.com',      '9000000001', 'PLACEHOLDER', 'admin'),
('Reception Priya',   'reception@hqms.com',  '9000000002', 'PLACEHOLDER', 'receptionist'),
('Dr. Arun Prakash',  'arun@hqms.com',       '9000000003', 'PLACEHOLDER', 'doctor'),
('Dr. Meena Lakshmi', 'meena@hqms.com',      '9000000004', 'PLACEHOLDER', 'doctor'),
('Dr. Suresh Babu',   'suresh@hqms.com',     '9000000005', 'PLACEHOLDER', 'doctor'),
('Karthik R',         'karthik@example.com', '9100000001', 'PLACEHOLDER', 'patient'),
('Divya S',           'divya@example.com',   '9100000002', 'PLACEHOLDER', 'patient'),
('Mohan V',           'mohan@example.com',   '9100000003', 'PLACEHOLDER', 'patient');

INSERT INTO doctors (user_id, department_id, specialization, qualification, experience_years, consultation_fee, avg_consult_minutes) VALUES
(3, 1, 'General Physician', 'MBBS, MD',   10, 300.00, 10),
(4, 2, 'Cardiologist',      'MBBS, DM',   15, 600.00, 15),
(5, 3, 'Dermatologist',     'MBBS, DDVL',  8, 400.00, 20);

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes)
SELECT 1, d, '09:00', '13:00', 10 FROM generate_series(1,5) AS d;
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes)
SELECT 2, d, '14:00', '17:00', 15 FROM generate_series(1,5) AS d;
INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time, slot_minutes) VALUES
(3, 1, '10:00', '14:00', 20),
(3, 3, '10:00', '14:00', 20),
(3, 5, '10:00', '14:00', 20);

INSERT INTO doctor_leaves (doctor_id, leave_date, reason) VALUES
(2, (date_trunc('week', CURRENT_DATE) + INTERVAL '8 days')::date, 'Medical conference');

INSERT INTO appointments (patient_id, walk_in_name, walk_in_phone, doctor_id, appointment_date, slot_start, slot_end, type, status, reason) VALUES
(6,    NULL,   NULL,         1, CURRENT_DATE, '09:00', '09:10', 'online',  'completed',   'Fever and cold'),
(7,    NULL,   NULL,         1, CURRENT_DATE, '09:10', '09:20', 'online',  'in_progress', 'Headache'),
(8,    NULL,   NULL,         1, CURRENT_DATE, '09:20', '09:30', 'online',  'booked',      'Body pain'),
(NULL, 'Ravi', '9200000001', 1, CURRENT_DATE, NULL,    NULL,    'walk_in', 'booked',      'Stomach ache');

INSERT INTO appointments (patient_id, doctor_id, appointment_date, slot_start, slot_end, type, status, reason) VALUES
(6, 2, CURRENT_DATE + 1, '14:00', '14:15', 'online', 'booked', 'Routine heart check-up');

INSERT INTO queue_tokens (appointment_id, doctor_id, token_date, token_number, status, called_at, completed_at) VALUES
(1, 1, CURRENT_DATE, 1, 'completed', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes'),
(2, 1, CURRENT_DATE, 2, 'called',    NOW() - INTERVAL '5 minutes',  NULL),
(3, 1, CURRENT_DATE, 3, 'waiting',   NULL, NULL),
(4, 1, CURRENT_DATE, 4, 'waiting',   NULL, NULL);

INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, diagnosis, medicines, notes, follow_up_date) VALUES
(1, 1, 6, 'Viral fever',
 '[{"name":"Paracetamol 500mg","dosage":"1 tablet","frequency":"3 times a day","days":3},
   {"name":"Cetirizine 10mg","dosage":"1 tablet","frequency":"at night","days":5}]',
 'Drink plenty of water and take rest.', CURRENT_DATE + 5);