import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ContactService {
  private readonly transporter;

  constructor() {
    // Configure Postmark as the email transport
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // Postmark SMTP host
      port: 587, // Port for STARTTLS
      secure: false, // TLS (STARTTLS) should be false for port 587
      auth: {
        user: process.env.EMAIL_USER, // Postmark email (sender)
        pass: process.env.EMAIL_PASS, // Postmark Server API token
      },
    });
  }

  async sendContactEmail(contact: {
    firstName: string;
    lastName: string;
    email: string;
    message: string;
  }) {
    const mailOptions = {
      from: `${contact.firstName} ${contact.lastName} <${process.env.BUSINESS_EMAIL}>`, // Sender email
      to: process.env.BUSINESS_EMAIL, // Business/support email
      replyTo: contact.email, // User's email for replies
      subject: 'General Inquiry', // Customize subject as needed
      text: `
        You have received a new contact form submission:

        Name: ${contact.firstName} ${contact.lastName}
        Email: ${contact.email}
        Message: ${contact.message}
      `,
      html: `
        <p><strong>You have received a new contact form submission:</strong></p>
        <p><strong>Name:</strong> ${contact.firstName} ${contact.lastName}</p>
        <p><strong>Email:</strong> ${contact.email}</p>
        <p><strong>Message:</strong> ${contact.message}</p>
      `,
    };

    // Send the email
    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Contact email sent successfully.');
    } catch (error) {
      console.error('Error sending contact email:', error);
      throw new Error('Failed to send contact email.');
    }
  }
}
