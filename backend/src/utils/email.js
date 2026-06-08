// src/utils/email.js
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  return transporter;
}

const FROM = process.env.EMAIL_FROM || 'Confessional <noreply@confessional.app>';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

async function sendPasswordResetEmail(email, username, token) {
  const resetURL = `${CLIENT_URL}/reset-password?token=${token}`;
  const html = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8"></head>
  <body style="margin:0;padding:0;background:#0d0d0f;font-family:'DM Sans',Arial,sans-serif">
    <div style="max-width:520px;margin:40px auto;background:#141417;border:1px solid #2a2a32;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#9333ea);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px;font-family:Georgia,serif">Confessional</h1>
        <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">Anonymous Wall</p>
      </div>
      <div style="padding:32px">
        <h2 style="color:#e8e6f0;margin:0 0 12px;font-size:20px">Reset Your Password</h2>
        <p style="color:#9896a8;line-height:1.6;margin:0 0 24px">Hi ${username}, we received a request to reset your password. Click the button below to create a new one.</p>
        <a href="${resetURL}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:500;font-size:15px">Reset Password</a>
        <p style="color:#5a5868;font-size:12px;margin:24px 0 0;line-height:1.6">This link expires in <strong style="color:#9896a8">60 minutes</strong>. If you didn't request this, you can safely ignore this email.<br><br>Or paste this URL into your browser:<br><span style="color:#c084fc;word-break:break-all">${resetURL}</span></p>
      </div>
      <div style="padding:16px 32px;border-top:1px solid #2a2a32;text-align:center">
        <p style="color:#5a5868;font-size:11px;margin:0">© ${new Date().getFullYear()} Confessional. Your secrets are safe with us.</p>
      </div>
    </div>
  </body>
  </html>`;

  return getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your Confessional password',
    html,
    text: `Reset your Confessional password\n\nHi ${username},\n\nClick here to reset: ${resetURL}\n\nThis link expires in 60 minutes.`,
  });
}

async function sendEmailVerification(email, username, token) {
  const verifyURL = `${CLIENT_URL}/verify-email?token=${token}`;
  const html = `
  <!DOCTYPE html>
  <html>
  <body style="margin:0;padding:0;background:#0d0d0f;font-family:Arial,sans-serif">
    <div style="max-width:520px;margin:40px auto;background:#141417;border:1px solid #2a2a32;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#7c3aed,#9333ea);padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px;font-family:Georgia,serif">Confessional</h1>
      </div>
      <div style="padding:32px">
        <h2 style="color:#e8e6f0;margin:0 0 12px">Verify Your Email</h2>
        <p style="color:#9896a8;line-height:1.6;margin:0 0 24px">Hi ${username}! Click below to verify your email and activate your account.</p>
        <a href="${verifyURL}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:500">Verify Email</a>
        <p style="color:#5a5868;font-size:12px;margin:24px 0 0">Link expires in 24 hours. URL: <span style="color:#c084fc">${verifyURL}</span></p>
      </div>
    </div>
  </body>
  </html>`;

  return getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your Confessional email',
    html,
    text: `Verify your email: ${verifyURL}`,
  });
}

async function sendWelcomeEmail(email, username) {
  return getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: 'Welcome to Confessional 👻',
    text: `Hi ${username}!\n\nWelcome to Confessional — your anonymous safe space. Your secrets are safe with us.\n\nStart confessing at ${CLIENT_URL}`,
  });
}

module.exports = { sendPasswordResetEmail, sendEmailVerification, sendWelcomeEmail };
