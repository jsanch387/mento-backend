import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ContactService {
  private readonly transporter;

  constructor() {
    // Configure your email transport
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST, // e.g., smtp.gmail.com
      port: 587, // or 465 for SSL
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
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
      from: `${contact.firstName} ${contact.lastName} <${process.env.EMAIL_USER}>`, // Business email as the sender
      to: process.env.BUSINESS_EMAIL, // Your business/support email
      replyTo: contact.email, // Reply-To set to user's email for direct replies
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
    await this.transporter.sendMail(mailOptions);
  }
}
