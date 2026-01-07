import { PDFDocument } from 'pdf-lib';
import fs from 'fs-extra';
import path from 'path';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { execCommand, delay } from '../utils/helpers.js';

/**
 * PDF Security Service
 * Handles PDF security operations: unlock, protect, sign, redact, compare
 */

/**
 * Unlock PDF (remove password protection)
 * Note: This only works if the password is known or if the PDF is not encrypted
 * @param {string} pdfPath - Path to input PDF
 * @param {string} password - Password to unlock (if required)
 * @returns {Promise<string>} Path to unlocked PDF
 */
export async function unlockPDF(pdfPath, password = '') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // Try to load PDF with pdf-lib (it will fail if encrypted)
    let pdfBytes = await fs.readFile(pdfPath);
    let pdf;
    
    try {
      pdf = await PDFDocument.load(pdfBytes);
    } catch (error) {
      // PDF might be encrypted, try with password using Ghostscript
      if (password) {
        // Use qpdf or pdftk to unlock
        // For now, we'll use Ghostscript which can handle some encrypted PDFs
        const command = password 
          ? `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -sUserPassword="${password}" -sOwnerPassword="" -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${pdfPath}"`
          : `gs -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${pdfPath}"`;
        
        const result = await execCommand(command);
        
        if (result.success) {
          await delay(500);
          if (await verifyFile(outputPath)) {
            return outputPath;
          }
        }
      }
      throw new Error('PDF is encrypted. Please provide the correct password.');
    }
    
    // PDF is not encrypted or was successfully unlocked
    // Re-save without encryption
    const unlockedBytes = await pdf.save();
    await fs.writeFile(outputPath, unlockedBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create unlocked PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Protect PDF with password
 * @param {string} pdfPath - Path to input PDF
 * @param {string} userPassword - User password (for viewing)
 * @param {string} ownerPassword - Owner password (for permissions, optional)
 * @returns {Promise<string>} Path to protected PDF
 */
export async function protectPDF(pdfPath, userPassword, ownerPassword = '') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    if (!userPassword) {
      throw new Error('User password is required');
    }
    
    // Load PDF
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    
    // Save with password protection
    const protectedBytes = await pdf.save({
      useObjectStreams: false,
      userPassword: userPassword,
      ownerPassword: ownerPassword || userPassword,
      permissions: {
        printing: 'lowResolution',
        modifying: false,
        copying: false,
        annotating: false,
        fillingForms: false,
        contentAccessibility: false,
        documentAssembly: false,
      },
    });
    
    await fs.writeFile(outputPath, protectedBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create protected PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Sign PDF with image-based signature
 * @param {string} pdfPath - Path to input PDF
 * @param {string} signatureImagePath - Path to signature image
 * @param {string} position - Position: 'bottom-left', 'bottom-right', 'top-left', 'top-right'
 * @returns {Promise<string>} Path to signed PDF
 */
export async function signPDF(pdfPath, signatureImagePath, position = 'bottom-right') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    if (!(await verifyFile(signatureImagePath))) {
      throw new Error('Signature image not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    
    // Load signature image
    const signatureBytes = await fs.readFile(signatureImagePath);
    let signatureImage;
    
    if (signatureImagePath.endsWith('.png')) {
      signatureImage = await pdf.embedPng(signatureBytes);
    } else {
      signatureImage = await pdf.embedJpg(signatureBytes);
    }
    
    // Position mapping
    const positions = {
      'bottom-left': { x: 50, y: 50 },
      'bottom-right': { x: 0, y: 50 },
      'top-left': { x: 50, y: 0 },
      'top-right': { x: 0, y: 0 },
    };
    
    const pos = positions[position] || positions['bottom-right'];
    
    // Add signature to last page
    const lastPageIndex = pdf.getPageCount() - 1;
    const page = pdf.getPage(lastPageIndex);
    const { width, height } = page.getSize();
    
    const imageDims = signatureImage.scale(0.15); // Scale signature
    
    let x, y;
    
    if (pos.x === 0) {
      x = width - imageDims.width - 50; // Right side
    } else {
      x = 50; // Left side
    }
    
    if (pos.y === 0) {
      y = height - imageDims.height - 50; // Top
    } else {
      y = 50; // Bottom
    }
    
    page.drawImage(signatureImage, {
      x,
      y,
      width: imageDims.width,
      height: imageDims.height,
    });
    
    const signedBytes = await pdf.save();
    await fs.writeFile(outputPath, signedBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create signed PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Redact PDF (remove sensitive content)
 * Note: This is a basic implementation that covers text with black rectangles
 * @param {string} pdfPath - Path to input PDF
 * @param {Array} redactionAreas - Array of {page, x, y, width, height} objects
 * @returns {Promise<string>} Path to redacted PDF
 */
export async function redactPDF(pdfPath, redactionAreas) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    if (!redactionAreas || redactionAreas.length === 0) {
      throw new Error('No redaction areas specified');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Group redactions by page
    const redactionsByPage = {};
    for (const area of redactionAreas) {
      const pageNum = area.page - 1; // Convert to 0-based
      if (pageNum >= 0 && pageNum < totalPages) {
        if (!redactionsByPage[pageNum]) {
          redactionsByPage[pageNum] = [];
        }
        redactionsByPage[pageNum].push(area);
      }
    }
    
    // Apply redactions
    for (const [pageIndex, areas] of Object.entries(redactionsByPage)) {
      const page = pdf.getPage(parseInt(pageIndex));
      const { height: pageHeight } = page.getSize();
      
      for (const area of areas) {
        // Convert y coordinate (PDF uses bottom-left origin)
        const redactY = pageHeight - area.y - area.height;
        
        // Draw black rectangle to cover content
        page.drawRectangle({
          x: area.x,
          y: redactY,
          width: area.width,
          height: area.height,
          color: { r: 0, g: 0, b: 0 }, // Black
        });
      }
    }
    
    const redactedBytes = await pdf.save();
    await fs.writeFile(outputPath, redactedBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create redacted PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Compare two PDFs
 * @param {string} pdfPath1 - Path to first PDF
 * @param {string} pdfPath2 - Path to second PDF
 * @returns {Promise<Object>} Comparison result with differences
 */
export async function comparePDFs(pdfPath1, pdfPath2) {
  try {
    if (!(await verifyFile(pdfPath1))) {
      throw new Error('First PDF not found');
    }
    
    if (!(await verifyFile(pdfPath2))) {
      throw new Error('Second PDF not found');
    }
    
    // Load both PDFs
    const pdfBytes1 = await fs.readFile(pdfPath1);
    const pdfBytes2 = await fs.readFile(pdfPath2);
    
    const pdf1 = await PDFDocument.load(pdfBytes1);
    const pdf2 = await PDFDocument.load(pdfBytes2);
    
    const pageCount1 = pdf1.getPageCount();
    const pageCount2 = pdf2.getPageCount();
    
    // Basic comparison
    const differences = {
      pageCountMatch: pageCount1 === pageCount2,
      pageCount1,
      pageCount2,
      fileSize1: pdfBytes1.length,
      fileSize2: pdfBytes2.length,
      fileSizeMatch: pdfBytes1.length === pdfBytes2.length,
      identical: false,
    };
    
    // Check if files are identical
    if (differences.pageCountMatch && differences.fileSizeMatch) {
      // Simple byte comparison (not perfect but quick)
      differences.identical = pdfBytes1.length === pdfBytes2.length && 
        pdfBytes1.every((byte, index) => byte === pdfBytes2[index]);
    }
    
    // More detailed comparison would require:
    // - Converting pages to images and comparing
    // - Extracting text and comparing
    // - Comparing metadata
    
    return differences;
  } catch (error) {
    throw error;
  }
}

