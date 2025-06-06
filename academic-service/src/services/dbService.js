const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  user: process.env.DB_USER_ACADEMIC || 'academic_user',
  host: process.env.DB_HOST_ACADEMIC || 'postgres-academic-service',
  database: process.env.DB_NAME_ACADEMIC || 'academic_db',
  password: process.env.DB_PASSWORD_ACADEMIC || 'password',
  port: process.env.DB_PORT_ACADEMIC || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client (Academic DB)', err);
  process.exit(1);
});

exports.connect = async () => {
  try {
    await pool.query('SELECT NOW()');
    logger.info('PostgreSQL Academic DB connected successfully.');
    
    // Execute DDLs to create tables if not exists
    const createTablesDDL = `
      -- Tabel Lecturers
      CREATE TABLE IF NOT EXISTS lecturers (
          lecturer_id UUID PRIMARY KEY,
          nidn VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabel Courses
      CREATE TABLE IF NOT EXISTS courses (
          course_id UUID PRIMARY KEY,
          course_code VARCHAR(20) UNIQUE NOT NULL,
          course_name VARCHAR(100) NOT NULL,
          sks INTEGER NOT NULL,
          lecturer_id UUID NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_lecturer
              FOREIGN KEY(lecturer_id)
              REFERENCES lecturers(lecturer_id)
              ON DELETE RESTRICT
      );

      -- Tabel Classes
      CREATE TABLE IF NOT EXISTS classes (
          class_id UUID PRIMARY KEY,
          semester_name VARCHAR(50) NOT NULL,
          major VARCHAR(100) NOT NULL,
          group_name VARCHAR(10) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(semester_name, major, group_name)
      );

      -- Tabel Class_Courses (Mata Kuliah di Kelas & Jadwal)
      CREATE TABLE IF NOT EXISTS class_courses (
          class_course_id UUID PRIMARY KEY,
          class_id UUID NOT NULL,
          course_id UUID NOT NULL,
          day_of_week INTEGER NOT NULL,
          start_time TIME NOT NULL,
          end_time TIME NOT NULL,
          room VARCHAR(50),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_class
              FOREIGN KEY(class_id)
              REFERENCES classes(class_id)
              ON DELETE CASCADE,
          CONSTRAINT fk_course
              FOREIGN KEY(course_id)
              REFERENCES courses(course_id)
              ON DELETE CASCADE,
          UNIQUE(class_id, course_id),
          UNIQUE(class_id, day_of_week, start_time)
      );

      -- Tabel Students_Local_Copy (Salinan data mahasiswa dari Mahasiswa API)
      CREATE TABLE IF NOT EXISTS students_local_copy (
          student_id UUID PRIMARY KEY,
          nim VARCHAR(20) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          major VARCHAR(100) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Tabel Attendance_Sessions (Sesi Presensi)
      CREATE TABLE IF NOT EXISTS attendance_sessions (
          session_id UUID PRIMARY KEY,
          class_course_id UUID NOT NULL,
          session_date DATE NOT NULL,
          start_time TIMESTAMP WITH TIME ZONE NOT NULL,
          end_time TIMESTAMP WITH TIME ZONE,
          is_open BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_class_course
              FOREIGN KEY(class_course_id)
              REFERENCES class_courses(class_course_id)
              ON DELETE RESTRICT,
          UNIQUE(class_course_id, session_date)
      );

      -- Tabel Attendances (Presensi Mahasiswa)
      CREATE TABLE IF NOT EXISTS attendances (
          attendance_id UUID PRIMARY KEY,
          session_id UUID NOT NULL,
          student_id UUID NOT NULL,
          status VARCHAR(20) NOT NULL, -- 'Hadir', 'Alfa', 'Izin', 'Sakit'
          attendance_time TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_session
              FOREIGN KEY(session_id)
              REFERENCES attendance_sessions(session_id)
              ON DELETE CASCADE,
          CONSTRAINT fk_student
              FOREIGN KEY(student_id)
              REFERENCES students_local_copy(student_id)
              ON DELETE RESTRICT,
          UNIQUE(session_id, student_id)
      );
    `;
    await pool.query(createTablesDDL);
    logger.info('Academic DB tables checked/created.');
  } catch (err) {
    logger.error('Failed to connect to Academic DB or create tables:', err.message);
    throw err;
  }
};

exports.query = (text, params) => pool.query(text, params);

exports.disconnect = async () => {
  await pool.end();
  logger.info('PostgreSQL Academic DB pool has ended.');
};