import { getFileExtension } from './fileManager.js';

/**
 * Detect file type from extension or MIME type
 * @param {string} filename - File name or path
 * @param {string} mimeType - MIME type (optional)
 * @returns {string} Detected file type
 */
export function detectFileType(filename, mimeType = null) {
  const ext = getFileExtension(filename);
  
  // PDF
  if (ext === '.pdf') return 'pdf';
  
  // Images
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) {
    return 'image';
  }
  
  // Office documents
  if (['.doc', '.docx'].includes(ext)) return 'word';
  if (['.ppt', '.pptx'].includes(ext)) return 'powerpoint';
  if (['.xls', '.xlsx'].includes(ext)) return 'excel';
  
  // HTML
  if (['.html', '.htm'].includes(ext)) return 'html';
  
  // Try MIME type if extension doesn't match
  if (mimeType) {
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('image')) return 'image';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'word';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'powerpoint';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'excel';
    if (mimeType.includes('html')) return 'html';
  }
  
  return 'unknown';
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute shell command and return output
 * @param {string} command - Command to execute
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
export async function execCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 });
    return {
      success: true,
      output: stdout || '',
      error: stderr || '',
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error.message || String(error),
    };
  }
}


