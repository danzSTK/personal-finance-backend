import { registerAs } from '@nestjs/config';

export default registerAs('objectStorage', () => ({
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID!,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  publicBucketName: process.env.R2_PUBLIC_BUCKET_NAME!,
  privateBucketName: process.env.R2_PRIVATE_BUCKET_NAME!,
  endpoint: process.env.R2_ENDPOINT!,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL!,
}));
