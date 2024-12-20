import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async submitContactForm(
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      message: string;
    },
  ) {
    try {
      await this.contactService.sendContactEmail(body);
      return { message: 'Your inquiry has been sent successfully.' };
    } catch (error) {
      console.error('Error sending contact email:', error.message);
      return { error: 'Failed to send your inquiry. Please try again later.' };
    }
  }
}
