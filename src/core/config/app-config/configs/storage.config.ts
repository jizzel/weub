import { registerAs } from '@nestjs/config';
import { StorageDriver } from '../env/environment-variables';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || StorageDriver.LOCAL,
  path: process.env.STORAGE_PATH || 'storage',
  r2: {
    endpoint: process.env.R2_ENDPOINT,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_BUCKET_NAME,
  },
}));
