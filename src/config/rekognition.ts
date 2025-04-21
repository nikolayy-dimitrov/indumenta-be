import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from './env';

// Configure AWS Rekognition client
export const rekognitionClient = new RekognitionClient({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
    }
});