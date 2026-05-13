const express = require('express');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 8000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'study_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && req.path.endsWith('.php')) {
    req.url = req.url.replace(/\.php(?=$|[?])/, '');
  }
  next();
});
app.use(express.static(path.join(__dirname)));

async function comparePasswords(candidate, stored) {
  if (!stored) return false;
  if (candidate === stored) return true;
  try {
    if (await bcrypt.compare(candidate, stored)) {
      return true;
    }
  } catch {
    // continue to legacy fallback
  }
  if (typeof stored === 'string' && stored.startsWith('$2y$')) {
    try {
      return await bcrypt.compare(candidate, stored.replace(/^\$2y\$/, '$2a$'));
    } catch {
      return false;
    }
  }
  return false;
}

async function ensureAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPass = process.env.ADMIN_PASS || 'admin123';
    const passwordHash = await bcrypt.hash(adminPass, 10);

    const [matching] = await pool.query(
      'SELECT id, email, password FROM users WHERE role = ? AND email = ?',
      ['admin', adminEmail],
    );
    if (matching.length > 0) {
      const admin = matching[0];
      if (!(await comparePasswords(adminPass, admin.password))) {
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, admin.id]);
        console.log('Default admin password reset.');
      }

      const [otherAdmins] = await pool.query(
        'SELECT id, email, password FROM users WHERE role = ? AND email != ?',
        ['admin', adminEmail],
      );
      for (const otherAdmin of otherAdmins) {
        if (!(await comparePasswords(adminPass, otherAdmin.password))) {
          await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, otherAdmin.id]);
          console.log(`Reset password for secondary admin ${otherAdmin.email}.`);
        }
      }
      return;
    }

    const [admins] = await pool.query('SELECT id, email, password FROM users WHERE role = ?', ['admin']);
    if (admins.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Admin User', adminEmail, passwordHash, 'admin'],
      );
      console.log('Default admin user created.');
      return;
    }

    const admin = admins[0];
    if (!(await comparePasswords(adminPass, admin.password))) {
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, admin.id]);
      console.log('Default admin password reset on existing account.');
    }
    if (admin.email !== adminEmail) {
      const [emailTaken] = await pool.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
      if (emailTaken.length === 0) {
        await pool.query('UPDATE users SET email = ? WHERE id = ?', [adminEmail, admin.id]);
        console.log('Default admin email updated.');
      } else {
        console.log('Desired admin email already exists on another account; leaving existing admin email unchanged.');
      }
    }
  } catch (error) {
    console.error('Failed to ensure admin user:', error);
  }
}

async function ensureDefaultUser() {
  try {
    const defaultEmail = process.env.DEFAULT_USER_EMAIL || 'user@example.com';
    const defaultPass = process.env.DEFAULT_USER_PASS || 'password';
    const [rows] = await pool.query('SELECT id, password FROM users WHERE email = ? AND role = ?', [defaultEmail, 'user']);
    const passwordHash = await bcrypt.hash(defaultPass, 10);

    if (rows.length === 0) {
      await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        ['Student User', defaultEmail, passwordHash, 'user'],
      );
      console.log('Default user account created.');
      return;
    }

    if (!(await comparePasswords(defaultPass, rows[0].password))) {
      await pool.query('UPDATE users SET password = ? WHERE id = ?', [passwordHash, rows[0].id]);
      console.log('Default user password reset.');
    }
  } catch (error) {
    console.error('Failed to ensure default user:', error);
  }
}

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'A user with that email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'user'],
    );

    const user = { id: result.insertId, name, email, role: 'user' };
    return res.status(201).json({ user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error creating user.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password, and role are required.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, password, role FROM users WHERE (email = ? OR name = ?) AND role = ?',
      [email, email, role],
    );
    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const user = rows[0];
    const passwordMatch = await comparePasswords(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error logging in.' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC');
    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error loading users.' });
  }
});

app.get('/api/subjects', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: 'Missing user_id.' });
  try {
    const [subjects] = await pool.query('SELECT * FROM subjects WHERE user_id = ?', [user_id]);
    return res.json({ subjects });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error loading subjects.' });
  }
});

app.get('/api/sessions', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: 'Missing user_id.' });
  try {
    const [sessions] = await pool.query(
      `SELECT s.*, sub.name AS subject_name
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.user_id = ?
       ORDER BY s.session_date DESC`,
      [user_id],
    );
    return res.json({ sessions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error loading sessions.' });
  }
});

app.get('/api/goals', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: 'Missing user_id.' });
  try {
    const [goals] = await pool.query('SELECT * FROM goals WHERE user_id = ?', [user_id]);
    return res.json({ goals });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error loading goals.' });
  }
});

app.get('/api/notes', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ message: 'Missing user_id.' });
  try {
    const [notes] = await pool.query(
      `SELECT n.*, sub.name AS subject_name
       FROM study_notes n
       JOIN subjects sub ON sub.id = n.subject_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC`,
      [user_id],
    );
    return res.json({ notes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error loading notes.' });
  }
});

app.post('/api/sessions', async (req, res) => {
  const { user_id, subject_id, duration, notes, session_date } = req.body;
  if (!user_id || !subject_id || !duration || !session_date) {
    return res.status(400).json({ message: 'Missing required session fields.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO sessions (user_id, subject_id, duration, notes, session_date) VALUES (?, ?, ?, ?, ?)',
      [user_id, subject_id, duration, notes || null, session_date],
    );
    const [rows] = await pool.query(
      `SELECT s.*, sub.name AS subject_name
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.id = ?`,
      [result.insertId],
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error saving session.' });
  }
});

app.put('/api/sessions', async (req, res) => {
  const { id, subject_id, duration, notes, session_date } = req.body;
  if (!id || !subject_id || !duration || !session_date) {
    return res.status(400).json({ message: 'Missing required session fields.' });
  }
  try {
    await pool.query(
      'UPDATE sessions SET subject_id = ?, duration = ?, notes = ?, session_date = ? WHERE id = ?',
      [subject_id, duration, notes || null, session_date, id],
    );
    const [rows] = await pool.query(
      `SELECT s.*, sub.name AS subject_name
       FROM sessions s
       JOIN subjects sub ON sub.id = s.subject_id
       WHERE s.id = ?`,
      [id],
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating session.' });
  }
});

app.delete('/api/sessions', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'Missing session id.' });
  try {
    await pool.query('DELETE FROM sessions WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting session.' });
  }
});

app.post('/api/goals', async (req, res) => {
  const { user_id, subject_id, type, target, current, deadline } = req.body;
  if (!user_id || !type || !target || !deadline) {
    return res.status(400).json({ message: 'Missing required goal fields.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO goals (user_id, subject_id, type, target, current, deadline) VALUES (?, ?, ?, ?, ?, ?)',
      [user_id, subject_id || null, type, target, current || 0, deadline],
    );
    const [rows] = await pool.query('SELECT * FROM goals WHERE id = ?', [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error saving goal.' });
  }
});

app.put('/api/goals', async (req, res) => {
  const { id, subject_id, type, target, current, deadline } = req.body;
  if (!id || !type || !target || !deadline) {
    return res.status(400).json({ message: 'Missing required goal fields.' });
  }
  try {
    await pool.query(
      'UPDATE goals SET subject_id = ?, type = ?, target = ?, current = ?, deadline = ? WHERE id = ?',
      [subject_id || null, type, target, current || 0, deadline, id],
    );
    const [rows] = await pool.query('SELECT * FROM goals WHERE id = ?', [id]);
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating goal.' });
  }
});

app.delete('/api/goals', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'Missing goal id.' });
  try {
    await pool.query('DELETE FROM goals WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting goal.' });
  }
});

app.post('/api/subjects', async (req, res) => {
  const { user_id, name, category, icon, monthly_goal } = req.body;
  if (!user_id || !name) {
    return res.status(400).json({ message: 'Missing required subject fields.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO subjects (user_id, name, category, icon, monthly_goal) VALUES (?, ?, ?, ?, ?)',
      [user_id, name, category || 'General', icon || '📚', monthly_goal || 15],
    );
    const [rows] = await pool.query('SELECT * FROM subjects WHERE id = ?', [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error saving subject.' });
  }
});

app.put('/api/subjects', async (req, res) => {
  const { id, name, category, icon, monthly_goal, total_time } = req.body;
  if (!id || !name) {
    return res.status(400).json({ message: 'Missing required subject fields.' });
  }
  try {
    await pool.query(
      'UPDATE subjects SET name = ?, category = ?, icon = ?, monthly_goal = ?, total_time = ? WHERE id = ?',
      [name, category || 'General', icon || '📚', monthly_goal || 15, total_time || 0, id],
    );
    const [rows] = await pool.query('SELECT * FROM subjects WHERE id = ?', [id]);
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating subject.' });
  }
});

app.delete('/api/subjects', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'Missing subject id.' });
  try {
    await pool.query('DELETE FROM subjects WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting subject.' });
  }
});

app.post('/api/notes', async (req, res) => {
  const { user_id, subject_id, title, content, priority } = req.body;
  if (!user_id || !subject_id || !title || !content) {
    return res.status(400).json({ message: 'Missing required note fields.' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO study_notes (user_id, subject_id, title, content, priority) VALUES (?, ?, ?, ?, ?)',
      [user_id, subject_id, title, content, priority || 'medium'],
    );
    const [rows] = await pool.query(
      `SELECT n.*, sub.name AS subject_name
       FROM study_notes n
       JOIN subjects sub ON sub.id = n.subject_id
       WHERE n.id = ?`,
      [result.insertId],
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error saving note.' });
  }
});

app.put('/api/notes', async (req, res) => {
  const { id, subject_id, title, content, priority, is_archived } = req.body;
  if (!id || !title || !content) {
    return res.status(400).json({ message: 'Missing required note fields.' });
  }
  try {
    await pool.query(
      'UPDATE study_notes SET subject_id = ?, title = ?, content = ?, priority = ?, is_archived = ? WHERE id = ?',
      [subject_id || null, title, content, priority || 'medium', is_archived ? 1 : 0, id],
    );
    const [rows] = await pool.query(
      `SELECT n.*, sub.name AS subject_name
       FROM study_notes n
       JOIN subjects sub ON sub.id = n.subject_id
       WHERE n.id = ?`,
      [id],
    );
    return res.json(rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error updating note.' });
  }
});

app.delete('/api/notes', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'Missing note id.' });
  try {
    await pool.query('DELETE FROM study_notes WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting note.' });
  }
});

app.delete('/api/users', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ message: 'Missing user id.' });
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Error deleting user.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

async function startServer() {
  await ensureAdmin();
  await ensureDefaultUser();
  app.listen(PORT, () => {
    console.log(`Study Tracker backend running at http://127.0.0.1:${PORT}`);
  });
}

startServer();
