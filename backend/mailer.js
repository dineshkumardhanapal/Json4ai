// backend/mailer.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'json4ai@gmail.com',        // your Gmail
    pass: 'muvi bvft mavn oixi'       // the 16-char App Password (no spaces)
  }
});

// Email templates
const emailTemplates = {
  subscriptionConfirmation: (userData, planDetails) => ({
    subject: `🎉 Welcome to JSON4AI ${planDetails.name} Plan!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Confirmation - JSON4AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .plan-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #667eea; }
          .feature-list { list-style: none; padding: 0; }
          .feature-list li { padding: 8px 0; border-bottom: 1px solid #eee; }
          .feature-list li:before { content: "✓ "; color: #28a745; font-weight: bold; }
          .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to JSON4AI!</h1>
            <p>Your subscription has been successfully activated</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName}!</h2>
            <p>Thank you for subscribing to JSON4AI! Your account has been upgraded and you now have access to premium features.</p>
            
            <div class="plan-details">
              <h3>📋 Your Plan: ${planDetails.name}</h3>
              <p><strong>Price:</strong> $${planDetails.price}/month</p>
              <p><strong>Credits:</strong> ${planDetails.credits} prompts per month</p>
              <p><strong>Billing Cycle:</strong> Monthly</p>
              <p><strong>Next Billing Date:</strong> ${planDetails.nextBillingDate}</p>
            </div>
            
            <h3>🚀 What's Included:</h3>
            <ul class="feature-list">
              ${planDetails.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
            </div>
            
            <p><strong>Need Help?</strong> If you have any questions about your subscription or need assistance, please don't hesitate to contact our support team.</p>
          </div>
          
          <div class="footer">
            <p>© 2024 JSON4AI. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  subscriptionUpdated: (userData, planDetails) => ({
    subject: `🔄 Your JSON4AI Subscription Has Been Updated`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Updated - JSON4AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #17a2b8 0%, #138496 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .plan-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #17a2b8; }
          .cta-button { display: inline-block; background: #17a2b8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔄 Subscription Updated</h1>
            <p>Your JSON4AI plan has been successfully changed</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName}!</h2>
            <p>Your JSON4AI subscription has been updated successfully. Here are the details of your new plan:</p>
            
            <div class="plan-details">
              <h3>📋 New Plan: ${planDetails.name}</h3>
              <p><strong>Price:</strong> $${planDetails.price}/month</p>
              <p><strong>Credits:</strong> ${planDetails.credits} prompts per month</p>
              <p><strong>Effective Date:</strong> ${planDetails.effectiveDate}</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Go to Dashboard</a>
            </div>
            
            <p>If you have any questions about this change, please contact our support team.</p>
          </div>
          
          <div class="footer">
            <p>© 2024 JSON4AI. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  subscriptionCancelled: (userData, planDetails) => ({
    subject: `😔 Your JSON4AI Subscription Has Been Cancelled`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Cancelled - JSON4AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .plan-details { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545; }
          .cta-button { display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>😔 Subscription Cancelled</h1>
            <p>We're sorry to see you go</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName}!</h2>
            <p>Your JSON4AI subscription has been cancelled. You'll continue to have access to your current plan until the end of your billing period.</p>
            
            <div class="plan-details">
              <h3>📋 Current Plan: ${planDetails.name}</h3>
              <p><strong>Access Until:</strong> ${planDetails.accessUntil}</p>
              <p><strong>Remaining Credits:</strong> ${planDetails.remainingCredits}</p>
            </div>
            
            <p>After your current billing period ends, your account will be downgraded to the free plan.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/pricing" class="cta-button">Reactivate Subscription</a>
            </div>
            
            <p>We'd love to have you back! If you change your mind, you can reactivate your subscription at any time.</p>
          </div>
          
          <div class="footer">
            <p>© 2024 JSON4AI. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
            <p>If you have any questions, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `
  }),

  paymentFailed: (userData, planDetails) => ({
    subject: `⚠️ Payment Failed - Action Required`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Failed - JSON4AI</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffc107 0%, #e0a800 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 20px 0; border-radius: 8px; }
          .cta-button { display: inline-block; background: #ffc107; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Payment Failed</h1>
            <p>Action required to maintain your subscription</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName}!</h2>
            <p>We were unable to process your payment for your JSON4AI subscription. This could be due to:</p>
            
            <ul>
              <li>Expired or invalid payment method</li>
              <li>Insufficient funds</li>
              <li>Payment method restrictions</li>
            </ul>
            
            <div class="warning">
              <h3>⚠️ Important:</h3>
              <p>If we cannot process your payment within the next few days, your subscription may be suspended.</p>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/dashboard" class="cta-button">Update Payment Method</a>
            </div>
            
            <p>Please update your payment method in your dashboard to avoid any interruption to your service.</p>
          </div>
          
          <div class="footer">
            <p>© 2024 JSON4AI. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
            <p>If you need assistance, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `
  })
};

// Email sending functions
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: '"JSON4AI" <json4ai@gmail.com>',
      to,
      subject,
      html
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Specific email functions for subscriptions
const sendSubscriptionConfirmation = async (userData, planDetails) => {
  const template = emailTemplates.subscriptionConfirmation(userData, planDetails);
  return await sendEmail(userData.email, template.subject, template.html);
};

const sendSubscriptionUpdated = async (userData, planDetails) => {
  const template = emailTemplates.subscriptionUpdated(userData, planDetails);
  return await sendEmail(userData.email, template.subject, template.html);
};

const sendSubscriptionCancelled = async (userData, planDetails) => {
  const template = emailTemplates.subscriptionCancelled(userData, planDetails);
  return await sendEmail(userData.email, template.subject, template.html);
};

const sendPaymentFailed = async (userData, planDetails) => {
  const template = emailTemplates.paymentFailed(userData, planDetails);
  return await sendEmail(userData.email, template.subject, template.html);
};

module.exports = {
  transporter,
  sendEmail,
  sendSubscriptionConfirmation,
  sendSubscriptionUpdated,
  sendSubscriptionCancelled,
  sendPaymentFailed,
  emailTemplates
};