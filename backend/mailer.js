// backend/mailer.js
const nodemailer = require('nodemailer');
module.exports = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'json4ai@gmail.com',        // your Gmail
    pass: 'muvi bvft mavn oixi'       // the 16-char App Password (no spaces)
  }
});