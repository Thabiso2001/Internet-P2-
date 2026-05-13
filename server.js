// ============================================
// MUT ICT DEPARTMENT - COMPLETE SECURE SERVER
// With Authentication, Chatbot Persona, Image Upload
// PUT, DELETE Routes, Logging & Error Handling Middleware
// ============================================

const express = require('express');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, validationResult } = require('express-validator');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const mysql = require('mysql2');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// Initialize Express app
const app = express();
const PORT = 3000;

// ========== FILE UPLOAD SETUP ==========
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        cb(null, true);
    } else {
        cb(new Error('Only images and PDF files are allowed'));
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: fileFilter
});

// ========== XAMPP MYSQL DATABASE CONNECTION ==========
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'mut_ict_db',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error('\n❌ MySQL ERROR:', err.message);
        console.log('\n💡 TROUBLESHOOTING:');
        console.log('   1. Open XAMPP Control Panel');
        console.log('   2. Click "Start" next to MySQL');
        console.log('   3. Make sure it shows "Running" in green\n');
        process.exit(1);
    } else {
        console.log('\n✅ Connected to XAMPP MySQL!');
        console.log('   Database: mut_ict_db');
        console.log('   Host: localhost:3306\n');
    }
});

// ========== HELPER FUNCTION ==========
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err);
            else resolve(results);
        });
    });
}

// ========== LOGGING MIDDLEWARE ==========
app.use((req, res, next) => {
    const start = Date.now();
    const method = req.method;
    const url = req.url;
    const timestamp = new Date().toISOString();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const status = res.statusCode;
        console.log(`[${timestamp}] ${method} ${url} - ${status} - ${duration}ms`);
    });
    next();
});

app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        const sanitizedBody = { ...req.body };
        if (sanitizedBody.password) sanitizedBody.password = '******';
        if (sanitizedBody.password_hash) sanitizedBody.password_hash = '******';
        console.log(`📦 Body:`, sanitizedBody);
    }
    next();
});

// ========== SECURITY MIDDLEWARE ==========
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https://images.pexels.com", "https://www.mut.ac.za"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
        },
    },
}));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Session
app.use(session({
    secret: 'mut_ict_secret_2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: { success: false, message: 'Too many requests. Try again later.' },
});

// ========== AUTHENTICATION FUNCTIONS ==========
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

async function createUser(username, email, password, fullName, role = 'visitor') {
    const passwordHash = await hashPassword(password);
    const sql = 'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)';
    const result = await query(sql, [username, email, passwordHash, fullName, role]);
    return { id: result.insertId };
}

async function findUser(emailOrUsername) {
    const sql = 'SELECT * FROM users WHERE email = ? OR username = ?';
    const results = await query(sql, [emailOrUsername, emailOrUsername]);
    return results[0];
}

async function updateLastLogin(userId) {
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
}

// ========== DATABASE FUNCTIONS ==========
async function saveChatMessage(sessionId, userMessage, botReply) {
    const sql = 'INSERT INTO chatbot_conversations (session_id, user_message, bot_reply) VALUES (?, ?, ?)';
    const result = await query(sql, [sessionId, userMessage, botReply]);
    return { id: result.insertId };
}

async function saveUserApplication(data) {
    const sql = `INSERT INTO user_applications (
        title, full_name, surname, date_of_birth, id_number, gender, 
        email, phone, highest_qualification, school_name, programme_name, study_mode,
        uploaded_file_url, uploaded_id_file_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const result = await query(sql, [
        data.title || '', data.full_name || '', data.surname || '',
        data.date_of_birth || '', data.id_number || '', data.gender || '',
        data.email || '', data.phone || '', data.highest_qualification || '',
        data.school_name || '', data.programme_name || '', data.study_mode || '',
        data.uploadedFileUrl || '', data.uploadedIdFileUrl || ''
    ]);
    return { id: result.insertId };
}

async function subscribeNewsletter(email) {
    try {
        const result = await query('INSERT INTO newsletter_subscribers (email) VALUES (?)', [email]);
        return { id: result.insertId };
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') throw new Error('Email already subscribed');
        throw err;
    }
}

async function saveFeedback(userRole, rating, feedback) {
    const sql = 'INSERT INTO user_feedback (user_role, rating, feedback) VALUES (?, ?, ?)';
    const result = await query(sql, [userRole, rating, feedback]);
    return { id: result.insertId };
}

async function saveEnquiry(name, email, subject, message) {
    const sql = 'INSERT INTO enquiries (name, email, subject, message) VALUES (?, ?, ?, ?)';
    const result = await query(sql, [name, email, subject, message]);
    return { id: result.insertId };
}

// ========== MIDDLEWARE ==========
function requireLogin(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.status(401).json({ success: false, message: 'Please login first', requiresLogin: true });
    }
}

function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: 'Unauthorized. Admin access required.' });
    }
}

// ========== STATIC DATA ==========
const programmes = [
    { id: 1, name: "Diploma in Information Technology", duration: "3 years" },
    { id: 2, name: "Diploma in Information Technology (ECP)", duration: "4 years" },
    { id: 3, name: "Diploma in Networking", duration: "3 years" },
    { id: 4, name: "Advanced Diploma in Applications Development", duration: "1 year" },
    { id: 5, name: "Short Course: Cybersecurity", duration: "3 months" }
];

const staff = [
    { name: "Prof. N. Dlamini", role: "Head of Department", email: "dlamini.n@mut.ac.za", office: "ICT Building, Room 101", phone: "031-907-7401" },
    { name: "Dr. S. Naidoo", role: "Senior Lecturer", email: "naidoo.s@mut.ac.za", office: "ICT Building, Room 205", phone: "031-907-7402" },
    { name: "Mr. T. Khumalo", role: "Networking Coordinator", email: "khumalo.t@mut.ac.za", office: "Lab 3", phone: "031-907-7403" }
];

const chatbotPersona = {
    name: "Owami",
    role: "MUT ICT Student Advisor",
    greeting: "👋 Sawubona! I'm Owami, your MUT ICT Student Advisor. How can I help you with your application today?"
};

// ========== API ENDPOINTS ==========

app.get('/api/search', (req, res) => {
    const q = req.query.q?.toLowerCase() || '';
    const results = programmes.filter(p => p.name.toLowerCase().includes(q));
    res.json(results);
});

app.get('/api/chat', async (req, res) => {
    const msg = req.query.message?.toLowerCase() || '';
    const sessionId = req.query.session_id || 'anonymous';
    
    let reply = "";
    
    if (msg.match(/^(hi|hello|hey|howzit|sawubona)/)) {
        reply = chatbotPersona.greeting + "\n\nWhat would you like to know about? I can tell you about:\n• Our programmes\n• Application process\n• Requirements\n• Fees & funding\n• Deadlines\n• Documents needed";
    }
    else if (msg.includes("apply") || msg.includes("application")) {
        reply = "📝 How to Apply to MUT ICT:\n\n1️⃣ Create an account - Click 'Sign Up'\n2️⃣ Login with your email and password\n3️⃣ Click 'Apply Now'\n4️⃣ Complete the application form\n5️⃣ Upload your documents\n6️⃣ Submit your application\n\n💡 Tip: Make sure you have your ID and matric results ready!";
    }
    else if (msg.includes("programme") || msg.includes("course")) {
        reply = "🎓 Programmes at MUT ICT:\n\n• Diploma in Information Technology (3 years)\n• Diploma in IT - Extended (ECP) (4 years)\n• Advanced Diploma in Applications Development (1 year)\n• Short Courses: Cybersecurity, Cloud Computing, Data Science (3 months)\n\nWhich programme interests you?";
    }
    else if (msg.includes("requirement") || msg.includes("matric")) {
        reply = "📋 Entry Requirements for Diploma in IT:\n\n✅ Matric with Diploma or higher\n✅ English: Level 4 (50-59%) or higher\n✅ Mathematics: Level 4 OR Maths Literacy: Level 5\n✅ Minimum APS: 24 points\n\n⚠️ Meeting minimum requirements does NOT guarantee admission.";
    }
    else if (msg.includes("fee") || msg.includes("cost") || msg.includes("nsfas")) {
        reply = "💰 Fees & Funding:\n\n• Diploma in IT: R18,000 - R22,000 per year\n• Advanced Diploma: R15,000 - R18,000\n• Short Courses: R3,500 - R5,000\n\n🏦 Financial Aid: NSFAS, MUT Bursary Programme\n📅 Deadline: 30 November";
    }
    else if (msg.includes("deadline") || msg.includes("closing")) {
        reply = "📅 Important Dates for 2025:\n\n• Applications Open: 1 April 2025\n• Applications Close: 30 November 2025\n• NSFAS Deadline: 30 November 2025\n• Registration: January 2026\n\n⏰ Don't wait - apply early!";
    }
    else if (msg.includes("help") || msg.includes("what can you do")) {
        reply = "🤖 I can help you with:\n\n📚 Programmes - What courses we offer\n📝 Application - How to apply step by step\n📋 Requirements - Entry requirements\n💰 Fees - Tuition costs and funding\n📅 Deadlines - Important dates\n📄 Documents - What you need to upload\n📍 Contact - How to reach us\n\nWhat would you like to know?";
    }
    else {
        reply = "🤔 I'm Owami, your MUT ICT Advisor. I'm not sure I understood that.\n\n💡 Try asking me:\n• 'How do I apply to MUT?'\n• 'What programmes do you offer?'\n• 'What are the entry requirements?'\n• 'How much are the fees?'\n• 'When is the deadline?'\n\nType 'help' to see everything I can do!";
    }
    
    await saveChatMessage(sessionId, msg, reply);
    res.json({ answer: reply, persona: chatbotPersona.name });
});

app.get('/api/user', (req, res) => {
    const role = req.query.role || "visitor";
    const data = {
        visitor: { title: "Welcome to MUT ICT", greeting: "Login to apply", quickLinks: ["🔐 Login", "📝 Sign Up", "📚 Programmes"], showApply: false },
        student: { title: "Student Dashboard", greeting: "Welcome back!", quickLinks: ["📖 Notices", "📥 Downloads", "📅 Timetable"], showApply: false },
        lecturer: { title: "Lecturer Dashboard", greeting: "Faculty portal", quickLinks: ["📤 Upload Notes", "👥 Student Lists", "📝 Marks"], showApply: false }
    };
    res.json(data[role] || data.visitor);
});

app.get('/api/news', async (req, res) => {
    try {
        const response = await axios.get('https://gnews.io/api/v4/search?q=IT%20education%20south%20africa&lang=en&country=za&max=5');
        const articles = response.data.articles.map(article => ({
            title: article.title,
            description: article.description,
            url: article.url,
            publishedAt: article.publishedAt
        }));
        res.json(articles);
    } catch (error) {
        res.json([
            { title: "MUT ICT Applications Open for 2027", description: "Apply now for the Diploma in IT", url: "#", publishedAt: new Date().toISOString() }
        ]);
    }
});

app.get('/api/recommend', (req, res) => {
    const interest = req.query.interest?.toLowerCase() || "";
    const recs = {
        networking: ["CCNA Certification", "Network Security Workshop", "Cloud Computing Basics"],
        programming: ["JavaScript Bootcamp", "Python for Data Science", "Game Development 101"],
        cybersecurity: ["Ethical Hacking 101", "Security+ Prep", "CTF Competition"]
    };
    res.json(recs[interest] || ["Login to start your application"]);
});

app.get('/api/staff', (req, res) => {
    res.json(staff);
});

// ========== AUTHENTICATION API ==========

app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

app.get('/api/check-apply-access', requireLogin, (req, res) => {
    res.json({ success: true, message: 'Access granted' });
});

app.post('/api/register', [
    body('username').trim().isLength({ min: 3 }),
    body('email').isEmail(),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    
    try {
        const existing = await findUser(req.body.email);
        if (existing) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        await createUser(req.body.username, req.body.email, req.body.password, req.body.fullName, req.body.role);
        res.json({ success: true, message: 'Registration successful! Please login.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const user = await findUser(email);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }
        
        await updateLastLogin(user.id);
        
        req.session.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            role: user.role
        };
        
        console.log(`✅ Login successful: ${email} (${user.role})`);
        
        res.json({ 
            success: true, 
            message: 'Login successful!', 
            user: req.session.user,
            redirectTo: user.role === 'admin' ? '/admin' : null
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// ========== FIXED LOGOUT ENDPOINT ==========
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        console.log('✅ User logged out successfully');
        res.json({ success: true, message: 'Logged out' });
    });
});

// ========== IMAGE UPLOAD ==========
app.post('/api/upload-document', requireLogin, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        const file = req.file;
        const fileType = path.extname(file.filename).toLowerCase();
        let processedFilePath = file.path;
        
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(fileType)) {
            const outputPath = path.join(uploadDir, 'optimized-' + file.filename);
            await sharp(file.path).resize(800, 800, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(outputPath);
            fs.unlinkSync(file.path);
            processedFilePath = outputPath;
        }
        
        const fileUrl = '/uploads/' + path.basename(processedFilePath);
        
        res.json({ 
            success: true, 
            message: 'Document uploaded successfully!',
            fileUrl: fileUrl,
            fileName: file.originalname,
            fileSize: (file.size / 1024).toFixed(2) + ' KB'
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});

// ========== FORM SUBMISSIONS ==========

app.post('/api/save-application', requireLogin, async (req, res) => {
    try {
        const data = req.body;
        if (!data.email && req.session.user.email) data.email = req.session.user.email;
        const result = await saveUserApplication(data);
        res.json({ success: true, message: 'Application saved!', id: result.id });
    } catch (error) {
        console.error('Save application error:', error);
        res.status(500).json({ success: false, message: 'Error saving application' });
    }
});

app.post('/api/enquiry', limiter, async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        await saveEnquiry(name, email, subject || 'General', message);
        res.json({ success: true, message: 'Enquiry sent!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error sending enquiry' });
    }
});

app.post('/api/subscribe', limiter, async (req, res) => {
    try {
        await subscribeNewsletter(req.body.email);
        res.json({ success: true, message: 'Subscribed!' });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
});

app.post('/api/feedback', limiter, async (req, res) => {
    try {
        await saveFeedback(req.body.userRole || 'visitor', req.body.rating, req.body.feedback || '');
        res.json({ success: true, message: 'Thank you for your feedback!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error' });
    }
});

// ========== FIXED PUT ROUTES (EDIT) ==========
app.put('/api/application/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { application_status, admin_notes } = req.body;
        
        const result = await query(
            'UPDATE user_applications SET application_status = ?, admin_notes = ? WHERE id = ?',
            [application_status, admin_notes || '', id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        
        console.log(`✅ Application ${id} updated to ${application_status}`);
        res.json({ success: true, message: 'Application updated successfully' });
    } catch (error) {
        console.error('PUT error:', error);
        res.status(500).json({ success: false, message: 'Error updating application' });
    }
});

app.put('/api/user/profile', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { full_name, phone } = req.body;
        
        await query('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [full_name, phone, userId]);
        req.session.user.fullName = full_name;
        
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
});

// ========== FIXED DELETE ROUTES ==========
app.delete('/api/application/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM user_applications WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        
        console.log(`✅ Application ${id} deleted successfully`);
        res.json({ success: true, message: 'Application deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting application' });
    }
});

app.delete('/api/enquiry/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM enquiries WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Enquiry not found' });
        }
        
        console.log(`✅ Enquiry ${id} deleted successfully`);
        res.json({ success: true, message: 'Enquiry deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting enquiry' });
    }
});

app.delete('/api/subscriber/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM newsletter_subscribers WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Subscriber not found' });
        }
        
        console.log(`✅ Subscriber ${id} deleted successfully`);
        res.json({ success: true, message: 'Subscriber deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting subscriber' });
    }
});

app.delete('/api/feedback/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM user_feedback WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Feedback not found' });
        }
        
        console.log(`✅ Feedback ${id} deleted successfully`);
        res.json({ success: true, message: 'Feedback deleted successfully' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ success: false, message: 'Error deleting feedback' });
    }
});

app.get('/api/application/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const app = await query('SELECT * FROM user_applications WHERE id = ?', [id]);
        if (app.length === 0) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        res.json({ success: true, application: app[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching application' });
    }
});

// ========== ADMIN DATA ENDPOINT ==========
app.get('/api/admin/data', requireAdmin, async (req, res) => {
    try {
        const users = await query("SELECT id, username, email, full_name, phone, role, created_at, last_login FROM users ORDER BY created_at DESC");
        const applications = await query("SELECT * FROM user_applications ORDER BY submitted_at DESC");
        const enquiries = await query("SELECT * FROM enquiries ORDER BY created_at DESC");
        const subscribers = await query("SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC");
        const feedback = await query("SELECT * FROM user_feedback ORDER BY created_at DESC");
        const chats = await query("SELECT * FROM chatbot_conversations ORDER BY created_at DESC LIMIT 50");
        
        console.log(`📊 Admin data: ${applications.length} apps, ${enquiries.length} enquiries, ${subscribers.length} subscribers, ${feedback.length} feedback, ${chats.length} chats`);
        
        res.json({ success: true, users, applications, enquiries, subscribers, feedback, chats });
    } catch (error) {
        console.error('Admin data error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ========== SERVE HTML PAGES (FIXED) ==========
const serveHtmlFile = (res, fileName, pageName) => {
    const filePath = path.join(__dirname, 'public', fileName);
    console.log(`📄 Serving: ${fileName}`);
    
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error(`❌ Error serving ${fileName}:`, err.message);
                res.status(500).send(`Error loading ${pageName}`);
            } else {
                console.log(`✅ Served: ${fileName}`);
            }
        });
    } else {
        console.log(`❌ File not found: ${filePath}`);
        res.status(404).send(`${pageName}.html not found. Please make sure the file exists.`);
    }
};

app.get('/', (req, res) => serveHtmlFile(res, 'index.html', 'Home'));
app.get('/about', (req, res) => serveHtmlFile(res, 'about.html', 'About'));
app.get('/programmes', (req, res) => serveHtmlFile(res, 'programmes.html', 'Programmes'));
app.get('/staff', (req, res) => serveHtmlFile(res, 'staff.html', 'Staff'));
app.get('/news-page', (req, res) => serveHtmlFile(res, 'news.html', 'News'));
app.get('/contact', (req, res) => serveHtmlFile(res, 'contact.html', 'Contact'));
app.get('/admin', (req, res) => serveHtmlFile(res, 'admin.html', 'Admin'));

// ========== ERROR HANDLING MIDDLEWARE ==========
app.use((req, res) => {
    console.log(`❌ 404 - ${req.method} ${req.url} not found`);
    res.status(404).json({ 
        success: false, 
        message: `Route ${req.method} ${req.url} not found`,
        timestamp: new Date().toISOString()
    });
});

app.use((err, req, res, next) => {
    console.error('🔥 Global error handler:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
    });
});

// ========== START SERVER ==========
app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║     🎓 MUT ICT DEPARTMENT - SECURE SERVER RUNNING            ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║     🌐 http://localhost:${PORT}                                              ║`);
    console.log(`║     📊 http://localhost:${PORT}/admin                                      ║`);
    console.log('║     🗄️  Database: XAMPP MySQL (mut_ict_db)                      ║');
    console.log('║     🤖 Chatbot: Owami (MUT ICT Advisor)                          ║');
    console.log('║     📎 Image Upload: Enabled                                    ║');
    console.log('║     🔐 Login required to apply                                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
});