const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());

// CORS — only allow the frontend origin (plus localhost for development)
const allowedOrigins = [
  'http://localhost:4200',
  'http://192.168.2.19:4200',
  'https://constantine-client-production.up.railway.app',
];
if (process.env.FRONTEND_URL && !allowedOrigins.includes(process.env.FRONTEND_URL)) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server like Stripe webhooks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(morgan('dev'));

// Stripe webhooks require the raw body — mount before express.json()
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);

app.use(errorHandler);

module.exports = app;
