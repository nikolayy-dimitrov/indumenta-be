import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID || '',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
        }),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
        storageBucket: `${process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    });
}

export const db = getFirestore();
export const auth = getAuth();
export const storage = getStorage();