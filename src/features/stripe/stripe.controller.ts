import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  HttpException,
  HttpStatus,
  Headers,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { Request, Response } from 'express';

@Controller('stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('create-checkout-session')
  async createCheckoutSession(
    @Body('priceId') priceId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const user = req.user; // Extract user from middleware
    const userId = user?.sub; // Extract the user's unique ID

    if (!userId) {
      console.error('User ID is missing in the request.');
      return res.status(401).json({ error: 'User not authenticated.' });
    }

    try {
      console.log('Creating checkout session for user:', { userId, priceId });

      const session = await this.stripeService.createCheckoutSession(
        priceId,
        `${process.env.FRONTEND_URL}/dashboard/settings`,
        `${process.env.FRONTEND_URL}/dashboard/settings`,
        userId,
      );

      console.log('Checkout session created successfully:', session.id);
      return res.status(200).json({ url: session.url });
    } catch (error) {
      console.error('Error creating checkout session:', error.message);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: Request & { rawBody: Buffer },
    @Headers('stripe-signature') signature: string,
    @Res() res: Response,
  ) {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send('Webhook secret is not set.');
    }

    try {
      const event = this.stripeService.verifyWebhook(req.rawBody, signature);

      console.log('Processing event type:', event.type);

      await this.stripeService.handleWebhook(event);

      res.status(200).send('Webhook processed successfully.');
    } catch (error) {
      console.error('Webhook Error:', error.message);
      res.status(400).send(`Webhook Error: ${error.message}`);
    }
  }
}
