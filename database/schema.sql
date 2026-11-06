-- =====================================================
-- Hospital Queue Management System (HQMS)
-- File: database/schema.sql
-- =====================================================

DROP TABLE IF EXISTS notifications     CASCADE;
DROP TABLE IF EXISTS prescriptions     CASCADE;
DROP TABLE IF EXISTS queue_tokens      CASCADE;
DROP TABLE IF EXISTS appointments      CASCADE;
DROP TABLE IF EXISTS doctor_leaves     CASCADE;
DROP TABLE IF EXISTS doctor_schedules  CASCADE;
DROP TABLE IF EXISTS doctors           CASCADE;
DROP TABLE IF EXISTS departments       CASCADE;
DROP TABLE IF EXISTS users             CASCADE;

CREATE TABLE users (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    email          VARCHAR(150) NOT NULL UNIQUE,
    phone          VARCHAR(20),
    password_hash  VARCHAR(255) NOT NULL,
    role           VARCHAR(20) NOT NULL DEFAULT 'patient'
                   CHECK (role IN ('patient', 'doctor', 'admin', 'receptionist')),
    fcm_token      TEXT,
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE departments (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL UNIQUE,
    description  TEXT
);

CREATE TABLE doctors (
    id                   SERIAL PRIMARY KEY,
    user_id              INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    department_id        INT NOT NULL REFERENCES departments(id),
    specialization       VARCHAR(100),
    qualification        VARCHAR(150),
    experience_years     INT DEFAULT 0,
    consultation_fee     NUMERIC(8,2) DEFAULT 0,
    avg_consult_minutes  INT NOT NULL DEFAULT 10,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE doctor_schedules (
    id            SERIAL PRIMARY KEY,
    doctor_id     INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    slot_minutes  INT NOT NULL DEFAULT 10,
    is_available  BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_time > start_time),
    UNIQUE (doctor_id, day_of_week, start_time)
);

CREATE TABLE doctor_leaves (
    id          SERIAL PRIMARY KEY,
    doctor_id   INT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    leave_date  DATE NOT NULL,
    reason      VARCHAR(255),
    UNIQUE (doctor_id, leave_date)
);

CREATE TABLE appointments (
    id                SERIAL PRIMARY KEY,
    patient_id        INT REFERENCES users(id) ON DELETE SET NULL,
    walk_in_name      VARCHAR(100),
    walk_in_phone     VARCHAR(20),
    doctor_id         INT NOT NULL REFERENCES doctors(id),
    appointment_date  DATE NOT NULL,
    slot_start        TIME,
    slot_end          TIME,
    type              VARCHAR(10) NOT NULL DEFAULT 'online'
                      CHECK (type IN ('online', 'walk_in')),
    status            VARCHAR(15) NOT NULL DEFAULT 'booked'
                      CHECK (status IN ('booked', 'in_progress', 'completed', 'cancelled', 'no_show')),
    reason            TEXT,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (patient_id IS NOT NULL OR walk_in_name IS NOT NULL)
);

-- Double-booking prevention
CREATE UNIQUE INDEX uniq_active_slot
    ON appointments (doctor_id, appointment_date, slot_start)
    WHERE status IN ('booked', 'in_progress', 'completed');

CREATE INDEX idx_appt_patient     ON appointments (patient_id);
CREATE INDEX idx_appt_doctor_date ON appointments (doctor_id, appointment_date);

CREATE TABLE queue_tokens (
    id              SERIAL PRIMARY KEY,
    appointment_id  INT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id       INT NOT NULL REFERENCES doctors(id),
    token_date      DATE NOT NULL,
    token_number    INT NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'called', 'completed', 'skipped', 'cancelled')),
    called_at       TIMESTAMP,
    completed_at    TIMESTAMP,
    UNIQUE (doctor_id, token_date, token_number)
);

CREATE TABLE prescriptions (
    id              SERIAL PRIMARY KEY,
    appointment_id  INT NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
    doctor_id       INT NOT NULL REFERENCES doctors(id),
    patient_id      INT NOT NULL REFERENCES users(id),
    diagnosis       TEXT,
    medicines       JSONB NOT NULL DEFAULT '[]',
    notes           TEXT,
    follow_up_date  DATE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_id  INT REFERENCES appointments(id) ON DELETE SET NULL,
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('reminder', 'turn_near', 'booking', 'cancellation', 'prescription')),
    title           VARCHAR(150) NOT NULL,
    message         TEXT NOT NULL,
    channel         VARCHAR(10) NOT NULL DEFAULT 'in_app'
                    CHECK (channel IN ('in_app', 'push', 'sms')),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user ON notifications (user_id, is_read);