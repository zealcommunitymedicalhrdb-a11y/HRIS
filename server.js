require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const multer = require('multer');
const QRCode = require('qrcode');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const moment = require('moment');
const nodemailer = require('nodemailer');

// Serve static files from "admin" folder
app.use('/admin', express.static(path.join(__dirname, 'admin')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT"]
    }
});

app.use(cors({
    origin: '*', // or restrict to your frontend host e.g., 'http://localhost:5500'
    methods: ['GET','POST','PUT','DELETE'],
    credentials: true
}));
app.use(express.json());
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- SOCKET.IO CONNECTION ---
io.on('connection', (socket) => {
    console.log("✅ User connected:", socket.id);

    // Join user room for messaging
    socket.on('join-user-room', (userId) => {
        socket.join(`user_${userId}`);
        console.log(`User ${userId} joined room user_${userId}`);
    });

    socket.on('disconnect', () => {
        console.log("❌ User disconnected:", socket.id);
    });
});


app.use('/uploads', express.static('uploads'));
// --- 1. SERVE FRONTEND FILES ---
app.use(express.static(path.join(__dirname, 'public'))); 
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'employee', 'login.html'));
});

// --- 2. CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to Zeal HRMS Database"))
  .catch(err => console.error("❌ Connection Error:", err));


const fs = require('fs');
['uploads/profiles', 'uploads/documents', 'uploads/qrcodes', 'uploads/messages'].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});



// 1. Configure the Email Transporter
// It's best to use environment variables for these for security
const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
        user: 'zealcommunitymedicalhrdb@gmail.com', // Replace with your Gmail
        pass: 'uktn hndj wavu qowt'    // Replace with your 16-character App Password
    }
});

app.post('/api/payroll/send-email', async (req, res) => {
    const { to, subject, employeeName, pdfData, fileName } = req.body;

    // Log the incoming request attempt
    console.log(`[Server] Attempting to send email to: ${to} for employee: ${employeeName}`);

    if (!to || !pdfData) {
        console.error("[Server] Error: Missing email or PDF data in request body.");
        return res.status(400).json({ message: "Missing recipient email or PDF data." });
    }

    try {
        const mailOptions = {
            from: '"Zeal Community Payroll" <zealcommunitymedicalhrdb@gmail.com>',
            to: to,
            subject: subject,
            html: `
                <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #003D7A;">Payslip Issued</h2>
                    <p>Hello <strong>${employeeName}</strong>,</p>
                    <p>Your payslip for the period of <strong>${subject.replace('Payslip for ', '')}</strong> is now available.</p>
                    <p>Please see the attached PDF for the full breakdown of your earnings and deductions.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 11px; color: #888;">This is an automated notification from the Zeal Community Medical Mission Foundation system.</p>
                </div>
            `,
            attachments: [
                {
                    filename: fileName,
                    content: pdfData,
                    encoding: 'base64'
                }
            ]
        };

        // Attempt to send
        const info = await transporter.sendMail(mailOptions);
        
        console.log(`[Server] Success! Email ID: ${info.messageId} sent to: ${to}`);
        res.status(200).json({ success: true, message: `Sent to ${employeeName}` });

    } catch (error) {
        // This will print the exact reason (e.g., "Invalid Login", "Connection Timeout")
        console.error("[Server] Nodemailer Error Details:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server failed to send email.",
            error: error.message 
        });
    }
});
// --- 1. Notification Schema & Model ---
const notificationSchema = new mongoose.Schema({
    title: String,
    message: String,
    type: String,
    recipientId: String,
    recipientRole: String,
    url: String,
    changedData: { type: Object, default: {} },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const Notification = mongoose.model('Notification', notificationSchema);





// --- 2. API ENDPOINTS ---

// ✅ Save + Broadcast
// --- Save Notification & Emit to Clients ---
app.post('/api/notifications/save', async (req, res) => {
    try {
        // Create and save notification to DB
        const newNotif = new Notification(req.body); // expects {title, message, type}
        await newNotif.save();

        // 🔥 Real-time broadcast to all connected clients
        io.emit('new-notification', newNotif);

        // ✅ Respond to client
        res.json({ success: true, data: newNotif });
    } catch (err) {
        console.error("Notification save failed:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// ✅ Fetch
app.get('/api/notifications/all', async (req, res) => {
    try {
        const { recipientId, recipientRole } = req.query;
        let query = {};

        if (recipientId) {
            // Priority 1: Specifically for this user
            // This stops users from seeing other employees' "shift-swap" notifications
            query.$or = [
                { recipientId: recipientId },
                // Only allow role-based notifications if they are generic announcements
                // (e.g., where recipientId is not set)
                { recipientRole: recipientRole, recipientId: { $exists: false } },
                { recipientRole: 'employee', recipientId: { $exists: false } }
            ];
        } else if (recipientRole) {
            // Fallback for general role-based queries
            const normalizedRole = recipientRole.toLowerCase();
            query.recipientRole = normalizedRole === 'admin' ? 'admin' : { $in: [normalizedRole, 'employee'] };
        }

        const notifications = await Notification
            .find(query)
            .sort({ createdAt: -1 })
            .limit(20);

        res.json(notifications);
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


// ✅ Mark all read
app.put('/api/notifications/mark-all-read', async (req, res) => {
    try {
        await Notification.updateMany({ isRead: false }, { isRead: true });

        // 🔥 Broadcast update (important!)
        io.emit('notifications-updated');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});


// ✅ Mark one read
app.put('/api/notifications/mark-read/:id', async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });

        // 🔥 Broadcast update
        io.emit('notifications-updated');

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});







// --- 1. MASTER USER SCHEMA (For Login) ---
const userSchema = new mongoose.Schema({
    employeeId: { type: String, required: true, unique: true }, 
    password: { type: String, required: true }, 
    role: { type: String, required: true, enum: ['admin', 'doctor', 'nurse', 'guard', 'staff', 'accounting'] },
    email: { type: String, default: "N/A" }, 
    profilePic: { type: String, default: "/uploads/profiles/default-avatar.png" },
    isFirstLogin: { type: Boolean, default: true },
    resetPasswordCode: { type: String, default: null },
    resetPasswordExpiry: { type: Date, default: null }
});
const User = mongoose.model('User', userSchema);

// --- 2. BASE PERSONNEL SCHEMA ---
// Common fields for all professional roles
const personnelFields = {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    employeeId: { type: String, unique: true, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    middleName: String,
    suffix: String,
    fullName: String,
    gender: String,
    email: { type: String },
    phoneNumber: String,
    address: String,
    dob: Date,
    // --- Employment Info ---
    hireDate: { type: Date }, // Added Hire Date
    department: String,
    position: String,
    grade: String,
    contractType: String,
    civilStatus: { type: String, default: 'Not provided' },
    bloodType: { type: String, default: 'Not provided' },
    // --- Emergency Info ---
    emergencyNo: String,
    emergencyName: String,
    emergencyRelation: String,
    // --- Government IDs ---
    sssNumber: String,
    philHealthNumber: String,
    pagIbigNumber: String,
    tin: String,
    // --- Bank Information ---
    bankName: String,
    accountType: String,
    accountNumber: String,
    branch: String,
    
    dateJoined: { type: Date, default: Date.now }, // System entry date
    profilePic: String,
    qrCodePath: String,
    documents: [{
        docType: String,
        docFile: String,
        expiryDate: Date
    }]
};
// --- 3. ROLE-SPECIFIC MODELS ---
const Admin = mongoose.model('Admin', new mongoose.Schema({ ...personnelFields, accessLevel: String }), 'admins');
const Doctor = mongoose.model('Doctor', new mongoose.Schema({ ...personnelFields, specialization: String }), 'doctors');
const Guard = mongoose.model('Guard', new mongoose.Schema({ ...personnelFields, shift: String }), 'guards');
const Nurse = mongoose.model('Nurse', new mongoose.Schema({ ...personnelFields, department: String }), 'nurses');
const Staff = mongoose.model('Staff', new mongoose.Schema({ ...personnelFields, position: String }), 'staffs');
const Accounting = mongoose.model('Accounting', new mongoose.Schema({ ...personnelFields, department: String }), 'accountings');

const models = { admin: Admin, doctor: Doctor, guard: Guard, nurse: Nurse, staff: Staff, accounting: Accounting };

// --- 4. PENDING PROFILE CHANGES SCHEMA ---
const pendingProfileChangeSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    changeType: { type: String, enum: ['personal', 'contact', 'emergency', 'bank', 'government', 'profile'], required: true },
    changedData: { type: Object, required: true }, // Stores the changed fields
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    approvedBy: String, // Admin who approved
    rejectionReason: String,
    notes: String
});

const PendingProfileChange = mongoose.model('PendingProfileChange', pendingProfileChangeSchema, 'pendingProfileChanges');



// 1. DEFINE STORAGE FIRST
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = file.fieldname === 'profilePic' || file.fieldname === 'groupPhoto'
            ? 'uploads/profiles/'
            : file.fieldname === 'media'
                ? 'uploads/messages/'
                : 'uploads/documents/';
        cb(null, folder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// 2. NOW INITIALIZE MULTER (Using the storage defined above)
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

// 3. DEFINE YOUR FIELDS
const onboardingUpload = upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'docFile', maxCount: 10 }
]);


// --- 4. THE ONBOARDING ROUTE ---
app.post('/api/employees/onboard', (req, res) => {
    onboardingUpload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            console.error("❌ Multer Error Field:", err.field);
            return res.status(400).json({ 
                success: false, 
                error: `Multer Error: Unexpected field "${err.field}".` 
            });
        } else if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        let createdFiles = [];

        try {
            const { 
                department, firstName, lastName, middleName, suffix, gender,dob, address,
                email, phoneNumber, position, grade, contractType,
                hireDate, // <--- Destructure Hire Date
                emergencyNo, emergencyName, emergencyRelation,
                docType, docExpiry 
            } = req.body;

            // --- A. DYNAMIC ROLE MAPPING ---
            let role = req.body.role; 
            if (!role && department) {
                const d = department.toLowerCase();
                if (d.includes('doctor') || d.includes('medical')) role = 'doctor';
                else if (d.includes('nurse') || d.includes('nursing')) role = 'nurse';
                else if (d.includes('guard') || d.includes('security')) role = 'guard';
                else if (d.includes('admin') || d.includes('hr')) role = 'admin';
                else if (d.includes('accounting') || d.includes('finance')) role = 'accounting';
                else role = 'staff'; 
            }

            const roleKey = role ? role.toLowerCase() : 'staff';
            const SelectedModel = models[roleKey];
            if (!SelectedModel) throw new Error(`Role model for "${roleKey}" not found.`);

            // --- B. HANDLE DOCUMENTS ---
            const uploadedDocs = [];
            if (req.files['docFile']) {
                const types = Array.isArray(docType) ? docType : [docType];
                const expiries = Array.isArray(docExpiry) ? docExpiry : [docExpiry];

                req.files['docFile'].forEach((file, index) => {
                    const filePath = `/uploads/documents/${file.filename}`;
                    uploadedDocs.push({
                        docType: types[index] || 'Other',
                        docFile: filePath,
                        expiryDate: expiries[index] || null
                    });
                    createdFiles.push(path.join(__dirname, 'uploads/documents', file.filename));
                });
            }

            // --- C. GENERATE EMPLOYEE ID ---
            const prefix = roleKey.substring(0, 3).toUpperCase();
            const currentYear = new Date().getFullYear();
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            const generatedId = `${prefix}-${currentYear}-${randomDigits}`;

            // --- D. PROFILE PICTURE ---
            const profilePicPath = req.files['profilePic'] 
                ? `/uploads/profiles/${req.files['profilePic'][0].filename}` 
                : '/uploads/profiles/default-avatar.png';
            
            if (req.files['profilePic']) {
                createdFiles.push(path.join(__dirname, 'uploads/profiles', req.files['profilePic'][0].filename));
            }

            // --- E. QR CODE GENERATION ---
            const qrFolder = 'uploads/qrcodes/';
            if (!fs.existsSync(qrFolder)) fs.mkdirSync(qrFolder, { recursive: true });
            const qrPath = `${qrFolder}${generatedId}.png`;
            await QRCode.toFile(qrPath, generatedId, {
                color: { dark: '#000000', light: '#FFFFFF' },
                width: 300
            });
            createdFiles.push(path.join(__dirname, qrPath));

            // --- F. HASH PASSWORD ---
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash("ZealPass2026", salt);

            // --- G. SAVE LOGIN USER ---
            const newUser = new User({
                employeeId: generatedId,
                password: hashedPassword,
                role: roleKey,
                email: email || "N/A",
                profilePic: profilePicPath,
                isFirstLogin: true
            });
            const savedUser = await newUser.save({ session });

            // --- H. SAVE ROLE PROFILE ---
            const profile = new SelectedModel({
                ...req.body, 
                userId: savedUser._id,
                employeeId: generatedId,
                firstName,
                lastName,
                middleName,
                suffix,
                fullName: `${firstName} ${middleName || ''} ${lastName} ${suffix || ''}`.replace(/\s+/g, ' ').trim(),
                gender,
                dob,
                address,
                phoneNumber,
                hireDate, 
                emergencyNo,
                emergencyName,
                emergencyRelation,
                department,
                position,
                grade,
                contractType,
                profilePic: profilePicPath,
                qrCodePath: `/${qrPath}`,
                documents: uploadedDocs
            });
            await profile.save({ session });

            await session.commitTransaction();

            // --- I. SEND WELCOME EMAIL WITH CREDENTIALS ---
            if (email && email !== "N/A") {
                try {
                    const fullName = `${firstName} ${middleName || ''} ${lastName} ${suffix || ''}`.replace(/\s+/g, ' ').trim();
                    const mailOptions = {
                        from: '"Zeal Community HRMS" <zealcommunitymedicalhrdb@gmail.com>',
                        to: email,
                        subject: 'Welcome to Zeal Community - Your Login Credentials',
                        html: `
                            <div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                                <h2 style="color: #003D7A;">Welcome to Zeal Community Medical Mission Foundation</h2>
                                <p>Dear <strong>${fullName}</strong>,</p>
                                <p>Congratulations on joining our team! Your account has been successfully created.</p>
                                <p><strong>Your Login Credentials:</strong></p>
                                <ul>
                                    <li><strong>Employee ID:</strong> ${generatedId}</li>
                                    <li><strong>Temporary Password:</strong> ZealPass2026</li>
                                </ul>
                                <p>Please log in to the HRMS system and change your password immediately for security reasons.</p>
                                <p>If you have any questions, feel free to contact the HR department.</p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                                <p style="font-size: 11px; color: #888;">This is an automated message from the Zeal Community Medical Mission Foundation HRMS system.</p>
                            </div>
                        `
                    };

                    await transporter.sendMail(mailOptions);
                    console.log(`✅ Welcome email sent to ${email} for employee ${generatedId}`);
                } catch (emailError) {
                    console.error("❌ Failed to send welcome email:", emailError);
                    // Don't fail the onboarding if email fails
                }
            }

            res.status(201).json({ success: true, employeeId: generatedId, qrCode: `/${qrPath}` });

        } catch (dbError) {
            await session.abortTransaction();
            console.error("❌ Onboarding Error:", dbError);
            createdFiles.forEach(fileP => {
                if (fs.existsSync(fileP)) {
                    try { fs.unlinkSync(fileP); } catch(e) {}
                }
            });
            res.status(500).json({ success: false, error: dbError.message });
        } finally {
            session.endSession();
        }
    });
});


app.put('/api/employees/update', (req, res) => {
    onboardingUpload(req, res, async (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, error: `Multer Error: ${err.message}` });
        } else if (err) {
            return res.status(500).json({ success: false, error: err.message });
        }

        try {
            const employeeId = req.body.employeeID;
            if (!employeeId) throw new Error("employeeID is required for update");

            // Determine role and model
            let roleKey = req.body.role || 'staff';
            const SelectedModel = models[roleKey.toLowerCase()];
            if (!SelectedModel) throw new Error(`Role model "${roleKey}" not found`);

            // Update employee profile
            const updateData = { ...req.body };
            if (req.files['profilePic']) {
                updateData.profilePic = `/uploads/profiles/${req.files['profilePic'][0].filename}`;
            }

            const updatedProfile = await SelectedModel.findOneAndUpdate(
                { employeeId },
                updateData,
                { new: true }
            );

            if (!updatedProfile) throw new Error("Employee not found");

            res.json({ success: true, employeeId, data: updatedProfile });
        } catch (updateError) {
            console.error("❌ Update Error:", updateError);
            res.status(500).json({ success: false, error: updateError.message });
        }
    });
});

// --- Utility to get model by role ---
function getModelByRole(role) {
    return models[role.toLowerCase()];
}

// -----------------------------
// UPLOAD TEMP PROFILE PIC (for pending approval)
app.post('/api/employee/upload-profile-pic', upload.single('profilePic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const filePath = `/uploads/profiles/${req.file.filename}`;
        return res.json({ success: true, profilePic: filePath });
    } catch (err) {
        console.error('Upload profile pic error', err);
        return res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});

// GET /api/employees/:role/:id
// -----------------------------
// -----------------------------
// GET /api/employees/:role/:id
// -----------------------------
app.get('/api/employees/:role/:id', async (req, res) => {
    const { role, id } = req.params;
    const Model = getModelByRole(role);
    if (!Model) return res.status(400).json({ message: "Invalid role" });

    try {
        // Find employee and also link with the User collection to get the latest profilePic
        const employee = await Model.findOne({ employeeId: id }).lean();
        if (!employee) return res.status(404).json({ message: "Employee not found" });

        // Fetch the profile picture from the User model if it's not in the specific role model
        const user = await User.findOne({ employeeId: id }, 'profilePic');
        employee.profilePic = user ? user.profilePic : '/uploads/profiles/default-avatar.png';

        res.json({ employee });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


// PUT /api/employees/:role/:id
// -----------------------------
app.put('/api/employees/:role/:id', upload.fields([
    { name: 'profilePic', maxCount: 1 },
    { name: 'docFile', maxCount: 10 }
]), async (req, res) => {
    try {
        const { role, id } = req.params;
        const EmployeeModel = models[role];
        if (!EmployeeModel) return res.status(400).json({ message: "Invalid role" });

        const payload = { ...req.body };

        // 1. HANDLE PROFILE PICTURE UPDATE
        if (req.files && req.files['profilePic']) {
            const picPath = `/uploads/profiles/${req.files['profilePic'][0].filename}`;
            payload.profilePic = picPath;

            // Sync with User collection for the main list
            await User.findOneAndUpdate(
                { employeeId: id },
                { $set: { profilePic: picPath } },
                { returnDocument: 'after' } // Fixed deprecation warning here
            );
        }

        // 2. HANDLE DOCUMENTS UPDATE
        if (req.files && req.files['docFile']) {
            const newDocs = req.files['docFile'].map((file, index) => ({
                docType: Array.isArray(req.body.docType) ? req.body.docType[index] : req.body.docType,
                docFile: file.path,
                expiryDate: Array.isArray(req.body.docExpiry) ? req.body.docExpiry[index] : req.body.docExpiry
            }));
            payload.documents = newDocs; 
        }

        // 3. UPDATE ROLE-SPECIFIC COLLECTION
        const employee = await EmployeeModel.findOneAndUpdate(
            { employeeId: id },
            { $set: payload },
            { returnDocument: 'after' } // Fixed deprecation warning here
        );

        if (!employee) return res.status(404).json({ message: 'Employee not found' });
        
        console.log(`Update successful for ID: ${id}`);
        res.json({ success: true, employee });

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ message: 'Server error during update' });
    }
});
// -----------------------------
// DELETE /api/employees/:role/:id
// -----------------------------
app.delete('/api/employees/:role/:id', async (req, res) => {
    const { role, id } = req.params;
    const Model = getModelByRole(role);
    
    if (!Model) {
        return res.status(400).json({ message: "Invalid role" });
    }

    try {
        // 1. Delete from the specific role collection (e.g., Doctors, Nurses)
        const deletedFromRole = await Model.findOneAndDelete({ employeeId: id });

        if (!deletedFromRole) {
            return res.status(404).json({ message: "Employee not found in role collection" });
        }

        // 2. Delete from the main Users collection (where the list aggregation pulls from)
        const deletedFromUsers = await User.findOneAndDelete({ employeeId: id });

        if (!deletedFromUsers) {
            console.warn(`Warning: Employee ${id} was removed from ${role}s but not found in Users collection.`);
        }

        console.log(`Successfully deleted employee ${id} from both ${role} and User collections.`);
        
        res.json({ 
            success: true, 
            message: "Employee successfully removed from all systems" 
        });

    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ message: "Server error during deletion" });
    }
});





// --- THE BASE SCHEMA ---
// This contains all the common fields you've defined
const personnelSchemaDefinition = {
    employeeId: { type: String, unique: true },
    fullName: { type: String, required: true },
    email: { type: String },
    phoneNumber: String,
    dateJoined: { type: Date, default: Date.now },
    documents: [{
        docType: String,      // Matches the key in your map function
        expiryDate: Date,
        filePath: String
    }]
};

// --- ROLE-SPECIFIC SCHEMAS & MODELS ---

// Admin Collection
const adminSchema = new mongoose.Schema({
    ...personnelSchemaDefinition,
    accessLevel: { type: String, default: 'Standard' }
});


// Doctor Collection
const doctorSchema = new mongoose.Schema({
    ...personnelSchemaDefinition,
    specialization: { type: String, required: true },
    licenseNumber: String
});


// Guard Collection
const guardSchema = new mongoose.Schema({
    ...personnelSchemaDefinition,
    shift: { type: String, enum: ['Day', 'Night', 'Graveyard'] },
    assignedPost: String
});


// Nurse Collection
const nurseSchema = new mongoose.Schema({
    ...personnelSchemaDefinition,
    department: { type: String },
    isHeadNurse: { type: Boolean, default: false }
});


// General Staff Collection
const staffSchema = new mongoose.Schema({
    ...personnelSchemaDefinition,
    position: { type: String },
    officeLocation: String
});


// Export models for use in your onboarding route
module.exports = {
    Admin,
    Doctor,
    Guard,
    Nurse,
    Staff,
    Accounting,
    models: {
        admin: Admin,
        doctor: Doctor,
        guard: Guard,
        nurse: Nurse,
        staff: Staff,
        accounting: Accounting
    }
};





// 1. Define the Schema (based on your screenshot)
const departmentSchema = new mongoose.Schema({
    deptName: { type: String, required: true },
    status: { type: String, default: 'active' }
}, { collection: 'departments' }); // Ensure this matches your MongoDB collection name

// 2. Create the Model
const Department = mongoose.model('Department', departmentSchema);

// --- Place your route below this line ---

app.get('/api/departments', async (req, res) => {
    try {
        console.log("Fetching departments...");
        const departments = await Department.find({ status: 'active' }); 
        res.json(departments);
    } catch (err) {
        console.error("Backend Error:", err);
        res.status(500).json({ error: "Failed to fetch departments" });
    }
});






// --- 6. ROUTES ---

app.get('/api/verify-id', async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) return res.status(400).json({ exists: false });

    const user = await User.findOne({ employeeId: employeeId.toUpperCase() });
    
    if (user) {
      res.json({ 
        exists: true, 
        employeeId: user.employeeId, 
        role: user.role 
      });
    } else {
      res.status(404).json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get('/api/verify-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ exists: false });

    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      res.json({ 
        exists: true, 
        employeeId: user.employeeId, 
        role: user.role 
      });
    } else {
      res.status(404).json({ exists: false });
    }
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// FIXED LOGIN API: Supports Plaintext (for first login) and Bcrypt
app.post('/api/login', async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return res.json({ success: false, message: "Please provide identifier and password" });
        }
        
        const isEmail = identifier.includes('@');
        const query = isEmail 
            ? { email: identifier.trim().toLowerCase() }
            : { employeeId: identifier.trim().toUpperCase() };
        
        console.log(`[Login Attempt] ${isEmail ? 'Email' : 'ID'}: ${identifier}`); // LOG: Track attempt

        const user = await User.findOne(query);

        if (!user) {
            console.warn(`[Login Failed] User not found: ${identifier}`);
            return res.json({ success: false, message: "Invalid credentials" });
        }

        let isMatch = false;
        const isDefaultPassword = (password === "ZealPass2026");

        // 1. Check if the stored password is a Bcrypt hash
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            // 2. Fallback for the initial "ZealPass2026" plaintext password
            isMatch = isDefaultPassword;
        }

        if (isMatch) {
            console.log(`[Login Success] Password verified for: ${identifier}`);

            // --- FETCH FULL NAME FROM PERSONNEL COLLECTIONS ---
            const collections = [
                { model: Admin, name: 'Admin' },
                { model: Doctor, name: 'Doctor' },
                { model: Guard, name: 'Guard' },
                { model: Nurse, name: 'Nurse' },
                { model: Staff, name: 'Staff' },
                { model: Accounting, name: 'Accounting' }
            ];
            
            let personRecord = null;
            let foundIn = "None";

            for (const item of collections) {
                if (item.model) {
                    personRecord = await item.model.findOne({ employeeId: user.employeeId });
                    if (personRecord) {
                        foundIn = item.name;
                        break; 
                    }
                }
            }

            console.log(`[Profile Sync] Found details for ${user.employeeId} in ${foundIn} collection`);

            // SUCCESS: Determine if we should force a password change
            const forcePasswordChange = (user.isFirstLogin !== false) || isDefaultPassword;

            // Handle FullName fallback
            const fullName = personRecord?.fullName || personRecord?.name || "User";
            
            // Calculate Initials safely
            const initials = fullName
                .split(' ')
                .filter(n => n.length > 0)
                .map(n => n[0])
                .join('')
                .toUpperCase()
                .substring(0, 2);

            return res.json({ 
                success: true, 
                role: user.role, 
                isFirstLogin: forcePasswordChange,
                user: {
                    name: fullName,
                    fullName: fullName,
                    role: user.role,
                    position: personRecord?.position || user.role,
                    profilePic: user.profilePic,
                    employeeId: user.employeeId,
                    initials: initials || "??"
                }
            });
        }

        console.warn(`[Login Failed] Incorrect password for: ${identifier}`);
        res.json({ success: false, message: "Invalid credentials" });

    } catch (err) {
        // CRITICAL: Log the full error to your terminal
        console.error("--- DETAILED SERVER ERROR ---");
        console.error(err);
        console.error("-----------------------------");
        res.status(500).json({ success: false, message: "Server Error", error: err.message });
    }
});

app.post('/api/login-qr', async (req, res) => {
    try {
        const { qrData } = req.body;
        if (!qrData || typeof qrData !== 'string') {
            return res.status(400).json({ success: false, message: 'QR data is required.' });
        }

        const employeeId = String(qrData).trim().toUpperCase();
        const user = await User.findOne({ employeeId });

        if (!user) {
            return res.json({ success: false, message: 'Invalid QR code or user not found.' });
        }

        const collections = [
            { model: Admin, name: 'Admin' },
            { model: Doctor, name: 'Doctor' },
            { model: Guard, name: 'Guard' },
            { model: Nurse, name: 'Nurse' },
            { model: Staff, name: 'Staff' },
            { model: Accounting, name: 'Accounting' }
        ];

        let personRecord = null;
        let foundIn = 'None';

        for (const item of collections) {
            if (item.model) {
                personRecord = await item.model.findOne({ employeeId: user.employeeId });
                if (personRecord) {
                    foundIn = item.name;
                    break;
                }
            }
        }

        const forcePasswordChange = (user.isFirstLogin !== false);
        const fullName = personRecord?.fullName || personRecord?.name || 'User';
        const initials = fullName
            .split(' ')
            .filter(n => n.length > 0)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);

        return res.json({
            success: true,
            role: user.role,
            isFirstLogin: forcePasswordChange,
            user: {
                name: fullName,
                fullName: fullName,
                role: user.role,
                position: personRecord?.position || user.role,
                profilePic: user.profilePic,
                employeeId: user.employeeId,
                initials: initials || '??'
            }
        });
    } catch (err) {
        console.error('QR Login Error:', err);
        res.status(500).json({ success: false, message: 'Server error during QR login.' });
    }
});

// NEW: API to handle the password change from the Modal
app.post('/api/update-password', async (req, res) => {
    try {
        const { employeeId, newPassword } = req.body;
        
        // 1. Validation: Ensure password isn't empty and meets your minimum
        if (!newPassword || newPassword.length < 6) {
            return res.json({ success: false, message: "Password too short." });
        }

        // 2. Hash the new password before saving
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        // 3. Update the user: Set new password AND flip isFirstLogin to false
        const updatedUser = await User.findOneAndUpdate(
            { employeeId: employeeId.toUpperCase() },
            { 
                password: hashedPassword, 
                isFirstLogin: false 
            },
            // FIX: Replaced { new: true } with returnDocument to remove the warning
            { returnDocument: 'after' } 
        );

        if (!updatedUser) {
            return res.json({ success: false, message: "User not found." });
        }

        res.json({ 
            success: true, 
            message: "Password secured!",
            role: updatedUser.role // Return role so frontend can redirect immediately
        });
    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ success: false, message: "Server error during update." });
    }
});

// --- NEW: Forgot Password / Reset Code Flow ---
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required." });
        }

        const safeEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') });
        if (!user || !user.email || user.email === 'N/A') {
            return res.json({ success: false, message: "No account found for that email." });
        }

        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiryDate = new Date(Date.now() + 15 * 60 * 1000);

        user.resetPasswordCode = resetCode;
        user.resetPasswordExpiry = expiryDate;
        await user.save();

        const mailOptions = {
            from: '"Zeal Community Support" <zealcommunitymedicalhrdb@gmail.com>',
            to: user.email,
            subject: 'Zeal Community Password Reset Code',
            html: `
                <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
                    <h2 style="color: #003D7A;">Password Reset Requested</h2>
                    <p>Hello,</p>
                    <p>We received a request to reset your password for your Zeal Community account.</p>
                    <p><strong>Your verification code is:</strong></p>
                    <p style="font-size: 1.5rem; letter-spacing: 0.2rem; font-weight: bold;">${resetCode}</p>
                    <p>This code expires in 15 minutes.</p>
                    <p>If you did not request this, please ignore this email.</p>
                    <hr style="margin-top: 20px; border-color: #ddd;" />
                    <p style="font-size: 12px; color: #666;">Zeal Community Human Resource Information System</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "Reset code sent to your registered email." });
    } catch (err) {
        console.error("Forgot Password Error:", err);
        res.status(500).json({ success: false, message: "Unable to send reset email." });
    }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ success: false, message: "Email, code, and new password are required." });
        }

        if (newPassword.length < 6) {
            return res.json({ success: false, message: "Password must be at least 6 characters." });
        }

        const safeEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const user = await User.findOne({ email: new RegExp(`^${safeEmail}$`, 'i') });
        if (!user) {
            return res.json({ success: false, message: "No account found for that email." });
        }

        if (!user.resetPasswordCode || !user.resetPasswordExpiry) {
            return res.json({ success: false, message: "No reset request found. Please request a new code." });
        }

        if (user.resetPasswordCode !== code.trim()) {
            return res.json({ success: false, message: "Incorrect verification code." });
        }

        if (user.resetPasswordExpiry < new Date()) {
            return res.json({ success: false, message: "Verification code has expired. Request a new one." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.isFirstLogin = false;
        user.resetPasswordCode = null;
        user.resetPasswordExpiry = null;
        await user.save();

        res.json({ success: true, message: "Password has been reset successfully." });
    } catch (err) {
        console.error("Reset Password Error:", err);
        res.status(500).json({ success: false, message: "Unable to reset password." });
    }
});

// --- NEW: API to fetch employee profile by employeeId ---
app.get('/api/employee/profile/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        // 1. Get user data from User collection
        const user = await User.findOne({ employeeId: employeeId.toUpperCase() });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Find profile in the appropriate role collection
        const collections = [
            { model: Admin, role: 'admin' },
            { model: Doctor, role: 'doctor' },
            { model: Nurse, role: 'nurse' },
            { model: Guard, role: 'guard' },
            { model: Staff, role: 'staff' },
            { model: Accounting, role: 'accounting' }
        ];

        let profile = null;
        let foundRole = null;

        for (const item of collections) {
            profile = await item.model.findOne({ employeeId: employeeId.toUpperCase() });
            if (profile) {
                foundRole = item.role;
                break;
            }
        }

        if (!profile) {
            // Return basic user info if no detailed profile found
            return res.json({
                success: true,
                profile: {
                    employeeId: user.employeeId,
                    fullName: "User",
                    role: user.role,
                    email: user.email,
                    profilePic: user.profilePic,
                    gender: "Not provided",
                    dob: null,
                    address: "Not provided",
                    phoneNumber: "N/A",
                    position: user.role,
                    hireDate: null,
                    department: "N/A",
                    emergencyName: "N/A",
                    emergencyRelation: "N/A",
                    emergencyNo: "N/A",
                    contractType: "N/A",
                    dateJoined: new Date()
                }
            });
        }

        // 3. Combine and return comprehensive profile data
        const profileData = {
            employeeId: profile.employeeId,
            fullName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            middleName: profile.middleName || '',
            suffix: profile.suffix || '',
            role: user.role,
            email: user.email || profile.email || 'N/A',
            profilePic: user.profilePic || profile.profilePic || '/uploads/profiles/default-avatar.png',
            gender: profile.gender || 'Not provided',
            dob: profile.dob || null,
            address: profile.address || 'Not provided',
            phoneNumber: profile.phoneNumber || 'N/A',
            position: profile.position || user.role,
            department: profile.department || 'N/A',
            hireDate: profile.hireDate || profile.dateJoined,
            dateJoined: profile.dateJoined,
            emergencyName: profile.emergencyName || 'N/A',
            emergencyRelation: profile.emergencyRelation || 'N/A',
            emergencyNo: profile.emergencyNo || 'N/A',
            contractType: profile.contractType || 'Full-time',
            grade: profile.grade || 'N/A',
            documents: profile.documents || [],
            qrCodePath: profile.qrCodePath || null,
            specialization: profile.specialization || null, // For doctors
            civilStatus: profile.civilStatus || 'Not provided',
            bloodType: profile.bloodType || 'Not provided',
            // Government IDs
            sssNumber: profile.sssNumber || 'N/A',
            philhealthNumber: profile.philHealthNumber || profile.philhealthNumber || 'N/A',
            pagibigNumber: profile.pagIbigNumber || profile.pagibigNumber || 'N/A',
            tin: profile.tin || 'N/A',
            // Bank Information
            bankName: profile.bankName || 'N/A',
            accountType: profile.accountType || 'N/A',
            accountNumber: profile.accountNumber || 'N/A',
            branch: profile.branch || 'N/A'
        };

        res.json({
            success: true,
            profile: profileData
        });

    } catch (err) {
        console.error("Profile Fetch Error:", err);
        res.status(500).json({ success: false, message: "Error fetching profile", error: err.message });
    }
});

// --- API TO SUBMIT PENDING PROFILE CHANGES ---
app.post('/api/employee/submit-profile-change', async (req, res) => {
    try {
        const { employeeId, changeType, changedData } = req.body;

        if (!employeeId || !changeType || !changedData) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        // Create a new pending change record
        const pendingChange = new PendingProfileChange({
            employeeId: employeeId.toUpperCase(),
            changeType,
            changedData,
            status: 'pending',
            submittedAt: new Date()
        });

        await pendingChange.save();

        // Create notification for admins
        const adminNotification = new Notification({
            title: 'New Profile Change Request',
            message: `Employee ${employeeId} submitted ${changeType} changes for approval.`,
            type: 'info',
            recipientRole: 'admin'
        });
        await adminNotification.save();

        // Broadcast notification to all connected admins
        io.emit('new-notification', adminNotification);

        res.json({
            success: true,
            message: "Profile changes submitted for HR approval",
            changeId: pendingChange._id
        });

    } catch (err) {
        console.error("Submit Profile Change Error:", err);
        res.status(500).json({ success: false, message: "Error submitting profile change", error: err.message });
    }
});

// --- API TO FETCH PENDING PROFILE CHANGES FOR EMPLOYEE ---
app.get('/api/employee/pending-changes/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;

        const pendingChanges = await PendingProfileChange.find({
            employeeId: employeeId.toUpperCase(),
            status: 'pending'
        }).sort({ submittedAt: -1 });

        res.json({
            success: true,
            pendingChanges
        });

    } catch (err) {
        console.error("Fetch Employee Pending Changes Error:", err);
        res.status(500).json({ success: false, message: "Error fetching pending changes", error: err.message });
    }
});

// --- ADMIN ENDPOINTS FOR PENDING CHANGES ---

// Get all pending changes for admin review
app.get('/api/admin/pending-changes', async (req, res) => {
    try {
        const pendingChanges = await PendingProfileChange.find({ status: 'pending' })
            .sort({ submittedAt: -1 });

        // For each pending change, get employee details
        const changesWithDetails = await Promise.all(pendingChanges.map(async (change) => {
            const employeeId = change.employeeId;
            
            // Find employee in appropriate collection
            const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
            let employee = null;
            let collectionName = '';

            for (const collection of collections) {
                employee = await collection.findOne({ employeeId: employeeId });
                if (employee) {
                    collectionName = collection.modelName.toLowerCase();
                    break;
                }
            }

            return {
                ...change.toObject(),
                employeeId: {
                    fullName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'Unknown',
                    employeeId: employeeId,
                    department: employee?.department || collectionName,
                    position: employee?.position || 'Staff'
                }
            };
        }));

        res.json({
            success: true,
            pendingChanges: changesWithDetails
        });
    } catch (err) {
        console.error("Fetch Admin Pending Changes Error:", err);
        res.status(500).json({ success: false, message: "Error fetching pending changes", error: err.message });
    }
});

// Get single pending change details
app.get('/api/admin/pending-changes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const change = await PendingProfileChange.findById(id);

        if (!change) {
            return res.status(404).json({ success: false, message: "Change not found" });
        }

        // Get employee details
        const employeeId = change.employeeId;
        let employee = null;
        let collectionName = 'Unknown';

        // Try to find employee in different collections
        const collections = [Admin, Doctor, Nurse, Guard, Staff, Accounting];
        for (const collection of collections) {
            try {
                employee = await collection.findOne({ employeeId: employeeId });
                if (employee) {
                    collectionName = collection.modelName.toLowerCase();
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        const changeWithDetails = {
            ...change.toObject(),
            employeeId: {
                fullName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'Unknown',
                employeeId: employeeId,
                department: employee?.department || collectionName,
                position: employee?.position || 'Staff'
            }
        };

        res.json({
            success: true,
            ...changeWithDetails
        });
    } catch (err) {
        console.error("Fetch Single Pending Change Error:", err);
        res.status(500).json({ success: false, message: "Error fetching change details", error: err.message });
    }
});

// Approve pending change
app.put('/api/admin/pending-changes/approve/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminId } = req.body; // Admin who approved

        const pendingChange = await PendingProfileChange.findById(id);
        if (!pendingChange) {
            return res.status(404).json({ success: false, message: "Pending change not found" });
        }

        // Update the pending change
        pendingChange.status = 'approved';
        pendingChange.approvedAt = new Date();
        pendingChange.approvedBy = adminId;
        await pendingChange.save();

        // Update the actual employee record
        const employeeId = pendingChange.employeeId;
        const changedData = pendingChange.changedData;

        // Find the employee in the appropriate collection
        const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
        let employee = null;
        let collectionName = '';

        for (const collection of collections) {
            employee = await collection.findOne({ employeeId: employeeId });
            if (employee) {
                collectionName = collection.modelName.toLowerCase();
                break;
            }
        }

        if (employee) {
            // Update the employee record with the approved changes
            Object.keys(changedData).forEach(key => {
                employee[key] = changedData[key];
            });
            await employee.save();
        }

        // If profile change includes user-level fields, update User document too
        const userUpdates = {};
        if (changedData.email) userUpdates.email = changedData.email;
        if (changedData.profilePic) userUpdates.profilePic = changedData.profilePic;
        if (Object.keys(userUpdates).length > 0) {
            await User.findOneAndUpdate({ employeeId }, { $set: userUpdates }, { new: true });
        }

        // Create notification for employee
        const notification = new Notification({
            title: 'Profile Change Approved',
            message: `Your ${pendingChange.changeType} changes have been approved and updated.`,
            type: 'success',
            recipientId: employeeId,
            recipientRole: collectionName,
            url: '/employee/pages/profile.html',
            changedData: pendingChange.changedData
        });
        await notification.save();

        // Broadcast notification
        io.emit('new-notification', notification);

        res.json({ success: true, message: "Change approved successfully" });
    } catch (err) {
        console.error("Approve Pending Change Error:", err);
        res.status(500).json({ success: false, message: "Error approving change", error: err.message });
    }
});

// Reject pending change
app.put('/api/admin/pending-changes/reject/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminId, rejectionReason } = req.body;

        const pendingChange = await PendingProfileChange.findById(id);
        if (!pendingChange) {
            return res.status(404).json({ success: false, message: "Pending change not found" });
        }

        // Update the pending change
        pendingChange.status = 'rejected';
        pendingChange.approvedAt = new Date();
        pendingChange.approvedBy = adminId;
        pendingChange.rejectionReason = rejectionReason;
        await pendingChange.save();

        // Create notification for employee
        const notification = new Notification({
            title: 'Profile Change Rejected',
            message: `Your ${pendingChange.changeType} changes were rejected. ${rejectionReason || ''}`,
            type: 'warning',
            recipientId: pendingChange.employeeId,
            recipientRole: 'employee' // Generic role
        });
        await notification.save();

        // Broadcast notification
        io.emit('new-notification', notification);

        res.json({ success: true, message: "Change rejected successfully" });
    } catch (err) {
        console.error("Reject Pending Change Error:", err);
        res.status(500).json({ success: false, message: "Error rejecting change", error: err.message });
    }
});

// Get recent approved/rejected changes
app.get('/api/admin/recent-changes', async (req, res) => {
    try {
        const recentChanges = await PendingProfileChange.find({
            status: { $in: ['approved', 'rejected'] }
        })
        .sort({ approvedAt: -1 })
        .limit(20);

        // For each recent change, get employee details
        const changesWithDetails = await Promise.all(recentChanges.map(async (change) => {
            const employeeId = change.employeeId;
            
            // Find employee in appropriate collection
            const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
            let employee = null;
            let collectionName = '';

            for (const collection of collections) {
                employee = await collection.findOne({ employeeId: employeeId });
                if (employee) {
                    collectionName = collection.modelName.toLowerCase();
                    break;
                }
            }

            return {
                ...change.toObject(),
                employeeId: {
                    fullName: employee ? `${employee.firstName || ''} ${employee.lastName || ''}`.trim() : 'Unknown',
                    employeeId: employeeId,
                    department: employee?.department || collectionName,
                    position: employee?.position || 'Staff'
                }
            };
        }));

        res.json({
            success: true,
            recentChanges: changesWithDetails
        });
    } catch (err) {
        console.error("Fetch Recent Changes Error:", err);
        res.status(500).json({ success: false, message: "Error fetching recent changes", error: err.message });
    }
});

// --- 6. UPDATED SYNC ROUTE ---
app.get('/api/admin/sync-all', async (req, res) => {
    try {
        const collections = [
            { model: Admin, role: 'admin' },
            { model: Doctor, role: 'doctor' },
            { model: Guard, role: 'guard' },
            { model: Nurse, role: 'nurse' },
            { model: Staff, role: 'staff' },
            { model: Accounting, role: 'accounting' }
        ];

        let count = 0;
        for (const item of collections) {
            const members = await item.model.find({});
            for (const p of members) {
                await autoGenerateLogin(p, item.role);
                count++;
            }
        }
        res.json({ success: true, message: `Successfully synced ${count} records across all collections.` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/list-users', async (req, res) => {
    try {
        const users = await User.find({}, 'employeeId role');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Could not fetch users" });
    }
});

app.get('/api/admin/migrate-all', async (req, res) => {
    try {
        const results = [];
        const collections = [
            { model: Admin, role: 'admin' },
            { model: Doctor, role: 'doctor' },
            { model: Nurse, role: 'nurse' },
            { model: Guard, role: 'guard' },
            { model: Staff, role: 'staff' },
            { model: Accounting, role: 'accounting' }
        ];

        for (const item of collections) {
            const records = await item.model.find({});
            let updatedCount = 0;

            for (const record of records) {
                // 1. Determine the best email source
                // Admins often have email in the record, 
                // Doctors might have it in contact objects.
                const emailToSync = record.email || (record.contact && record.contact.email) || "N/A";

                // 2. Update or Create the User document
                await User.findOneAndUpdate(
                    { employeeId: record.employeeId },
                    {
                        $set: {
                            role: item.role.toLowerCase(),
                            email: emailToSync,
                            // Ensure the profilePic field exists in User collection
                            profilePic: record.profilePic || "/uploads/profiles/default-avatar.png"
                        },
                        $setOnInsert: {
                            password: "$2b$10$hQF/xRAcJq0rBeIsHzUux.R/Zq8oxuera6FVwYdS.JArnQFzySyPG", // Default hashed ZealPass2026
                            isFirstLogin: false // Set to false for existing users
                        }
                    },
                    { upsert: true }
                );
                updatedCount++;
            }
            results.push({ collection: item.role, processed: updatedCount });
        }

        res.json({
            success: true,
            message: "Database migration and sync complete.",
            details: results
        });
    } catch (err) {
        console.error("Migration Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});


app.get('/api/employees/list', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { search, role, status } = req.query;

        // Stage 1: Define the Filter Logic
        const filterMatch = {
            $and: [
                // Added: Exclude any employeeId starting with "ADM"
                { employeeId: { $not: /^ADM/ } }, 
                role ? { role: role } : {},
                (status && status !== 'All Status') ? { status: status } : {},
                search ? {
                    $or: [
                        { fullName: { $regex: search, $options: 'i' } },
                        { email: { $regex: search, $options: 'i' } },
                        { employeeId: { $regex: search, $options: 'i' } }
                    ]
                } : {}
            ]
        };

        const pipeline = [
            { $lookup: { from: "doctors", localField: "employeeId", foreignField: "employeeId", as: "doc" } },
            { $lookup: { from: "nurses", localField: "employeeId", foreignField: "employeeId", as: "nur" } },
            { $lookup: { from: "guards", localField: "employeeId", foreignField: "employeeId", as: "gua" } },
            { $lookup: { from: "staffs", localField: "employeeId", foreignField: "employeeId", as: "stf" } },
            { $lookup: { from: "admins", localField: "employeeId", foreignField: "employeeId", as: "adm" } },
            { $lookup: { from: "accountings", localField: "employeeId", foreignField: "employeeId", as: "acc" } },
            {
                $project: {
                    employeeId: 1,
                    role: 1,
                    email: 1,
                    profilePic: { $ifNull: ["$profilePic", "/uploads/profiles/default-avatar.png"] },
                    status: { $ifNull: ["$status", "Active"] },

                    fullName: {
                        $let: {
                            vars: {
                                profile: {
                                    $ifNull: [
                                        { $arrayElemAt: ["$doc", 0] },
                                        { $arrayElemAt: ["$nur", 0] },
                                        { $arrayElemAt: ["$gua", 0] },
                                        { $arrayElemAt: ["$stf", 0] },
                                        { $arrayElemAt: ["$adm", 0] },
                                        { $arrayElemAt: ["$acc", 0] }
                                    ]
                                }
                            },
                            in: {
                                $concat: [
                                    { $ifNull: ["$$profile.firstName", { $ifNull: ["$$profile.firstname", "Unknown"] }] },
                                    " ",
                                    { $ifNull: ["$$profile.lastName", { $ifNull: ["$$profile.lastname", "User"] }] }
                                ]
                            }
                        }
                    },

                    position: {
                        $ifNull: [
                            { $arrayElemAt: ["$doc.position", 0] },
                            { $arrayElemAt: ["$nur.position", 0] },
                            { $arrayElemAt: ["$gua.position", 0] },
                            { $arrayElemAt: ["$stf.position", 0] },
                            { $arrayElemAt: ["$adm.position", 0] },
                            { $arrayElemAt: ["$acc.position", 0] },
                            "General Staff"
                        ]
                    },

                    phoneNumber: {
                        $ifNull: [
                            { $arrayElemAt: ["$doc.phoneNumber", 0] },
                            { $arrayElemAt: ["$nur.phoneNumber", 0] },
                            { $arrayElemAt: ["$gua.phoneNumber", 0] },
                            { $arrayElemAt: ["$stf.phoneNumber", 0] },
                            { $arrayElemAt: ["$adm.phoneNumber", 0] },
                            { $arrayElemAt: ["$acc.phoneNumber", 0] },
                            "N/A"
                        ]
                    },

                    hireDate: { 
                        $ifNull: [
                            { $arrayElemAt: ["$doc.dateJoined", 0] },
                            { $arrayElemAt: ["$nur.dateJoined", 0] },
                            { $arrayElemAt: ["$gua.dateJoined", 0] },
                            { $arrayElemAt: ["$stf.dateJoined", 0] },
                            { $arrayElemAt: ["$adm.dateJoined", 0] },
                            { $arrayElemAt: ["$acc.dateJoined", 0] },   
                            "N/A"
                        ] 
                    }
                }
            },
            { $match: filterMatch }
        ];

        // Stage 2: Get Total Count after filters
        const countPipeline = [...pipeline, { $count: "total" }];
        const countResult = await User.aggregate(countPipeline);
        const totalEmployees = countResult.length > 0 ? countResult[0].total : 0;

        // Stage 3: Get Paginated Data
        const employees = await User.aggregate([
            ...pipeline,
            { $sort: { hireDate: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        res.json({
            employees,
            page: page,
            pages: Math.ceil(totalEmployees / limit),
            total: totalEmployees
        });
    } catch (err) {
        console.error("Aggregation Error:", err);
        res.status(500).json({ success: false, message: "Error fetching employee list" });
    }
});



// Define the Collection (Schema)
const attendanceSchema = new mongoose.Schema({
    empId: { type: String, required: true }, // REMOVED 'unique: true'
    name: String,
    checkIn: String,
    checkOut: String,
    status: String,
    duration: String,
    initials: String,
    color: String,
    role: String,
    date: { type: String, default: () => new Date().toISOString().split('T')[0] }
});

// ADD THIS: Allows the same ID on different dates
attendanceSchema.index({ empId: 1, date: 1 }, { unique: true });

const Attendance = mongoose.model('Attendance', attendanceSchema);

// --- MESSAGING SCHEMAS ---
const conversationSchema = new mongoose.Schema({
    participants: [{ type: String, required: true }], // Array of employeeIds
    type: { type: String, enum: ['direct', 'group'], default: 'direct' },
    name: { type: String }, // For group chats
    groupPhoto: { type: String },
    createdBy: { type: String, required: true }, // employeeId who created
    createdAt: { type: Date, default: Date.now },
    lastMessage: {
        senderId: String,
        content: String,
        timestamp: Date
    },
    isActive: { type: Boolean, default: true }
});

const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: String, required: true }, // employeeId
    content: { type: String },
    messageType: { type: String, enum: ['text', 'image', 'video'], default: 'text' },
    mediaUrl: { type: String }, // For images/videos
    timestamp: { type: Date, default: Date.now },
    isRead: { type: Boolean, default: false },
    readBy: [{ type: String }] // Array of employeeIds who read it
});

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message = mongoose.model('Message', messageSchema);

// --- API ROUTES ---

// GET: Fetch only today's attendance records
app.get('/api/attendance', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const records = await Attendance.find({ date: today });
        res.json(records);
    } catch (err) {
        console.error("Fetch Error:", err);
        res.status(500).json({ success: false, message: "Error fetching records" });
    }
});

// POST: Create or Update attendance for today
app.post('/api/attendance', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0]; 
        const { empId, ...updateData } = req.body;

        const record = await Attendance.findOneAndUpdate(
            { empId, date: today }, 
            { $set: { empId, date: today, ...updateData } }, 
            { upsert: true, new: true }
        );
        res.json(record);
    } catch (err) {
        console.error("Save Error:", err);
        res.status(500).json({ success: false, message: "Error saving attendance" });
    }
});

// DELETE: Clear only today's log
app.delete('/api/attendance', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        await Attendance.deleteMany({ date: today });
        res.json({ message: "Daily log cleared for " + today });
    } catch (err) {
        console.error("Delete Error:", err);
        res.status(500).json({ success: false, message: "Error clearing log" });
    }
});

// GET: Fetch employee attendance for the employee portal
app.get('/api/employee/attendance', async (req, res) => {
    try {
        const { employeeId, month, page = 1, limit = 15 } = req.query;
        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'employeeId is required' });
        }

        const query = { empId: employeeId };
        if (month) {
            const [year, monthNumber] = month.split('-').map(part => Number(part));
            if (!year || !monthNumber) {
                return res.status(400).json({ success: false, message: 'Invalid month format' });
            }

            const lastDay = new Date(year, monthNumber, 0).getDate();
            query.date = {
                $gte: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
                $lte: `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
            };
        }

        const pageNum = Math.max(1, Number(page) || 1);
        const limitNum = Math.max(1, Number(limit) || 15);

        const totalRecords = await Attendance.countDocuments(query);
        const totalPages = Math.ceil(totalRecords / limitNum);

        const attendance = await Attendance.find(query)
            .sort({ date: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        function parseTimeToMinutes(timeStr) {
            if (!timeStr || typeof timeStr !== 'string') return null;
            const parts = timeStr.trim().split(' ');
            if (parts.length !== 2) return null;
            const [timePart, period] = parts;
            const [hourStr, minuteStr] = timePart.split(':');
            const hour = Number(hourStr);
            const minute = Number(minuteStr);
            if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
            let adjustedHour = hour;
            const normalized = period.toUpperCase();
            if (normalized === 'PM' && hour < 12) adjustedHour += 12;
            if (normalized === 'AM' && hour === 12) adjustedHour = 0;
            return adjustedHour * 60 + minute;
        }

        function parseDurationToMinutes(duration) {
            if (!duration || typeof duration !== 'string') return 0;
            const hoursMatch = duration.match(/(\d+)h/);
            const minsMatch = duration.match(/(\d+)m/);
            const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
            const minutes = minsMatch ? Number(minsMatch[1]) : 0;
            return hours * 60 + minutes;
        }

        function formatMinutes(totalMinutes) {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${minutes}m`;
        }

        const totalMinutes = attendance.reduce((sum, record) => {
            const durationMinutes = parseDurationToMinutes(record.duration);
            if (durationMinutes > 0) return sum + durationMinutes;

            const checkInMinutes = parseTimeToMinutes(record.checkIn);
            const checkOutMinutes = parseTimeToMinutes(record.checkOut);
            if (checkInMinutes !== null && checkOutMinutes !== null) {
                const diff = checkOutMinutes - checkInMinutes;
                return sum + (diff >= 0 ? diff : diff + 24 * 60);
            }

            return sum;
        }, 0);

        const presentCount = attendance.filter(rec => rec.checkIn && rec.checkOut).length;
        const absentCount = attendance.filter(rec => rec.status === 'Absent' || (!rec.checkIn && !rec.checkOut)).length;
        const lateCount = attendance.filter(rec => {
            const minutes = parseTimeToMinutes(rec.checkIn);
            return minutes !== null && minutes > 8 * 60 + 15;
        }).length;
        const earlyCount = attendance.filter(rec => {
            const minutes = parseTimeToMinutes(rec.checkOut);
            return minutes !== null && minutes < 17 * 60;
        }).length;

        const summary = {
            totalRecords,
            present: presentCount,
            absent: absentCount,
            late: lateCount,
            early: earlyCount,
            totalHoursStr: formatMinutes(totalMinutes)
        };

        return res.json({
            success: true,
            attendance,
            totalPages,
            currentPage: pageNum,
            totalRecords,
            summary
        });
    } catch (err) {
        console.error('Attendance fetch error:', err);
        return res.status(500).json({ success: false, message: 'Failed to load attendance' });
    }
});

// --- MESSAGING API ROUTES ---

// Search employees for messaging
app.get('/api/messaging/search-employees', async (req, res) => {
    try {
        const { query, currentUserId } = req.query;
        if (!query || query.length < 2) {
            return res.json({ success: true, employees: [] });
        }

        const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
        const employees = [];

        for (const Model of collections) {
            const results = await Model.find({
                $and: [
                    { employeeId: { $ne: currentUserId } }, // Exclude current user
                    {
                        $or: [
                            { fullName: { $regex: query, $options: 'i' } },
                            { employeeId: { $regex: query, $options: 'i' } },
                            { email: { $regex: query, $options: 'i' } }
                        ]
                    }
                ]
            }).select('employeeId fullName position department profilePic').limit(10);

            employees.push(...results);
        }

        // Remove duplicates and limit results
        const uniqueEmployees = employees.filter((emp, index, self) =>
            index === self.findIndex(e => e.employeeId === emp.employeeId)
        ).slice(0, 20);

        res.json({ success: true, employees: uniqueEmployees });
    } catch (err) {
        console.error('Search employees error:', err);
        res.status(500).json({ success: false, message: 'Failed to search employees' });
    }
});

// Get user's conversations
app.get('/api/messaging/conversations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const conversations = await Conversation.find({
            participants: userId,
            isActive: true
        }).sort({ 'lastMessage.timestamp': -1 });

        // Get participant details for each conversation
        const conversationsWithDetails = await Promise.all(conversations.map(async (conv) => {
            const participants = await Promise.all(conv.participants.map(async (empId) => {
                if (empId === userId) return null; // Skip current user for direct chats

                const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
                for (const Model of collections) {
                    const emp = await Model.findOne({ employeeId: empId })
                        .select('employeeId fullName position department profilePic');
                    if (emp) return emp;
                }
                return { employeeId: empId, fullName: 'Unknown User' };
            }));

            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                senderId: { $ne: userId },
                isRead: false
            });

            return {
                ...conv.toObject(),
                participants: participants.filter(p => p !== null),
                unreadCount
            };
        }));

        res.json({ success: true, conversations: conversationsWithDetails });
    } catch (err) {
        console.error('Get conversations error:', err);
        res.status(500).json({ success: false, message: 'Failed to load conversations' });
    }
});

// Create new conversation
app.post('/api/messaging/conversations', async (req, res) => {
    try {
        const { participants, type, name, createdBy } = req.body;

        // Check if direct conversation already exists
        if (type === 'direct' && participants.length === 2) {
            const existing = await Conversation.findOne({
                participants: { $all: participants, $size: 2 },
                type: 'direct'
            });

            if (existing) {
                return res.json({ success: true, conversation: existing });
            }
        }

        const conversation = new Conversation({
            participants,
            type: type || 'direct',
            name,
            createdBy
        });

        await conversation.save();
        res.json({ success: true, conversation });
    } catch (err) {
        console.error('Create conversation error:', err);
        res.status(500).json({ success: false, message: 'Failed to create conversation' });
    }
});

// Get messages for a conversation
app.get('/api/messaging/messages/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const messages = await Message.find({ conversationId })
            .sort({ timestamp: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean();

        const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
        const messagesWithSender = await Promise.all(messages.map(async (msg) => {
            let sender = null;
            for (const Model of collections) {
                sender = await Model.findOne({ employeeId: msg.senderId })
                    .select('employeeId fullName profilePic');
                if (sender) break;
            }
            return {
                ...msg,
                sender
            };
        }));

        // Reverse to get chronological order
        messagesWithSender.reverse();

        res.json({ success: true, messages: messagesWithSender });
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ success: false, message: 'Failed to load messages' });
    }
});

// Send message
app.post('/api/messaging/messages', upload.single('media'), async (req, res) => {
    try {
        const { conversationId, senderId, content, messageType = 'text' } = req.body;

        let mediaUrl = null;
        if (req.file) {
            mediaUrl = `/uploads/messages/${req.file.filename}`;
        }

        const message = new Message({
            conversationId,
            senderId,
            content,
            messageType,
            mediaUrl
        });

        await message.save();

        // Update conversation's last message
        await Conversation.findByIdAndUpdate(conversationId, {
            lastMessage: {
                senderId,
                content: messageType === 'text' ? content : `[${messageType}]`,
                timestamp: message.timestamp
            }
        });

        // Get sender details
        const collections = [Admin, Doctor, Guard, Nurse, Staff, Accounting];
        let sender = null;
        for (const Model of collections) {
            sender = await Model.findOne({ employeeId: senderId })
                .select('employeeId fullName profilePic');
            if (sender) break;
        }

        const messageWithSender = {
            ...message.toObject(),
            sender
        };

        // Emit to all participants via Socket.IO
        const conversation = await Conversation.findById(conversationId);
        conversation.participants.forEach(participantId => {
            io.to(`user_${participantId}`).emit('new-message', messageWithSender);
        });

        res.json({ success: true, message: messageWithSender });
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ success: false, message: 'Failed to send message' });
    }
});

// Mark messages as read
app.put('/api/messaging/messages/read/:conversationId', async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId } = req.body;

        await Message.updateMany(
            { conversationId, senderId: { $ne: userId }, isRead: false },
            {
                $set: { isRead: true },
                $addToSet: { readBy: userId }
            }
        );

        const conversation = await Conversation.findById(conversationId);
        if (conversation) {
            conversation.participants.forEach(participantId => {
                io.to(`user_${participantId}`).emit('messages-read', { conversationId, readerId: userId });
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ success: false, message: 'Failed to mark messages as read' });
    }
});

// Create group chat
app.post('/api/messaging/groups', async (req, res) => {
    try {
        const { name, participants, createdBy } = req.body;

        const conversation = new Conversation({
            participants: [...participants, createdBy], // Include creator
            type: 'group',
            name,
            createdBy
        });

        await conversation.save();
        res.json({ success: true, conversation });
    } catch (err) {
        console.error('Create group error:', err);
        res.status(500).json({ success: false, message: 'Failed to create group' });
    }
});

// Update group chat photo
app.post('/api/messaging/groups/:conversationId/photo', upload.single('groupPhoto'), async (req, res) => {
    try {
        const { conversationId } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const photoPath = `/uploads/profiles/${req.file.filename}`;
        const conversation = await Conversation.findByIdAndUpdate(conversationId, { groupPhoto: photoPath }, { new: true });
        if (!conversation) {
            return res.status(404).json({ success: false, message: 'Conversation not found' });
        }

        res.json({ success: true, conversation });
    } catch (err) {
        console.error('Update group photo error:', err);
        res.status(500).json({ success: false, message: 'Failed to update group photo' });
    }
});




app.get('/api/employees/payroll-list', async (req, res) => {
    try {
        const pipeline = [
            // Added Match Stage at the beginning to exclude ADM IDs
            { 
                $match: { 
                    employeeId: { $not: /^ADM/ } 
                } 
            },
            { $lookup: { from: "doctors", localField: "employeeId", foreignField: "employeeId", as: "doc" } },
            { $lookup: { from: "nurses", localField: "employeeId", foreignField: "employeeId", as: "nur" } },
            { $lookup: { from: "guards", localField: "employeeId", foreignField: "employeeId", as: "gua" } },
            { $lookup: { from: "staffs", localField: "employeeId", foreignField: "employeeId", as: "stf" } },
            { $lookup: { from: "admins", localField: "employeeId", foreignField: "employeeId", as: "adm" } },
            { $lookup: { from: "accountings", localField: "employeeId", foreignField: "employeeId", as: "acc" } },
            { $lookup: { from: "collections", localField: "employeeId", foreignField: "employeeId", as: "col" } },
            {
                $project: {
                    employeeId: 1,
                    role: 1,
                    profile: { $ifNull: [
                        { $arrayElemAt: ["$doc", 0] }, { $arrayElemAt: ["$nur", 0] },
                        { $arrayElemAt: ["$gua", 0] }, { $arrayElemAt: ["$stf", 0] },
                        { $arrayElemAt: ["$adm", 0] }, { $arrayElemAt: ["$acc", 0] }, { $arrayElemAt: ["$col", 0] }
                    ]},
                }
            },
            {
                $project: {
                    employeeId: 1,
                    fullName: { $concat: [{ $ifNull: ["$profile.firstName", "Unknown"]}, " ", { $ifNull: ["$profile.lastName", "User"]}] },
                    position: { $ifNull: ["$profile.position", "Staff"] },
                    contractType: { $ifNull: ["$profile.contractType", "FIXED"] },
                    grade: { $ifNull: ["$profile.grade", "A4"] },
                    profilePic: { $ifNull: ["$profile.profilePic", "/uploads/profiles/default-avatar.png"] },

                    // --- ALLOWANCE BREAKDOWN ---
                    housing: { $ifNull: ["$profile.housing", 0] },
                    travel: { $ifNull: ["$profile.travel", 0] },
                    meal: { $ifNull: ["$profile.meal", 0] },
                    hazardPay: { $ifNull: ["$profile.hazardPay", 0] },

                    // --- DEDUCTION BREAKDOWN ---
                    tax: { $ifNull: ["$profile.tax", 0] },
                    philhealth: { $ifNull: ["$profile.philhealth", 0] },
                    sss: { $ifNull: ["$profile.sss", 0] },
                    pagibig: { $ifNull: ["$profile.pagibig", 0] },

                    // --- TOTALS ---
                    totalAllowances: {
                        $add: [
                            { $ifNull: ["$profile.housing", 0] },
                            { $ifNull: ["$profile.travel", 0] },
                            { $ifNull: ["$profile.meal", 0] },
                            { $ifNull: ["$profile.hazardPay", 0] }
                        ]
                    },
                    totalDeductions: {
                        $add: [
                            { $ifNull: ["$profile.tax", 0] },
                            { $ifNull: ["$profile.philhealth", 0] },
                            { $ifNull: ["$profile.sss", 0] },
                            { $ifNull: ["$profile.pagibig", 0] }
                        ]
                    },

                    baseSalary: {
                        $switch: {
                            branches: [
                                { case: { $eq: ["$profile.grade", "A1"] }, then: 3000 },
                                { case: { $eq: ["$profile.grade", "A2"] }, then: 700 },
                                { case: { $eq: ["$profile.grade", "A3"] }, then: 610 },
                                { case: { $eq: ["$profile.grade", "A4"] }, then: 350 }
                            ],
                            default: 350
                        }
                    },
                    schedule: { $literal: "07:30 AM - 08:00 PM (4 Days)" }
                }
            }
        ];

        const employees = await User.aggregate(pipeline);
        res.json({ success: true, employees });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});



// Ensure this is inside your server.js where 'app' and 'models' are defined

app.post('/api/employees/update-allowances', async (req, res) => {
    try {
        const { employeeId, housing, travel, meal, hazardPay } = req.body;
        
        // Ensure values are numbers for math
        const h = Number(housing) || 0;
        const t = Number(travel) || 0;
        const m = Number(meal) || 0;
        const hp = Number(hazardPay) || 0;
        const totalAllowances = h + t + m + hp;

        let foundModel = null;

        // 1. Find which collection the employee belongs to
        for (const role in models) {
            const exists = await models[role].findOne({ employeeId });
            if (exists) {
                foundModel = models[role];
                break; 
            }
        }

        if (!foundModel) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // 2. Update the found document
        await foundModel.findOneAndUpdate(
            { employeeId },
            { 
                $set: { 
                    housing: h, 
                    travel: t, 
                    meal: m, 
                    hazardPay: hp, 
                    totalAllowances: totalAllowances 
                } 
            },
            { 
                returnDocument: 'after', // Fixed the deprecated 'new: true' warning
                strict: false 
            }
        );

        res.json({ success: true, message: 'Allowances updated successfully!' });

    } catch (err) {
        console.error("Update Error:", err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


app.post('/api/employees/update-deductions', async (req, res) => {
    try {
        const { employeeId, tax, philhealth, sss, pagibig } = req.body;
        
        // Calculate total deductions
        const t = Number(tax) || 0;
        const p = Number(philhealth) || 0;
        const s = Number(sss) || 0;
        const l = Number(pagibig) || 0;
        const totalDeductions = t + p + s + l;

        let foundModel = null;
        for (const role in models) {
            const exists = await models[role].findOne({ employeeId });
            if (exists) { foundModel = models[role]; break; }
        }

        if (!foundModel) return res.status(404).json({ success: false, message: 'Employee not found' });

        await foundModel.findOneAndUpdate(
            { employeeId },
            { 
                $set: { 
                    tax: t, philhealth: p, sss: s, pagibig: l, 
                    totalDeductions: totalDeductions 
                } 
            },
            { returnDocument: 'after', strict: false }
        );

        res.json({ success: true, message: 'Deductions updated!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});





const PayrollSchema = new mongoose.Schema({
    month: { type: String, required: true },
    period: { type: String, required: true }, // "15th" or "30th"
    totalCompanyNet: { type: Number, required: true },
    records: [{
        employeeId: String,
        fullName: String,
        position: String,
        contractType: String,
        profilePic: String,
        baseSalary: Number,
        allowances: Number,
        deductions: Number,
        netPay: Number,
        breakdown: {
            tax: Number, sss: Number, philhealth: Number, pagibig: Number,
            housing: Number, travel: Number, meal: Number, hazardPay: Number
        }
    }],
    createdAt: { type: Date, default: Date.now }
});

// Update the server index to prevent duplicates for the same month AND period
// Payroll.findOne({ month, period })

const Payroll = mongoose.model('Payroll', PayrollSchema);

// POST: Save entire payroll period
app.post('/api/payroll/save-period', async (req, res) => {
    try {
        // 1. Extract 'period' from req.body
        const { month, period, payrollRecords } = req.body;

        // Check for missing data (including period)
        if (!month || !period || !payrollRecords || payrollRecords.length === 0) {
            return res.status(400).json({ success: false, message: "Missing payroll data or period." });
        }

        // 2. Check for duplicates using BOTH month and period
        const existingPayroll = await Payroll.findOne({ month, period });
        if (existingPayroll) {
            return res.status(400).json({ 
                success: false, 
                message: `Payroll for ${month} (${period}) has already been saved.` 
            });
        }

        // 3. Calculate the total net
        const totalCompanyNet = payrollRecords.reduce((sum, rec) => sum + rec.netPay, 0);

        // 4. Create new record including the 'period'
        const newPayroll = new Payroll({
            month,
            period, // Added this to satisfy Schema requirement
            totalCompanyNet,
            records: payrollRecords
        });

        await newPayroll.save();

        // --- TRIGGER NOTIFICATION (Saving to DB and Broadcasting) ---
        const notifData = {
            title: "Payroll Finalized",
            message: `Payroll for ${month} (${period}) has been saved. Total: ₱${totalCompanyNet.toLocaleString()}`,
            type: 'PAYROLL'
        };
        
        const newNotif = new Notification(notifData);
        await newNotif.save();
        io.emit('new-notification', newNotif); 

        res.json({ 
            success: true, 
            message: "Payroll period saved successfully!",
            data: newPayroll 
        });

    } catch (error) {
        console.error("Server Error saving payroll:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
});

// GET: Load payroll for a specific month
app.get('/api/payroll/load-period', async (req, res) => {
    try {
        const { month } = req.query;
        const payroll = await Payroll.findOne({ month });

        if (!payroll) {
            return res.status(404).json({ success: false, message: "No payroll found for this month." });
        }

        res.json({ success: true, data: payroll });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error while loading payroll." });
    }
});




// Define the schema first
const shiftSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    date: { type: Date, required: true },
    shift: { type: String, required: true }, // morning, night, etc.
    department: { type: String },
    notes: { type: String },
}, { timestamps: true });

// Assign the model to a variable
const Shift = mongoose.model('Shift', shiftSchema);

const shiftSwapRequestSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    employeeName: String,
    colleagueId: { type: String, required: true },
    colleagueName: String,
    myShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    myShiftDate: { type: Date, required: true },
    myShiftLabel: { type: String, required: true },
    myShiftDepartment: String,
    myShiftNotes: String,
    colleagueShiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
    colleagueShiftDate: { type: Date, required: true },
    colleagueShiftLabel: { type: String, required: true },
    colleagueShiftDepartment: String,
    colleagueShiftNotes: String,
    reason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    approvedBy: String,
    rejectionReason: String
}, { timestamps: true });

const ShiftSwapRequest = mongoose.model('ShiftSwapRequest', shiftSwapRequestSchema, 'shiftSwapRequests');

// Leave Request Schema
const leaveRequestSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    employeeName: String,
    leaveType: { type: String, required: true, enum: ['vacation', 'sick', 'personal', 'emergency', 'maternity', 'paternity'] },
    duration: { type: String, required: true, enum: ['full', 'half-am', 'half-pm'] },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    approvedBy: String,
    rejectionReason: String,
    attachments: [{
        fileName: String,
        filePath: String,
        uploadedAt: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

// Time Correction Schema
const timeCorrectionSchema = new mongoose.Schema({
    employeeId: { type: String, required: true },
    employeeName: String,
    date: { type: String, required: true },
    correctionType: { type: String, required: true, enum: ['clock-in', 'clock-out', 'both', 'missed'] },
    correctClockIn: String,
    correctClockOut: String,
    reason: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    submittedAt: { type: Date, default: Date.now },
    approvedAt: Date,
    approvedBy: String,
    rejectionReason: String,
    recordId: String // Reference to the attendance record being corrected
}, { timestamps: true });

const TimeCorrection = mongoose.model('TimeCorrection', timeCorrectionSchema, 'timeCorrections');

// ===== LEAVE REQUEST ENDPOINTS =====

// 1️⃣ EMPLOYEE: Submit a leave request (first endpoint uses this comment)

// 2️⃣ ADMIN: Get all leave requests (optionally filtered by status)
app.get('/api/admin/leave-requests', async (req, res) => {
    try {
        const status = req.query.status || 'pending';
        const requests = await LeaveRequest.find({ status })
            .sort({ submittedAt: -1 });
        console.log(`✅ Fetching leave requests with status=${status}. Found:`, requests.length);
        res.json({ success: true, requests });
    } catch (err) {
        console.error('Fetch leave requests error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3️⃣ ADMIN: Get specific leave request
app.get('/api/admin/leave-requests/:id', async (req, res) => {
    try {
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });
        res.json({ success: true, request });
    } catch (err) {
        console.error('Fetch leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4️⃣ ADMIN: Approve leave request
app.put('/api/admin/leave-requests/approve/:id', async (req, res) => {
    try {
        const { adminId } = req.body;
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        await request.save();

        const notification = new Notification({
            title: 'Leave Request Approved',
            message: `Your ${request.leaveType} leave has been approved.`,
            type: 'success',
            recipientId: request.employeeId,
            recipientRole: 'employee',
            url: '/employee/pages/leave.html'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: 'Leave request approved', request });
    } catch (err) {
        console.error('Approve leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5️⃣ ADMIN: Reject leave request
app.put('/api/admin/leave-requests/reject/:id', async (req, res) => {
    try {
        const { adminId, rejectionReason } = req.body;
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

        request.status = 'rejected';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        request.rejectionReason = rejectionReason;
        await request.save();

        const notification = new Notification({
            title: 'Leave Request Rejected',
            message: `Your leave request was rejected. Reason: ${rejectionReason || 'No reason provided'}`,
            type: 'warning',
            recipientId: request.employeeId,
            recipientRole: 'employee'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: 'Leave request rejected', request });
    } catch (err) {
        console.error('Reject leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6️⃣ EMPLOYEE: Get leave request history
app.get('/api/employee/leave-requests/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const requests = await LeaveRequest.find({ employeeId: employeeId.toUpperCase() }).sort({ submittedAt: -1 });
        res.json({ success: true, requests });
    } catch (err) {
        console.error('Fetch leave history error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7️⃣ EMPLOYEE: Get leave balance
app.get('/api/employee/leave-balance/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const currentYear = new Date().getFullYear();

        const leaveAllocation = {
            'vacation': 15, 'sick': 10, 'personal': 3, 
            'emergency': 3, 'maternity': 60, 'paternity': 7
        };

        const approvedLeaves = await LeaveRequest.find({
            employeeId: employeeId.toUpperCase(),
            status: 'approved',
            startDate: { $gte: new Date(`${currentYear}-01-01`), $lte: new Date(`${currentYear}-12-31`) }
        });

        const usedDays = {};
        Object.keys(leaveAllocation).forEach(type => usedDays[type] = 0);

        approvedLeaves.forEach(leave => {
            const daysDiff = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            let leaveDays = (leave.duration === 'half-am' || leave.duration === 'half-pm') ? 0.5 : daysDiff;
            if (usedDays[leave.leaveType] !== undefined) usedDays[leave.leaveType] += leaveDays;
        });

        const balance = {};
        Object.keys(leaveAllocation).forEach(type => {
            const used = usedDays[type] || 0;
            balance[type] = { total: leaveAllocation[type], used, remaining: Math.max(0, leaveAllocation[type] - used) };
        });

        res.json({ success: true, balance, totalRemaining: Object.values(balance).reduce((sum, item) => sum + item.remaining, 0) });
    } catch (err) {
        console.error('Fetch leave balance error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ===== TIME CORRECTION ENDPOINTS =====

// 1️⃣ EMPLOYEE: Submit time correction request
app.post('/api/employee/submit-time-correction', async (req, res) => {
    try {
        const { employeeId, date, type, correctClockIn, correctClockOut, reason, recordId } = req.body;

        if (!employeeId || !date || !type || !reason) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        // Get employee name
        let employeeName = '';
        const collections = ['doctors', 'nurses', 'guards', 'staffs', 'admins', 'accountings'];
        for (const collection of collections) {
            const emp = await mongoose.connection.db.collection(collection).findOne({ employeeId: employeeId.toUpperCase() });
            if (emp) {
                employeeName = emp.fullName || `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
                break;
            }
        }

        const correction = new TimeCorrection({
            employeeId: employeeId.toUpperCase(),
            employeeName,
            date,
            correctionType: type,
            correctClockIn,
            correctClockOut,
            reason,
            recordId
        });

        await correction.save();

        // Create notification for admin
        const notification = new Notification({
            title: 'New Time Correction Request',
            message: `${employeeName} submitted a time correction request for ${date}`,
            type: 'info',
            recipientId: 'admin',
            recipientRole: 'admin',
            url: '/admin/index.html'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: 'Time correction request submitted successfully', correctionId: correction._id });
    } catch (err) {
        console.error('Submit time correction error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2️⃣ ADMIN: Get pending time corrections
app.get('/api/admin/pending-time-corrections', async (req, res) => {
    try {
        const corrections = await TimeCorrection.find({ status: 'pending' })
            .sort({ submittedAt: -1 });
        res.json({ success: true, corrections });
    } catch (err) {
        console.error('Fetch pending time corrections error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3️⃣ ADMIN: Get recent time corrections (approved/rejected)
app.get('/api/admin/recent-time-corrections', async (req, res) => {
    try {
        const corrections = await TimeCorrection.find({ 
            status: { $in: ['approved', 'rejected'] } 
        })
        .sort({ approvedAt: -1 })
        .limit(10);
        res.json(corrections);
    } catch (err) {
        console.error('Fetch recent time corrections error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4️⃣ ADMIN: Approve time correction
app.put('/api/admin/time-correction/:id', async (req, res) => {
    try {
        const { action, adminId, rejectionReason } = req.body;
        const correction = await TimeCorrection.findById(req.params.id);
        
        if (!correction) {
            return res.status(404).json({ success: false, message: 'Time correction not found' });
        }

        if (action === 'approve') {
            correction.status = 'approved';
            correction.approvedAt = new Date();
            correction.approvedBy = adminId;

            // Update the attendance record if recordId exists
            if (correction.recordId) {
                const attendanceRecord = await Attendance.findById(correction.recordId);
                if (attendanceRecord) {
                    if (correction.correctionType === 'clock-in' || correction.correctionType === 'both') {
                        attendanceRecord.checkIn = correction.correctClockIn;
                    }
                    if (correction.correctionType === 'clock-out' || correction.correctionType === 'both') {
                        attendanceRecord.checkOut = correction.correctClockOut;
                    }
                    // Recalculate duration if both times are present
                    if (attendanceRecord.checkIn && attendanceRecord.checkOut) {
                        const checkInTime = new Date(`1970-01-01T${attendanceRecord.checkIn}:00`);
                        const checkOutTime = new Date(`1970-01-01T${attendanceRecord.checkOut}:00`);
                        const diffMs = checkOutTime - checkInTime;
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        attendanceRecord.duration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                    }
                    await attendanceRecord.save();
                }
            }
        } else if (action === 'reject') {
            correction.status = 'rejected';
            correction.approvedAt = new Date();
            correction.approvedBy = adminId;
            correction.rejectionReason = rejectionReason;
        }

        await correction.save();

        // Create notification for employee
        const notification = new Notification({
            title: `Time Correction ${action === 'approve' ? 'Approved' : 'Rejected'}`,
            message: `Your time correction request for ${correction.date} has been ${action === 'approve' ? 'approved' : 'rejected'}.`,
            type: action === 'approve' ? 'success' : 'warning',
            recipientId: correction.employeeId,
            recipientRole: 'employee',
            url: '/employee/pages/attendance.html'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: `Time correction ${action}d`, correction });
    } catch (err) {
        console.error('Time correction action error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Now your routes can use Shift
app.post('/api/shifts/assign', async (req, res) => {
    try {
        const { employeeId, date, shift, department, notes } = req.body;

        if (!employeeId || !date || !shift) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const parsedDate = new Date(date + 'T00:00:00Z');
        const start = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));

        const existing = await Shift.findOne({
            employeeId,
            date: { $gte: start, $lte: end }
        });

        if (existing) {
            existing.shift = shift;
            existing.department = department;
            existing.notes = notes;
            await existing.save();
        } else {
            await Shift.create({ employeeId, date: parsedDate, shift, department, notes });
        }

        res.json({ success: true, message: 'Shift saved successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});
app.get('/api/shifts', async (req, res) => {
    try {
        const { month, year } = req.query;

        let query = {};
        if (month && year) {
            const start = new Date(Date.UTC(Number(year), Number(month) - 1, 1, 0, 0, 0, 0));
            const end = new Date(Date.UTC(Number(year), Number(month) - 1, new Date(Number(year), Number(month), 0).getDate(), 23, 59, 59, 999));
            query.date = { $gte: start, $lte: end };
        }

        const shifts = await Shift.find(query);
        res.json({ success: true, shifts });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET shifts for a specific employee
app.get('/api/shifts/employee/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query;
        let query = { employeeId };

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 1);
            query.date = { $gte: start, $lt: end };
        }

        const shifts = await Shift.find(query).sort({ date: 1 });
        res.json({ success: true, shifts });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.post('/api/employee/submit-shift-swap', async (req, res) => {
    try {
        const {
            employeeId,
            employeeName,
            colleagueId,
            colleagueName,
            myShiftId,
            myShiftDate,
            myShiftLabel,
            myShiftDepartment,
            myShiftNotes,
            colleagueShiftId,
            colleagueShiftDate,
            colleagueShiftLabel,
            colleagueShiftDepartment,
            colleagueShiftNotes,
            reason
        } = req.body;

        if (!employeeId || !colleagueId || !myShiftId || !colleagueShiftId) {
            return res.status(400).json({ success: false, message: 'Missing required request data' });
        }

        const request = new ShiftSwapRequest({
            employeeId: employeeId.toUpperCase(),
            employeeName,
            colleagueId: colleagueId.toUpperCase(),
            colleagueName,
            myShiftId,
            myShiftDate,
            myShiftLabel,
            myShiftDepartment,
            myShiftNotes,
            colleagueShiftId,
            colleagueShiftDate,
            colleagueShiftLabel,
            colleagueShiftDepartment,
            colleagueShiftNotes,
            reason,
            status: 'pending'
        });

        await request.save();

        const adminNotification = new Notification({
            title: 'Shift Swap Request',
            message: `Shift swap requested by ${employeeName || employeeId}.`,
            type: 'info',
            recipientRole: 'admin',
            url: '/admin/pages/dashboard.html'
        });
        await adminNotification.save();
        io.emit('new-notification', adminNotification);

        res.json({ success: true, message: 'Shift swap request submitted.' });
    } catch (err) {
        console.error('Shift swap submit error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/shift-swap-requests', async (req, res) => {
    try {
        const requests = await ShiftSwapRequest.find({ status: 'pending' }).sort({ submittedAt: -1 });
        res.json({ success: true, requests });
    } catch (err) {
        console.error('Fetch swap requests error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.get('/api/admin/shift-swap-requests/:id', async (req, res) => {
    try {
        const request = await ShiftSwapRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
        res.json({ success: true, request });
    } catch (err) {
        console.error('Fetch swap request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/shift-swap-requests/approve/:id', async (req, res) => {
    try {
        const { adminId } = req.body;
        const request = await ShiftSwapRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Swap request not found' });

        const myShiftDate = request.myShiftDate ? new Date(request.myShiftDate) : null;
        const colleagueShiftDate = request.colleagueShiftDate ? new Date(request.colleagueShiftDate) : null;

        let myShift = null;
        let colleagueShift = null;

        if (request.myShiftId) {
            myShift = await Shift.findById(request.myShiftId);
        }
        if (!myShift && myShiftDate) {
            const myShiftStart = new Date(myShiftDate.getTime());
            myShiftStart.setHours(0, 0, 0, 0);
            const myShiftEnd = new Date(myShiftDate.getTime());
            myShiftEnd.setHours(23, 59, 59, 999);
            myShift = await Shift.findOne({
                employeeId: request.employeeId,
                date: { $gte: myShiftStart, $lte: myShiftEnd }
            });
        }

        if (request.colleagueShiftId) {
            colleagueShift = await Shift.findById(request.colleagueShiftId);
        }
        if (!colleagueShift && colleagueShiftDate) {
            const colleagueShiftStart = new Date(colleagueShiftDate.getTime());
            colleagueShiftStart.setHours(0, 0, 0, 0);
            const colleagueShiftEnd = new Date(colleagueShiftDate.getTime());
            colleagueShiftEnd.setHours(23, 59, 59, 999);
            colleagueShift = await Shift.findOne({
                employeeId: request.colleagueId,
                date: { $gte: colleagueShiftStart, $lte: colleagueShiftEnd }
            });
        }

        if (myShift) {
            console.log(`Before update for ${request.employeeId}: employeeId=${myShift.employeeId}, shift=${myShift.shift}, date=${myShift.date}`);
            myShift.employeeId = request.colleagueId;
            // Keep shift type and date the same
            await myShift.save();
            console.log(`Updated shift for ${request.employeeId} -> ${myShift.employeeId} on ${myShift.date}: ${myShift.shift}`);
        } else {
            // If no shift found, create one for the colleague on the employee's date
            const newShiftData = {
                employeeId: request.colleagueId,
                date: myShiftDate || request.myShiftDate,
                shift: request.myShiftLabel, // Keep the employee's shift type
                department: request.myShiftDepartment || '',
                notes: request.myShiftNotes || ''
            };
            await Shift.create(newShiftData);
            console.log(`Created new shift for ${newShiftData.employeeId} on ${newShiftData.date}: ${newShiftData.shift}`);
        }

        if (colleagueShift) {
            console.log(`Before update for ${request.colleagueId}: employeeId=${colleagueShift.employeeId}, shift=${colleagueShift.shift}, date=${colleagueShift.date}`);
            colleagueShift.employeeId = request.employeeId;
            // Keep shift type and date the same
            await colleagueShift.save();
            console.log(`Updated shift for ${request.colleagueId} -> ${colleagueShift.employeeId} on ${colleagueShift.date}: ${colleagueShift.shift}`);
        } else {
            // If no shift found, create one for the employee on the colleague's date
            const newShiftData = {
                employeeId: request.employeeId,
                date: colleagueShiftDate || request.colleagueShiftDate,
                shift: request.colleagueShiftLabel, // Keep the colleague's shift type
                department: request.colleagueShiftDepartment || '',
                notes: request.colleagueShiftNotes || ''
            };
            await Shift.create(newShiftData);
            console.log(`Created new shift for ${newShiftData.employeeId} on ${newShiftData.date}: ${newShiftData.shift}`);
        }

        console.log('Shift swap approved: Database changes completed.');

        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        await request.save();

        // Get roles for notifications
        const employeeUser = await User.findOne({ employeeId: request.employeeId });
        const colleagueUser = await User.findOne({ employeeId: request.colleagueId });

        const notification1 = new Notification({
            title: 'Shift Swap Approved',
            message: `Your shift swap with ${request.colleagueName || request.colleagueId} has been approved.`,
            type: 'shift-swap',
            recipientId: request.employeeId,
            recipientRole: 'employee',
            url: '/employee/pages/schedule.html'
        });
        const notification2 = new Notification({
            title: 'Shift Swap Approved',
            message: `Your shift swap with ${request.employeeName || request.employeeId} has been approved.`,
            type: 'shift-swap',
            recipientId: request.colleagueId,
            recipientRole: 'employee',
            url: '/employee/pages/schedule.html'
        });
        await notification1.save();
        await notification2.save();

        io.emit('new-notification', notification1);
        io.emit('new-notification', notification2);

        res.json({ success: true, message: 'Swap approved and schedule updated' });
    } catch (err) {
        console.error('Approve swap request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admin/shift-swap-requests/reject/:id', async (req, res) => {
    try {
        const { adminId, rejectionReason } = req.body;
        const request = await ShiftSwapRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Swap request not found' });

        request.status = 'rejected';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        request.rejectionReason = rejectionReason;
        await request.save();

        const notification = new Notification({
            title: 'Shift Swap Rejected',
            message: `Your shift swap request was rejected. ${rejectionReason || ''}`,
            type: 'warning',
            recipientId: request.employeeId,
            recipientRole: 'employee'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: 'Swap request rejected' });
    } catch (err) {
        console.error('Reject swap request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ---------------------------
// 1️⃣ Check if employee already has a shift on a given date
// Place this BEFORE the /:id route!
// ---------------------------
app.get('/api/shifts/check', async (req, res) => {
    try {
        const { employeeId, date } = req.query;

        if (!employeeId || !date) {
            return res.status(400).json({ success: false, message: 'Missing employeeId or date' });
        }

        // Normalize to full day
        const parsedDate = new Date(date + 'T00:00:00Z');
        const startOfDay = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), parsedDate.getUTCDate(), 23, 59, 59, 999));

        const exists = await Shift.findOne({
            employeeId,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({ success: true, exists: !!exists });
    } catch (err) {
        console.error('Error checking shift:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---------------------------
// 2️⃣ Get single shift details by ID
// Must come AFTER /check to avoid conflicts
// ---------------------------
app.get('/api/shifts/:id', async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.id);
        if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });
        res.json({ success: true, shift });
    } catch (err) {
        console.error('Error fetching shift:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ---------------------------
// 3️⃣ Update shift (drag-and-drop)
// ---------------------------
app.put('/api/shifts/:id', async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

        // Check if employee already has a shift on the new date
        const shiftToMove = await Shift.findById(req.params.id);
        if (!shiftToMove) return res.status(404).json({ success: false, message: 'Shift not found' });

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const exists = await Shift.findOne({
            employeeId: shiftToMove.employeeId,
            date: { $gte: startOfDay, $lte: endOfDay },
            _id: { $ne: shiftToMove._id } // ignore the shift being moved
        });

        if (exists) {
            return res.status(400).json({ success: false, message: 'Employee already has a shift on this date' });
        }

        // Update the shift date
        shiftToMove.date = new Date(date);
        await shiftToMove.save();

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating shift:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// ===== Attendance Archive Schema (INLINE) =====
const attendanceArchiveSchema = new mongoose.Schema({
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    records: { type: Array, default: [] }
}, { timestamps: true });

const AttendanceArchive = mongoose.model('AttendanceArchive', attendanceArchiveSchema);
// ===== SAVE ATTENDANCE BY DATE =====
app.post('/api/attendance/save-date', async (req, res) => {
    try {
        const { date, records } = req.body;

        if (!date || !records) {
            return res.json({ success: false, message: "Missing data" });
        }

        // Optional debug
        console.log("Saving attendance for:", date);
        console.log("Records count:", records.length);

        // Check if attendance already exists for this date
        const existing = await AttendanceArchive.findOne({ date });

        // Upsert (create or overwrite)
        const saved = await AttendanceArchive.findOneAndUpdate(
            { date },
            { records },
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            overwritten: !!existing, // <-- tells frontend if this is an overwrite
            message: "Attendance saved successfully",
            data: saved
        });

    } catch (err) {
        console.error("SAVE ATTENDANCE ERROR:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ===== LOAD ATTENDANCE BY DATE =====
// ===== GET AVAILABLE DATES WITH ATTENDANCE DATA =====
app.get('/api/attendance/available-dates', async (req, res) => {
    try {
        // Get all unique dates from Attendance collection
        const dates = await Attendance.distinct('date');
        
        // Sort dates in descending order (newest first)
        dates.sort().reverse();

        res.json({
            success: true,
            dates: dates || []
        });

    } catch (err) {
        console.error("AVAILABLE DATES ERROR:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get('/api/attendance/load-date', async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.json({ success: false, message: "Date is required" });
        }

        console.log("Loading attendance for:", date);

        // Query the Attendance collection for all records matching the date
        const records = await Attendance.find({ date });

        if (!records || records.length === 0) {
            return res.json({
                success: false,
                message: "No attendance found for this date"
            });
        }

        res.json({
            success: true,
            data: {
                date,
                records
            }
        });

    } catch (err) {
        console.error("LOAD ATTENDANCE ERROR:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// ===== DELETE SAVED ATTENDANCE =====
app.delete('/api/attendance/delete-date', async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.json({ success: false, message: "Date required" });
        }

        await AttendanceArchive.deleteOne({ date });

        res.json({ success: true, message: "Deleted successfully" });

    } catch (err) {
        console.error("DELETE ERROR:", err);
        res.status(500).json({ success: false });
    }
});




app.get('/api/payroll/calculate-all', async (req, res) => {
    try {
        const { startDate, endDate } = req.query; 
        const Attendance = mongoose.model('Attendance');
        const Shift = mongoose.model('Shift');

        let attendanceQuery = {};
        let shiftQuery = {};

        if (startDate && endDate) {
            attendanceQuery.date = { $gte: startDate, $lte: endDate };
            const start = new Date(`${startDate}T00:00:00Z`);
            const end = new Date(`${endDate}T23:59:59Z`);
            shiftQuery.date = { $gte: start, $lte: end };
        }

        const allRecords = await Attendance.find(attendanceQuery);
        const allShifts = await Shift.find(shiftQuery);

        const shiftLookup = allShifts.reduce((acc, shift) => {
            const shiftDate = shift.date.toISOString().split('T')[0];
            if (!acc[shift.employeeId]) acc[shift.employeeId] = new Set();
            acc[shift.employeeId].add(shiftDate);
            return acc;
        }, {});

        const groupedByEmployee = allRecords.reduce((acc, record) => {
            if (!acc[record.empId]) acc[record.empId] = [];
            acc[record.empId].push(record);
            return acc;
        }, {});

        const LATE_GRACE_PERIOD = "08:15 AM";
        const payrollSummary = [];

        for (const empId in groupedByEmployee) {
            let totalPayableDays = 0;
            let totalWorkHours = 0;
            let lateCount = 0;
            const uniqueDates = new Set();
            const records = groupedByEmployee[empId];

            records.forEach(record => {
                if (!record.checkIn || !record.checkOut || !record.date) return;
                const employeeShiftDays = shiftLookup[record.empId];
                if (!employeeShiftDays || !employeeShiftDays.has(record.date)) return;

                uniqueDates.add(record.date);

                const checkInTime = moment(record.checkIn, "hh:mm A");
                const checkOutTime = moment(record.checkOut, "hh:mm A");
                const lateThreshold = moment(LATE_GRACE_PERIOD, "hh:mm A");

                if (checkOutTime.isBefore(checkInTime)) checkOutTime.add(1, 'day');

                const actualHours = moment.duration(checkOutTime.diff(checkInTime)).asHours();
                const cappedHours = Math.min(actualHours, 8);
                totalWorkHours += cappedHours;

                if (cappedHours >= 8) {
                    totalPayableDays += 1;
                } else if (cappedHours >= 4) {
                    totalPayableDays += 0.5;
                }

                if (checkInTime.isAfter(lateThreshold)) lateCount++;
            });

            payrollSummary.push({
                empId: empId,
                employeeName: records[0].name || "N/A",
                multiplier: uniqueDates.size,
                payableDays: totalPayableDays,
                totalWorkHours: parseFloat(totalWorkHours.toFixed(2)),
                totalLates: lateCount
            });
        }

        res.json(payrollSummary);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE a shift by ID
app.delete('/api/shifts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Using Mongoose findByIdAndDelete as an example
        const deletedShift = await Shift.findByIdAndDelete(id);

        if (!deletedShift) {
            return res.status(404).json({ 
                success: false, 
                message: 'Shift not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Shift deleted successfully' 
        });
    } catch (err) {
        console.error('Error deleting shift:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error' 
        });
    }
});






// CRITICAL: Ngrok Bypass Middleware 
// This prevents the "browser warning" page from blocking your Google Form POST request
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
});

// 1. Mongoose Schema & Model
const SurveySchema = new mongoose.Schema({
  email: { type: String, required: true },
  technical_skill: Number,
  task_completion: Number,
  teamwork: Number,
  achievements: String,
  challenges: String,
  next_goal: String,
  average_score: Number,
  percentage_score: Number,
  performance_level: String,
  submittedAt: { type: Date, default: Date.now }
});

const SurveyResponse = mongoose.model('SurveyResponse', SurveySchema);

// Monthly Archive Schema
const performanceArchiveSchema = new mongoose.Schema({
    empId: { type: String, required: true },
    email: { type: String },
    month: Number,
    year: Number,
    attendance: Object,
    kpi: Object,
    survey: Object,
    createdAt: { type: Date, default: Date.now }
});
const PerformanceArchive = mongoose.model('PerformanceArchive', performanceArchiveSchema);

// 2. The POST Route
app.post('/api/survey-response', async (req, res) => {
    try {
        const { technical_skill, task_completion, teamwork } = req.body;

        // 1. Calculate Averages and Percentages
        const avg = (technical_skill + task_completion + teamwork) / 3;
        const percentage = ((avg / 5) * 100).toFixed(0);

        // 2. Determine Performance Level for the UI Badges
        let level = "Satisfactory";
        if (percentage >= 90) level = "Excellent";
        else if (percentage >= 75) level = "Very Good";
        else if (percentage < 50) level = "Needs Improvement";

        // 3. Create the document based on your Schema
        const newSurvey = new SurveyResponse({
            ...req.body,
            average_score: avg.toFixed(2),
            percentage_score: Number(percentage),
            performance_level: level
        });

        await newSurvey.save();
        console.log(`Success: Data saved for ${req.body.email}`);
        res.status(201).json({ message: "Performance Data Saved Successfully" });

    } catch (err) {
        console.error("Error saving survey:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// GET Survey Response by Email (Latest)
app.get('/api/survey-response', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ error: "Email parameter required" });
        }

        const survey = await SurveyResponse.findOne({ email: email })
            .sort({ submittedAt: -1 })
            .exec();

        if (!survey) {
            return res.status(404).json({ message: "No survey found for this email" });
        }

        res.json(survey);
    } catch (err) {
        console.error("Error fetching survey:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// ---------------------------
// LEAVE REQUEST ROUTES
// ---------------------------

// Submit leave request (Employee)
app.post('/api/employee/submit-leave-request', upload.array('attachments', 5), async (req, res) => {
    try {
        const { employeeId, leaveType, duration, startDate, endDate, reason } = req.body;

        if (!employeeId || !leaveType || !duration || !startDate || !endDate || !reason) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Get employee name
        const user = await User.findOne({ employeeId });
        let employeeName = employeeId;
        if (user) {
            // Try to get full name from role-specific collections
            const collections = [Admin, Doctor, Nurse, Guard, Staff, Accounting];
            for (const collection of collections) {
                try {
                    const profile = await collection.findOne({ employeeId });
                    if (profile) {
                        employeeName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || employeeId;
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }
        }

        // Handle file attachments
        const attachments = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                attachments.push({
                    fileName: file.originalname,
                    filePath: file.path
                });
            });
        }

        const leaveRequest = new LeaveRequest({
            employeeId,
            employeeName,
            leaveType,
            duration,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason,
            status: 'pending', // Status must be 'pending' until admin approves
            submittedAt: new Date(),
            attachments
        });

        await leaveRequest.save();

        // Create notification for admin
        const adminNotification = new Notification({
            title: 'New Leave Request',
            message: `${employeeName} submitted a ${leaveType} leave request (pending approval).`,
            type: 'warning',
            recipientRole: 'admin',
            url: '/admin/pages/dashboard.html'
        });
        await adminNotification.save();
        io.emit('new-notification', adminNotification);

        res.json({ success: true, message: 'Leave request submitted successfully. Pending admin approval.' });
    } catch (err) {
        console.error('Submit leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Approve leave request (Admin)
app.put('/api/admin/leave-requests/approve/:id', async (req, res) => {
    try {
        console.log('🔵 APPROVE LEAVE REQUEST:', req.params.id);
        
        // 1. Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error('❌ Invalid ObjectId:', req.params.id);
            return res.status(400).json({ success: false, message: 'Invalid leave request ID format' });
        }

        const { adminId } = req.body;
        console.log('Admin ID:', adminId);
        
        // 2. Find the Leave Request
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

        // 3. Fetch the Employee's actual position/role from role-specific collections
        let employeePosition = 'Staff/entry-level';
        const collections = [Admin, Doctor, Nurse, Guard, Staff, Accounting];
        for (const collection of collections) {
            try {
                const profile = await collection.findOne({ employeeId: request.employeeId });
                if (profile) {
                    employeePosition = profile.position || 'Staff/entry-level';
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        // 4. Update leave request status
        request.status = 'approved';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        await request.save();
        console.log('✅ Leave request approved:', request._id, 'Status:', request.status);

        const startDate = new Date(request.startDate);
        const endDate = new Date(request.endDate);
        const employeeId = request.employeeId;
        
        console.log('📅 UPDATING SHIFTS & ATTENDANCE for', employeeId, 'from', startDate, 'to', endDate);
        let recordsUpdated = 0;

        // 5. Loop through each day of the leave period
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            const currentDate = new Date(date);
            const dateString = currentDate.toISOString().split('T')[0];

            // Update Shift status
            const startOfDay = new Date(currentDate.getTime());
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(currentDate.getTime());
            endOfDay.setHours(23, 59, 59, 999);

            const existingShift = await Shift.findOne({
                employeeId,
                date: { $gte: startOfDay, $lte: endOfDay }
            });

            if (existingShift) {
                existingShift.shift = `${request.leaveType}-leave`;
                existingShift.notes = `On ${request.leaveType} leave (${request.duration})`;
                await existingShift.save();
                console.log('✏️ Updated existing shift for', dateString);
                recordsUpdated++;
            } else {
                // CREATE new shift if none exists
                const newShift = new Shift({
                    employeeId,
                    date: currentDate,
                    shift: `${request.leaveType}-leave`,
                    notes: `On ${request.leaveType} leave (${request.duration})`,
                    department: employeePosition
                });
                await newShift.save();
                console.log('✅ Created NEW shift for', dateString);
                recordsUpdated++;
            }

            // 6. Define Attendance values based on duration
            let checkIn = "08:00 AM";
            let checkOut = "04:00 PM";
            let durationStr = "8.0h";

            if (request.duration === 'half-am') {
                checkIn = "08:00 AM";
                checkOut = "12:00 PM";
                durationStr = "4.0h";
            } else if (request.duration === 'half-pm') {
                checkIn = "01:00 PM";
                checkOut = "05:00 PM";
                durationStr = "4.0h";
            }

            const leaveStatusLabel = `${request.leaveType.charAt(0).toUpperCase() + request.leaveType.slice(1)} Leave`;

            // 7. Create or update attendance record
            await Attendance.findOneAndUpdate(
                { empId: employeeId, date: dateString },
                {
                    empId: employeeId,
                    name: request.employeeName,
                    initials: request.employeeName.split(' ').map(n => n[0]).join('').toUpperCase(),
                    role: employeePosition,
                    date: dateString,
                    checkIn: checkIn,
                    checkOut: checkOut,
                    duration: durationStr,
                    status: leaveStatusLabel,
                    color: "bg-amber-500"
                },
                { upsert: true, new: true }
            );
            console.log('📝 Updated attendance for', dateString, 'Status:', leaveStatusLabel);
        }

        console.log('✅ COMPLETE: Updated', recordsUpdated, 'shift records and attendance entries');

        // 8. Create and Send Notification
        const notification = new Notification({
            title: 'Leave Request Approved',
            message: `Your ${request.leaveType} leave request has been approved. Your shifts and attendance have been automatically updated.`,
            type: 'success',
            recipientId: employeeId,
            recipientRole: 'employee',
            url: '/employee/pages/leave.html'
        });
        await notification.save();
        
        // If using Socket.io
        if (typeof io !== 'undefined') {
            io.emit('new-notification', notification);
        }

        res.status(200).json({ 
            success: true, 
            message: `Leave request approved! Updated ${recordsUpdated} shift and attendance records.`,
            details: {
                employeeId,
                leaveType: request.leaveType,
                startDate,
                endDate,
                recordsUpdated
            }
        });
        console.log('✅ RESPONSE SENT: Leave approved successfully');

    } catch (err) {
        console.error('❌ Approve leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Reject leave request (Admin)
app.put('/api/admin/leave-requests/reject/:id', async (req, res) => {
    try {
        console.log('🔴 REJECT LEAVE REQUEST:', req.params.id);
        
        // Validate that the ID is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            console.error('❌ Invalid ObjectId:', req.params.id);
            return res.status(400).json({ success: false, message: 'Invalid leave request ID format' });
        }

        const { adminId, rejectionReason } = req.body;
        const request = await LeaveRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ success: false, message: 'Leave request not found' });

        request.status = 'rejected';
        request.approvedAt = new Date();
        request.approvedBy = adminId;
        request.rejectionReason = rejectionReason;
        await request.save();
        console.log('✅ Leave request rejected:', request._id, 'Reason:', rejectionReason);

        // Create notification for employee
        const notification = new Notification({
            title: 'Leave Request Rejected',
            message: `Your ${request.leaveType} leave request was rejected. Reason: ${rejectionReason || 'No reason provided'}`,
            type: 'warning',
            recipientId: request.employeeId,
            recipientRole: 'employee',
            url: '/employee/pages/leave.html'
        });
        await notification.save();
        io.emit('new-notification', notification);

        res.json({ success: true, message: 'Leave request rejected successfully' });
    } catch (err) {
        console.error('❌ Reject leave request error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get employee leave balance
app.get('/api/employee/leave-balance/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        // Calculate used leave days from approved leave requests in current year
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear + 1, 0, 1);
        
        const approvedLeaves = await LeaveRequest.find({
            employeeId,
            status: 'approved',
            startDate: { $gte: yearStart, $lt: yearEnd }
        });
        
        let usedDays = 0;
        approvedLeaves.forEach(leave => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
            
            // Adjust for half days
            if (leave.duration === 'half-am' || leave.duration === 'half-pm') {
                usedDays += 0.5;
            } else {
                usedDays += days;
            }
        });
        
        const balance = {
            used: usedDays,
            total: 15, // 15 days total leave per year
            remaining: 15 - usedDays
        };
        
        res.json({ success: true, balance });
    } catch (err) {
        console.error('Fetch employee leave balance error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});


// Get full historical performance: attendance + survey + archived monthly snapshots
app.get('/api/performance/history/:empId', async (req, res) => {
    try {
        const { empId } = req.params;
        const user = await User.findOne({ employeeId: empId }).lean();
        const email = user?.email || null;

        const surveys = email ? await SurveyResponse.find({ email }).sort({ submittedAt: -1 }).lean() : [];
        const archives = await PerformanceArchive.find({ empId }).sort({ year: -1, month: -1 }).lean();

        const attendanceRecord = await Attendance.aggregate([
            { $match: { empId } },
            {
                $addFields: {
                    parsedDuration: {
                        $cond: {
                            if: { $regexMatch: { input: '$duration', regex: ' ' } }, // Check if contains space (Xh Ym format)
                            then: {
                                $let: {
                                    vars: {
                                        hoursStr: { $arrayElemAt: [{ $split: ['$duration', 'h '] }, 0] },
                                        minsStr: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ['$duration', 'h '] }, 1] }, 'm'] }, 0] }
                                    },
                                    in: {
                                        $add: [
                                            { $toDouble: '$$hoursStr' },
                                            { $divide: [{ $toDouble: '$$minsStr' }, 60] }
                                        ]
                                    }
                                }
                            },
                            else: { $toDouble: { $trim: { input: '$duration', chars: 'h' } } } // X.Yh format
                        }
                    }
                }
            },
            {
                $group: {
                    _id: "$empId",
                    presentDays: { $sum: 1 },
                    totalHours: { $sum: '$parsedDuration' },
                    avgDuration: { $avg: '$parsedDuration' },
                    lateCount: { $sum: { $cond: [{ $gt: ["$checkIn", "09:00"] }, 1, 0] } }
                }
            }
        ]);

        res.json({
            empId,
            email,
            attendance: attendanceRecord[0] || null,
            surveyHistory: surveys,
            reviewHistory: surveys.map(s => ({
                date: s.submittedAt,
                rating: s.average_score,
                level: s.performance_level,
                notes: s.achievements
            })),
            archive: archives
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/performance/kpi/:empId', async (req, res) => {
    try {
        const { empId } = req.params;
        const user = await User.findOne({ employeeId: empId }).lean();
        const email = user?.email || null;

        const latestSurvey = email ? await SurveyResponse.findOne({ email }).sort({ submittedAt: -1 }).lean() : null;
        const surveyHistory = email ? await SurveyResponse.find({ email }).sort({ submittedAt: -1 }).lean() : [];

        const targetDays = 22;
        const targetHours = 9;

        const stats = await Attendance.aggregate([
            { $match: { empId: empId } },
            {
                $addFields: {
                    parsedDuration: {
                        $cond: {
                            if: { $regexMatch: { input: '$duration', regex: ' ' } }, // Check if contains space (Xh Ym format)
                            then: {
                                $let: {
                                    vars: {
                                        hoursStr: { $arrayElemAt: [{ $split: ['$duration', 'h '] }, 0] },
                                        minsStr: { $arrayElemAt: [{ $split: [{ $arrayElemAt: [{ $split: ['$duration', 'h '] }, 1] }, 'm'] }, 0] }
                                    },
                                    in: {
                                        $add: [
                                            { $toDouble: '$$hoursStr' },
                                            { $divide: [{ $toDouble: '$$minsStr' }, 60] }
                                        ]
                                    }
                                }
                            },
                            else: { $toDouble: { $trim: { input: '$duration', chars: 'h' } } } // X.Yh format
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$empId',
                    presentDays: { $sum: 1 },
                    totalDuration: { $sum: '$parsedDuration' },
                    avgDuration: { $avg: '$parsedDuration' },
                    lateCount: { $sum: { $cond: [{ $gt: ['$checkIn', '09:00'] }, 1, 0] } },
                    overtimeHours: { $sum: { $max: [0, { $subtract: ['$parsedDuration', targetHours] }] } }
                }
            },
            {
                $project: {
                    _id: 0,
                    empId: '$_id',
                    presentDays: 1,
                    avgDuration: { $round: ['$avgDuration', 1] },
                    totalHours: { $round: ['$totalDuration', 1] },
                    overtimeHours: { $round: ['$overtimeHours', 1] },
                    lateCount: 1,
                    attendanceRate: {
                        $round: [{ $min: [100, { $multiply: [{ $divide: ['$presentDays', targetDays] }, 100] }] }, 1]
                    },
                    workIntensity: {
                        $round: [{ $min: [100, { $multiply: [{ $divide: ['$avgDuration', targetHours] }, 100] }] }, 1]
                    },
                    punctualityRate: {
                        $round: [{ $multiply: [{ $divide: [{ $subtract: ['$presentDays', '$lateCount'] }, '$presentDays'] }, 100] }, 1]
                    }
                }
            }
        ]);

        const attendance = stats[0] || {
            empId,
            presentDays: 0,
            avgDuration: 0,
            totalHours: 0,
            overtimeHours: 0,
            lateCount: 0,
            attendanceRate: 0,
            workIntensity: 0,
            punctualityRate: 0
        };

        let kpiScore = Math.round(attendance.attendanceRate);
        let overallScore = Math.round(attendance.attendanceRate);
        let reviewRating = 0;
        let performanceLevel = 'No Data';
        let lastUpdated = 'N/A';

        if (latestSurvey) {
            const surveyPct = Number(latestSurvey.percentage_score || 0);
            const surveyAvg = Number(latestSurvey.average_score || 0);

            kpiScore = Math.round(surveyPct);
            reviewRating = surveyAvg;
            overallScore = Math.round((surveyPct * 0.8) + (attendance.attendanceRate * 0.2));
            performanceLevel = latestSurvey.performance_level || 'Satisfactory';
            lastUpdated = latestSurvey.submittedAt ? latestSurvey.submittedAt.toISOString().split('T')[0] : 'N/A';
        } else {
            if (overallScore >= 90) performanceLevel = 'Excellent';
            else if (overallScore >= 75) performanceLevel = 'Very Good';
            else if (overallScore >= 60) performanceLevel = 'Good';
            else if (overallScore >= 40) performanceLevel = 'Satisfactory';
            else performanceLevel = 'Needs Improvement';
        }

        res.json({
            ...attendance,
            empId,
            email,
            survey: latestSurvey || null,
            surveyHistory,
            kpiScore,
            overallScore,
            reviewRating,
            performanceLevel,
            lastUpdated
        });
    } catch (err) {
        res.status(500).json({ message: 'Error calculating KPIs', error: err.message });
    }
});

app.post('/api/performance/archive', async (req, res) => {
    try {
        const { empId, month, year } = req.body;
        if (!empId || !month || !year) return res.status(400).json({ error: 'empId, month, year required' });

        const kpiResponse = await fetch(`${req.protocol}://${req.get('host')}/api/performance/kpi/${empId}`);
        const kpiData = await kpiResponse.json();

        const user = await User.findOne({ employeeId: empId }).lean();
        const email = user?.email || null;

        const archive = new PerformanceArchive({
            empId,
            email,
            month,
            year,
            attendance: kpiData,
            kpi: {
                overallScore: kpiData.overallScore,
                kpiScore: kpiData.kpiScore,
                reviewRating: kpiData.reviewRating,
                performanceLevel: kpiData.performanceLevel
            },
            survey: kpiData.survey
        });

        await archive.save();
        res.json({ success: true, archive });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    } 
});



const PORT = process.env.PORT || 3000;





// ==============================
// TOP PERFORMER HELPER
// ==============================
async function fetchTopPerformerFromSurvey(monthDate = null) {
    const startOfMonth = monthDate ? new Date(monthDate) : new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const employees = await SurveyResponse.aggregate([
        { $match: { submittedAt: { $gte: startOfMonth } } },

        {
            $group: {
                _id: "$email",
                finalAvgScore: { $avg: "$average_score" },
                latestPerformanceLevel: { $first: "$performance_level" },
                achievements: { $first: "$achievements" },

                weeklyScores: {
                    $push: {
                        score: "$average_score",
                        date: "$submittedAt"
                    }
                },

                totalSurveys: { $sum: 1 }
            }
        },

        { $sort: { finalAvgScore: -1 } },
        { $limit: 1 },

        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "email",
                as: "userDetails"
            }
        },
        { $unwind: "$userDetails" },

        { $lookup: { from: "doctors", localField: "userDetails.employeeId", foreignField: "employeeId", as: "doc" } },
        { $lookup: { from: "nurses", localField: "userDetails.employeeId", foreignField: "employeeId", as: "nur" } },
        { $lookup: { from: "guards", localField: "userDetails.employeeId", foreignField: "employeeId", as: "gua" } },
        { $lookup: { from: "staffs", localField: "userDetails.employeeId", foreignField: "employeeId", as: "stf" } },
        { $lookup: { from: "admins", localField: "userDetails.employeeId", foreignField: "employeeId", as: "adm" } },
        { $lookup: { from: "accountings", localField: "userDetails.employeeId", foreignField: "employeeId", as: "acc" } },
        

        {
            $project: {
                email: "$_id",
                score: "$finalAvgScore",
                performanceLevel: "$latestPerformanceLevel",
                achievements: 1,
                weeklyScores: 1,
                totalSurveys: 1,
                employeeId: "$userDetails.employeeId",
                role: "$userDetails.role",
                profilePic: {
                    $ifNull: ["$userDetails.profilePic", "/uploads/profiles/default-avatar.png"]
                },
                details: {
                    $ifNull: [
                        { $arrayElemAt: ["$doc", 0] },
                        { $arrayElemAt: ["$nur", 0] },
                        { $arrayElemAt: ["$gua", 0] },
                        { $arrayElemAt: ["$stf", 0] },
                        { $arrayElemAt: ["$adm", 0] },
                        { $arrayElemAt: ["$acc", 0] },
                    ]
                }
            }
        }
    ]);

    if (!employees.length) return null;

    const emp = employees[0];

    // ==============================
    // PROCESS DATA
    // ==============================

    const weeks = [0, 0, 0, 0, 0];

    emp.weeklyScores.forEach(item => {
        const day = new Date(item.date).getDate();
        const weekIndex = Math.min(Math.floor((day - 1) / 7), 4);
        weeks[weekIndex] += item.score;
    });

    const weeklyPerformance = weeks.map(w => Math.round(w * 20));

    return {
        ...emp,
        rating: Number(emp.score.toFixed(1)),
        awards: emp.achievements?.length || 0,
        procedures: emp.totalSurveys * 3,
        satisfaction: Math.round(emp.score * 20),
        weeklyPerformance
    };
}

// ==============================
// ROUTES
// ==============================
app.get('/api/performance/top', async (req, res) => {
    try {
        const topEmployee = await fetchTopPerformerFromSurvey();

        if (!topEmployee) {
            return res.status(404).json({ message: "No data this month" });
        }

        res.json(topEmployee);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});

// GET /api/employees/top-performer
app.get('/api/employees/top-performer', async (req, res) => {
    try {
        const topEmployee = await fetchTopPerformerFromSurvey();

        if (!topEmployee) {
            return res.status(404).json({ message: "No surveys found for this month" });
        }

        res.json(topEmployee);
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});



// Periodic reminder to perform survey if no survey in last 30 days
async function sendSurveyReminders() {
    try {
        const users = await User.find({});
        const now = new Date();
        for (const user of users) {
            const survey = await SurveyResponse.findOne({ email: user.email }).sort({ submittedAt: -1 }).lean();
            const due = !survey || ((now - new Date(survey.submittedAt)) > (30 * 24 * 60 * 60 * 1000));
            if (due) {
                const existing = await Notification.findOne({ title: 'Survey reminder', 'message': new RegExp(user.employeeId, 'i'), isRead: false });
                if (!existing) {
                    const notif = new Notification({
                        title: 'Survey reminder',
                        message: `Employee ${user.fullName} (${user.employeeId}) survey needs to be completed or updated.`,
                        type: 'SURVEY_REMINDER'
                    });
                    await notif.save();
                    io.emit('new-notification', notif);
                }
            }
        }
    } catch (err) {
        console.error('Survey reminder error', err);
    }
}

// Run on start and daily
sendSurveyReminders();
setInterval(sendSurveyReminders, 24 * 60 * 60 * 1000);

// ============================================================
// PAYROLL ENDPOINTS FOR EMPLOYEE RETRIEVAL
// ============================================================

// POST: Save individual employee payslips when admin generates them
app.post('/api/payroll/save-employee-payslips', async (req, res) => {
    try {
        const { month, period, payslips } = req.body;

        if (!month || !period || !Array.isArray(payslips) || payslips.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid payroll data" });
        }

        let savedCount = 0;
        const errors = [];

        for (const payslip of payslips) {
            try {
                const {
                    employeeId,
                    fullName,
                    position,
                    contractType,
                    profilePic,
                    baseSalary,
                    allowances,
                    deductions,
                    netPay,
                    breakdown
                } = payslip;

                const breakdownData = breakdown || payslip.breakdownData || {};
                const baseSalaryValue = baseSalary ?? breakdownData.baseSalary ?? 0;
                const allowancesValue = allowances ?? breakdownData.allowances ?? 0;
                const deductionsValue = deductions ?? breakdownData.deductions ?? 0;
                const netPayValue = netPay ?? breakdownData.netPay ?? 0;
                const breakdownValue = breakdown || breakdownData;

                if (!employeeId) {
                    errors.push('Missing employeeId for one payslip');
                    continue;
                }

                const normalizedEmployeeId = employeeId.toUpperCase();
                const recordData = {
                    employeeId: normalizedEmployeeId,
                    fullName,
                    position,
                    contractType,
                    profilePic,
                    baseSalary: baseSalaryValue,
                    allowances: allowancesValue,
                    deductions: deductionsValue,
                    netPay: netPayValue,
                    breakdown: breakdownValue
                };

                // Ensure the payroll period document exists, then update or append the employee record.
                const payroll = await Payroll.findOneAndUpdate(
                    { month, period, 'records.employeeId': normalizedEmployeeId },
                    { $set: { 'records.$': recordData } },
                    { new: true }
                );

                if (payroll) {
                    savedCount++;
                    continue;
                }

                const updatedPayroll = await Payroll.findOneAndUpdate(
                    { month, period },
                    {
                        $setOnInsert: { month, period, totalCompanyNet: 0 },
                        $push: { records: recordData }
                    },
                    { new: true, upsert: true }
                );

                if (updatedPayroll) {
                    savedCount++;
                } else {
                    errors.push(`Employee ${normalizedEmployeeId}: failed to save record`);
                }
            } catch (err) {
                errors.push(`Error saving ${payslip.employeeId || 'unknown'}: ${err.message}`);
            }
        }

        const payrollDoc = await Payroll.findOne({ month, period });
        if (payrollDoc) {
            payrollDoc.totalCompanyNet = payrollDoc.records.reduce((sum, rec) => sum + (rec.netPay || 0), 0);
            await payrollDoc.save();
        }

        res.json({
            success: true,
            message: `${savedCount} payslips saved successfully`,
            savedCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Error saving employee payslips:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET: Retrieve payroll history for a specific employee
app.get('/api/payroll/employee-history/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;

        if (!employeeId) {
            return res.status(400).json({ success: false, message: "Employee ID required" });
        }

        // Find all payroll periods that contain this employee
        const payrolls = await Payroll.find(
            { 'records.employeeId': employeeId.toUpperCase() },
            { 
                month: 1, 
                period: 1, 
                createdAt: 1,
                'records.$': 1
            }
        ).sort({ createdAt: -1 });

        if (!payrolls || payrolls.length === 0) {
            return res.json({ success: true, payrolls: [], message: "No payroll history found" });
        }

        // Extract and format employee payroll data from each period
        const payrollHistory = payrolls.map(payroll => {
            const record = payroll.records[0]; // We've filtered to get only this employee's record
            return {
                _id: payroll._id,
                month: payroll.month,
                period: payroll.period,
                createdAt: payroll.createdAt,
                employeeRecord: {
                    fullName: record.fullName,
                    employeeId: record.employeeId,
                    position: record.position,
                    baseSalary: record.baseSalary,
                    allowances: record.allowances,
                    deductions: record.deductions,
                    netPay: record.netPay,
                    breakdown: record.breakdown,
                    contractType: record.contractType,
                    profilePic: record.profilePic
                }
            };
        });

        res.json({ 
            success: true, 
            payrolls: payrollHistory,
            count: payrollHistory.length
        });

    } catch (error) {
        console.error("Error retrieving employee payroll:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// GET: Get single payslip details
app.get('/api/payroll/:payrollId/employee/:employeeId/', async (req, res) => {
    try {
        const { payrollId, employeeId } = req.params;

        const payroll = await Payroll.findOne(
            { 
                _id: payrollId,
                'records.employeeId': employeeId.toUpperCase()
            }
        );

        if (!payroll) {
            return res.status(404).json({ success: false, message: "Payslip not found" });
        }

        const record = payroll.records.find(r => r.employeeId === employeeId.toUpperCase());

        res.json({
            success: true,
            payslip: {
                month: payroll.month,
                period: payroll.period,
                createdAt: payroll.createdAt,
                ...record
            }
        });

    } catch (error) {
        console.error("Error retrieving payslip:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 2. CLEAN URLS: Map the root to login
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/employee/login.html'));
});

// 3. CLEAN URLS: Map "/login" to the file
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/employee/login.html'));
});

// 4. CLEAN URLS: Map "/dashboard" or "/attendance" (example)
app.get('/attendance', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/employee/pages/attendance.html'));
});


server.listen(PORT, () => { 
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
});

module.exports = app;

