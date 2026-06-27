declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PORT?: string;
      FRONTEND_URL?: string;
      APP_URL?: string;
      GEMINI_API_KEY?: string;
      STRIPE_SECRET_KEY?: string;
      STRIPE_WEBHOOK_SECRET?: string;
      STRIPE_PUBLISHABLE_KEY?: string;
      STRIPE_PRICE_ID_BASIC?: string;
      STRIPE_PRICE_ID_PREMIUM?: string;
      AWS_REGION?: string;
      AWS_ACCESS_KEY_ID?: string;
      AWS_SECRET_ACCESS_KEY?: string;
      FIREBASE_PROJECT_ID?: string;
      FIREBASE_CLIENT_EMAIL?: string;
      FIREBASE_PRIVATE_KEY?: string;
      NODE_ENV?: string;
    }
  }
}
export {};
