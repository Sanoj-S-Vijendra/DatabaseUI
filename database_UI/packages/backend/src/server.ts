// src/server.ts

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import 'express-async-errors';
import session from 'express-session'; // <--- Import express-session

import apiRouter from './routes/index';
import { errorHandler } from './middleware/errorHandler';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Core Middleware ---
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // Your frontend URL
    credentials: true, // <--- IMPORTANT: Allow cookies
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Session Middleware (MUST be before API routes) ---
// Ensure you have a SESSION_SECRET in your .env file!
if (!process.env.SESSION_SECRET) {
    console.warn("WARNING: SESSION_SECRET environment variable is not set. Using default, insecure secret.");
}
const sessionSecret = process.env.SESSION_SECRET || 'a-default-insecure-secret-key'; // CHANGE THIS IN PRODUCTION!

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true, // Prevent client-side JS access
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (requires HTTPS)
        maxAge: 1000 * 60 * 60 * 24 * 7, // Example: 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site (prod with HTTPS), 'lax' for dev
    },
}));
// --- End Session Middleware ---


// --- Logging Middleware ---
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} (Session UserID: ${req.session?.userId || 'None'})`);
  next();
});

// --- API Routes ---
app.use('/api', apiRouter);

// --- Health Check ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP' });
});

// --- Not Found Handler ---
app.use((req, res, next) => {
    // This seems fine as is
    if (!req.path.startsWith('/api')) {
         res.status(404).json({ message: `Resource not found at ${req.originalUrl}` });
    } else {
          res.status(404).json({ message: `API endpoint not found: ${req.method} ${req.path}` });
    }
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
  // Server start log messages seem fine
  console.log(`Backend server is running on http://localhost:${PORT}`);
  const dbUrl = process.env.DATABASE_URL;
  const dbInfo = dbUrl ? dbUrl.substring(dbUrl.indexOf('@') + 1) : 'Not Set';
  console.log(`Database URL configured for: ${dbInfo}`);
  console.log(`Session Middleware: ${process.env.NODE_ENV === 'production' ? 'Secure, HttpOnly, SameSite=None' : 'HttpOnly, SameSite=Lax'} `);
  console.log('Ensure the database server is running and accessible.');
});