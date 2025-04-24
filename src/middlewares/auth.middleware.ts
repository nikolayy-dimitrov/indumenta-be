import { Request, Response, NextFunction } from 'express';
import { auth } from '../config/firebase';

// Extend Request type to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                uid: string;
                email?: string;
            };
        }
    }
}

export const authenticateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split('Bearer ')[1];
    }

    // If no token in header, check query parameters
    if (!token && req.query.auth) {
        token = req.query.auth as string;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email
        };
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({
            error: 'Unauthorized: Invalid token',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};