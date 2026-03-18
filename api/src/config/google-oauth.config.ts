import { registerAs } from '@nestjs/config';

export default registerAs('google-oauth', () => ({
  clientID: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  callbackURL: process.env.GOOGLE_CALLBACK_URL!,
  linkCallbackUri: process.env.GOOGLE_LINK_CALLBACK_URI!,

  scope: ['email', 'profile'],
}));
