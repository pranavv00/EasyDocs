import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure temp directory exists
const TEMP_DIR = path.join(__dirname, '..', 'temp');
await fs.ensureDir(TEMP_DIR);

/**
 * Generate a unique temporary file path
 * @param {string} extension - File extension (e.g., '.pdf', '.jpg')
 * @returns {string} Full path to temporary file
 */
export function getTempFilePath(extension = '') {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const filename = `temp_${timestamp}_${random}${extension}`;
  return path.join(TEMP_DIR, filename);
}

/**
 * Clean up a temporary file
 * @param {string} filePath - Path to file to delete
 */
export async function cleanupFile(filePath) {
  try {
    if (filePath && await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  } catch (error) {
    console.error(`Error cleaning up file ${filePath}:`, error.message);
  }
}

/**
 * Clean up multiple temporary files
 * @param {string[]} filePaths - Array of file paths to delete
 */
export async function cleanupFiles(filePaths) {
  await Promise.all(filePaths.map(cleanupFile));
}

/**
 * Verify that a file exists and is readable
 * @param {string} filePath - Path to file
 * @returns {Promise<boolean>} True if file exists and is readable
 */
export async function verifyFile(filePath) {
  try {
    if (!filePath) return false;
    const stats = await fs.stat(filePath);
    return stats.isFile() && stats.size > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Get file extension from path
 * @param {string} filePath - Path to file
 * @returns {string} File extension (lowercase, with dot)
 */
export function getFileExtension(filePath) {
  return path.extname(filePath).toLowerCase();
}

/**
 * Get file size in bytes
 * @param {string} filePath - Path to file
 * @returns {Promise<number>} File size in bytes
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Clean up old temporary files (older than 1 hour)
 */
export async function cleanupOldFiles() {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        if (now - stats.mtimeMs > maxAge) {
          await fs.remove(filePath);
        }
      } catch (error) {
        // Ignore errors for individual files
      }
    }
  } catch (error) {
    console.error('Error cleaning up old files:', error.message);
  }
}

// Clean up old files on startup and set interval
cleanupOldFiles();
setInterval(cleanupOldFiles, 30 * 60 * 1000); // Every 30 minutes

