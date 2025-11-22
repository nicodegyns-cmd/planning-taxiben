
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const SECRET = 'change_this_secret_to_a_strong_random_value';
const PORT = process.env.PORT || 3000;
const DB_FILE = './data.db';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize DB
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('SQLite DB opened.');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    password TEXT,
    role TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS agenda (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT,
    date TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS missions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT,
    dt TEXT,
    pickup TEXT,
    dropoff TEXT,
    assigned_to INTEGER,
    status TEXT
  )`);
  // Create default admin if not exists
  db.get("SELECT * FROM users WHERE name = 'admin'", (err, row) => {
    if (err) console.error(err);
    if (!row) {
      const pw = 'adminpass';
      bcrypt.hash(pw, 10).then(hash => {
        db.run("INSERT INTO users (name,password,role) VALUES (?,?,?)", ['admin', hash, 'admin']);
        console.log('Default admin created: admin / adminpass (change it!)');
      });
    }
  });
});

// Helpers
function authenticateToken(req, res, next){
  const auth = req.headers['authorization'];
  if(!auth) return res.status(401).json({error:'Missing token'});
  const token = auth.split(' ')[1];
  if(!token) return res.status(401).json({error:'Malformed token'});
  jwt.verify(token, SECRET, (err, user) => {
    if(err) return res.status(403).json({error:'Invalid token'});
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next){
  if(req.user && req.user.role === 'admin') return next();
  return res.status(403).json({error:'Admin only'});
}

// Auth
app.post('/api/login', (req,res) => {
  const { name, password } = req.body;
  if(!name || !password) return res.status(400).json({error:'Missing fields'});
  db.get("SELECT * FROM users WHERE name = ?", [name], (err, row) => {
    if(err) return res.status(500).json({error:err.message});
    if(!row) return res.status(401).json({error:'Invalid credentials'});
    bcrypt.compare(password, row.password).then(match => {
      if(!match) return res.status(401).json({error:'Invalid credentials'});
      const token = jwt.sign({ id: row.id, name: row.name, role: row.role }, SECRET, { expiresIn: '12h' });
      res.json({ token, user: { id: row.id, name: row.name, role: row.role } });
    });
  });
});

// Admin: create user
app.post('/api/users', authenticateToken, requireAdmin, (req,res) => {
  const { name, password, role } = req.body;
  if(!name || !password || !role) return res.status(400).json({error:'Missing fields'});
  bcrypt.hash(password, 10).then(hash => {
    db.run("INSERT INTO users (name,password,role) VALUES (?,?,?)", [name, hash, role], function(err){
      if(err) return res.status(500).json({error:err.message});
      res.json({ id: this.lastID, name, role });
    });
  });
});

// Admin: list users
app.get('/api/users', authenticateToken, requireAdmin, (req,res) => {
  db.all("SELECT id,name,role FROM users", [], (err, rows) => {
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});

// Agenda endpoints (authenticated)
app.get('/api/agenda', authenticateToken, (req,res) => {
  const uid = req.user.id;
  db.all("SELECT id,title,date FROM agenda WHERE user_id = ? ORDER BY date", [uid], (err, rows) => {
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});
app.post('/api/agenda', authenticateToken, (req,res) => {
  const uid = req.user.id;
  const { title, date } = req.body;
  if(!title || !date) return res.status(400).json({error:'Missing fields'});
  db.run("INSERT INTO agenda (user_id,title,date) VALUES (?,?,?)", [uid, title, date], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({ id: this.lastID, title, date });
  });
});

// Missions
app.get('/api/missions', authenticateToken, (req,res) => {
  db.all("SELECT m.*, u.name as assigned_name FROM missions m LEFT JOIN users u ON m.assigned_to = u.id ORDER BY dt", [], (err, rows) => {
    if(err) return res.status(500).json({error:err.message});
    res.json(rows);
  });
});
app.post('/api/missions', authenticateToken, requireAdmin, (req,res) => {
  const { client, dt, pickup, dropoff } = req.body;
  if(!client || !dt || !pickup || !dropoff) return res.status(400).json({error:'Missing fields'});
  db.run("INSERT INTO missions (client,dt,pickup,dropoff,status) VALUES (?,?,?,?,?)", [client, dt, pickup, dropoff, 'nouvelle'], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({ id: this.lastID, client, dt, pickup, dropoff, status: 'nouvelle' });
  });
});

// Assign mission to driver (admin)
app.post('/api/missions/:id/assign', authenticateToken, requireAdmin, (req,res) => {
  const mid = req.params.id;
  const { user_id } = req.body;
  if(!user_id) return res.status(400).json({error:'Missing user_id'});
  db.run("UPDATE missions SET assigned_to = ?, status = ? WHERE id = ?", [user_id, 'assignée', mid], function(err){
    if(err) return res.status(500).json({error:err.message});
    res.json({ success:true });
  });
});

// Serve index.html for any other route (SPA)
app.get('*', (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Server listening on port', PORT);
});
