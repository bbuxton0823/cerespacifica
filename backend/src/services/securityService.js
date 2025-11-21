import crypto from 'crypto';
import { logger } from '../utils/logger.js';

// In production, this MUST be a 32-byte hex string in process.env.ENCRYPTION_KEY
const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_KEY
    ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
    : crypto.randomBytes(32); // Fallback for dev only

export class SecurityService {

    /**
     * Encrypts a text string
     * @param {string} text 
     * @returns {string} format: iv:authTag:encryptedData
     */
    encrypt(text) {
        if (!text) return text;
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);

            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');

            const authTag = cipher.getAuthTag().toString('hex');

            // Return as colon-separated string
            return `${iv.toString('hex')}:${authTag}:${encrypted}`;
        } catch (error) {
            logger.error('Encryption failed:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Decrypts an encrypted string
     * @param {string} encryptedText format: iv:authTag:encryptedData
     * @returns {string}
     */
    decrypt(encryptedText) {
        if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
        try {
            const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');

            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);

            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');

            return decrypted;
        } catch (error) {
            logger.error('Decryption failed:', error);
            // Return original text if decryption fails (might not be encrypted)
            return encryptedText;
        }
    }
}

export const securityService = new SecurityService();
