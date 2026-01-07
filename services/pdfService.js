import { PDFDocument } from 'pdf-lib';
import fs from 'fs-extra';
import path from 'path';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { execCommand, delay } from '../utils/helpers.js';

/**
 * PDF Service
 * Handles all PDF operations: merge, split, remove pages, extract pages
 */

/**
 * Merge multiple PDF files
 * @param {string[]} pdfPaths - Array of PDF file paths
 * @returns {Promise<string>} Path to merged PDF
 */
export async function mergePDFs(pdfPaths) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfPath of pdfPaths) {
      if (!(await verifyFile(pdfPath))) {
        throw new Error(`File not found: ${pdfPath}`);
      }
      
      const pdfBytes = await fs.readFile(pdfPath);
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      pages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }
    
    const mergedPdfBytes = await mergedPdf.save();
    await fs.writeFile(outputPath, mergedPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create merged PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Split PDF by page range
 * @param {string} pdfPath - Path to input PDF
 * @param {string} pageRange - Page range (e.g., "1-5", "1,3,5", "1-")
 * @returns {Promise<string>} Path to split PDF
 */
export async function splitPDF(pdfPath, pageRange) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Parse page range
    const pages = parsePageRange(pageRange, totalPages);
    
    if (pages.length === 0) {
      throw new Error('Invalid page range');
    }
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, pages.map(p => p - 1));
    
    copiedPages.forEach((page) => {
      newPdf.addPage(page);
    });
    
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create split PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Remove pages from PDF
 * @param {string} pdfPath - Path to input PDF
 * @param {string} pageRange - Pages to remove (e.g., "1-3", "5,7,9")
 * @returns {Promise<string>} Path to modified PDF
 */
export async function removePages(pdfPath, pageRange) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Parse pages to remove
    const pagesToRemove = parsePageRange(pageRange, totalPages);
    const pagesToKeep = [];
    
    for (let i = 1; i <= totalPages; i++) {
      if (!pagesToRemove.includes(i)) {
        pagesToKeep.push(i - 1); // Convert to 0-based index
      }
    }
    
    if (pagesToKeep.length === 0) {
      throw new Error('Cannot remove all pages');
    }
    
    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(pdf, pagesToKeep);
    
    copiedPages.forEach((page) => {
      newPdf.addPage(page);
    });
    
    const newPdfBytes = await newPdf.save();
    await fs.writeFile(outputPath, newPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create modified PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Extract specific pages from PDF
 * @param {string} pdfPath - Path to input PDF
 * @param {string} pageRange - Pages to extract (e.g., "1-3", "5,7,9")
 * @returns {Promise<string>} Path to extracted PDF
 */
export async function extractPages(pdfPath, pageRange) {
  // Extract is similar to split, reuse split logic
  return splitPDF(pdfPath, pageRange);
}

/**
 * Parse page range string into array of page numbers
 * @param {string} pageRange - Page range string
 * @param {number} totalPages - Total pages in PDF
 * @returns {number[]} Array of page numbers (1-based)
 */
function parsePageRange(pageRange, totalPages) {
  const pages = [];
  const parts = pageRange.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    
    if (trimmed.includes('-')) {
      const [start, end] = trimmed.split('-').map(s => s.trim());
      const startNum = parseInt(start) || 1;
      const endNum = end ? (parseInt(end) || totalPages) : totalPages;
      
      for (let i = startNum; i <= endNum && i <= totalPages; i++) {
        if (i >= 1 && !pages.includes(i)) {
          pages.push(i);
        }
      }
    } else {
      const pageNum = parseInt(trimmed);
      if (pageNum >= 1 && pageNum <= totalPages && !pages.includes(pageNum)) {
        pages.push(pageNum);
      }
    }
  }
  
  return pages.sort((a, b) => a - b);
}

