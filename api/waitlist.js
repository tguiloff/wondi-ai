import { neon } from '@neondatabase/serverless';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const email = (body && typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  const source = body && typeof body.source === 'string' ? body.source.slice(0, 64) : null;

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not configured');
    return res.status(500).json({ error: 'Waitlist is temporarily unavailable.' });
  }

  const ipHeader = req.headers['x-forwarded-for'];
  const ip = (typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : null) || null;
  const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 512) || null;

  try {
    const sql = neon(connectionString);
    await sql`
      INSERT INTO waitlist (email, source, ip, user_agent)
      VALUES (${email}, ${source}, ${ip}, ${userAgent})
      ON CONFLICT (email) DO NOTHING
    `;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('waitlist insert failed', err);
    return res.status(500).json({ error: 'Could not save your email. Please try again.' });
  }
}
