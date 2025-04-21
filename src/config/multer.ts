import multer from 'multer';

// Configure multer for file upload (in memory)
export const upload = multer({ storage: multer.memoryStorage() });