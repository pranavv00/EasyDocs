import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs-extra';
import path from 'path';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { execCommand, delay } from '../utils/helpers.js';

/**
 * PDF Edit Service
 * Handles PDF editing: rotate, add page numbers, watermark, crop
 */

/**
 * Rotate PDF pages
 * @param {string} pdfPath - Path to input PDF
 * @param {number} angle - Rotation angle (90, 180, 270)
 * @param {string} pageRange - Pages to rotate (e.g., "1-5", "all")
 * @returns {Promise<string>} Path to rotated PDF
 */
export async function rotatePDF(pdfPath, angle, pageRange = 'all') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    if (![90, 180, 270].includes(angle)) {
      throw new Error('Invalid rotation angle. Use 90, 180, or 270');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Parse page range
    let pagesToRotate = [];
    if (pageRange === 'all') {
      pagesToRotate = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      // Parse range like "1-5" or "1,3,5"
      const parts = pageRange.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
          for (let i = start - 1; i < (end || totalPages); i++) {
            if (i >= 0 && i < totalPages) {
              pagesToRotate.push(i);
            }
          }
        } else {
          const pageNum = parseInt(trimmed) - 1;
          if (pageNum >= 0 && pageNum < totalPages) {
            pagesToRotate.push(pageNum);
          }
        }
      }
    }
    
    // Rotate pages
    for (const pageIndex of pagesToRotate) {
      const page = pdf.getPage(pageIndex);
      const currentRotation = page.getRotation().angle;
      page.setRotation({ angle: currentRotation + angle });
    }
    
    const modifiedPdfBytes = await pdf.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create rotated PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Add page numbers to PDF
 * @param {string} pdfPath - Path to input PDF
 * @param {string} position - Position: 'bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right'
 * @param {number} fontSize - Font size (default: 12)
 * @returns {Promise<string>} Path to PDF with page numbers
 */
export async function addPageNumbers(pdfPath, position = 'bottom-center', fontSize = 12) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    
    // Position mapping
    const positions = {
      'bottom-left': { x: 50, y: 50, align: 'left' },
      'bottom-center': { x: 0, y: 50, align: 'center' },
      'bottom-right': { x: 0, y: 50, align: 'right' },
      'top-left': { x: 50, y: 0, align: 'left' },
      'top-center': { x: 0, y: 0, align: 'center' },
      'top-right': { x: 0, y: 0, align: 'right' },
    };
    
    const pos = positions[position] || positions['bottom-center'];
    
    // Add page numbers to each page
    for (let i = 0; i < totalPages; i++) {
      const page = pdf.getPage(i);
      const { width, height } = page.getSize();
      
      let x, y;
      
      if (pos.align === 'center') {
        x = width / 2;
      } else if (pos.align === 'right') {
        x = width - 50;
      } else {
        x = pos.x || 50;
      }
      
      if (position.startsWith('top')) {
        y = height - 50;
      } else {
        y = pos.y || 50;
      }
      
      page.drawText(`${i + 1}`, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    }
    
    const modifiedPdfBytes = await pdf.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create PDF with page numbers');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Add watermark to PDF
 * @param {string} pdfPath - Path to input PDF
 * @param {string} watermarkText - Watermark text
 * @param {string} imagePath - Optional: watermark image path (overrides text)
 * @returns {Promise<string>} Path to watermarked PDF
 */
export async function addWatermark(pdfPath, watermarkText = 'WATERMARK', imagePath = null) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Add watermark to each page
    for (let i = 0; i < totalPages; i++) {
      const page = pdf.getPage(i);
      const { width, height } = page.getSize();
      
      if (imagePath && await verifyFile(imagePath)) {
        // Add image watermark
        const imageBytes = await fs.readFile(imagePath);
        let image;
        
        if (imagePath.endsWith('.png')) {
          image = await pdf.embedPng(imageBytes);
        } else {
          image = await pdf.embedJpg(imageBytes);
        }
        
        const imageDims = image.scale(0.3); // Scale down watermark
        
        page.drawImage(image, {
          x: width / 2 - imageDims.width / 2,
          y: height / 2 - imageDims.height / 2,
          width: imageDims.width,
          height: imageDims.height,
          opacity: 0.3,
        });
      } else {
        // Add text watermark
        const font = await pdf.embedFont(StandardFonts.HelveticaBold);
        const textWidth = font.widthOfTextAtSize(watermarkText, 48);
        const textHeight = font.heightAtSize(48);
        
        page.drawText(watermarkText, {
          x: width / 2 - textWidth / 2,
          y: height / 2 - textHeight / 2,
          size: 48,
          font,
          color: rgb(0.7, 0.7, 0.7),
          rotate: { angle: -45 },
          opacity: 0.3,
        });
      }
    }
    
    const modifiedPdfBytes = await pdf.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create watermarked PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Crop PDF pages
 * @param {string} pdfPath - Path to input PDF
 * @param {number} x - X coordinate of crop box
 * @param {number} y - Y coordinate of crop box
 * @param {number} width - Width of crop box
 * @param {number} height - Height of crop box
 * @param {string} pageRange - Pages to crop (e.g., "1-5", "all")
 * @returns {Promise<string>} Path to cropped PDF
 */
export async function cropPDF(pdfPath, x, y, width, height, pageRange = 'all') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const pdfBytes = await fs.readFile(pdfPath);
    const pdf = await PDFDocument.load(pdfBytes);
    const totalPages = pdf.getPageCount();
    
    // Parse page range
    let pagesToCrop = [];
    if (pageRange === 'all') {
      pagesToCrop = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      const parts = pageRange.split(',');
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
          const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
          for (let i = start - 1; i < (end || totalPages); i++) {
            if (i >= 0 && i < totalPages) {
              pagesToCrop.push(i);
            }
          }
        } else {
          const pageNum = parseInt(trimmed) - 1;
          if (pageNum >= 0 && pageNum < totalPages) {
            pagesToCrop.push(pageNum);
          }
        }
      }
    }
    
    // Crop pages
    for (const pageIndex of pagesToCrop) {
      const page = pdf.getPage(pageIndex);
      const { pageWidth, pageHeight } = page.getSize();
      
      // Set crop box (PDF coordinates: bottom-left is origin)
      // Convert to PDF coordinate system where y=0 is at bottom
      const cropY = pageHeight - y - height;
      
      page.setCropBox(x, cropY, width, height);
    }
    
    const modifiedPdfBytes = await pdf.save();
    await fs.writeFile(outputPath, modifiedPdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create cropped PDF');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Basic PDF edit (re-save with LibreOffice)
 * @param {string} pdfPath - Path to input PDF
 * @returns {Promise<string>} Path to edited PDF
 */
export async function basicEditPDF(pdfPath) {
  // This is essentially a re-save operation
  // We'll use LibreOffice to re-save the PDF
  const outputPath = getTempFilePath('.pdf');
  const outputDir = path.dirname(outputPath);
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    const command = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${pdfPath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('PDF edit failed: ' + result.error);
    }
    
    await delay(2000);
    
    // Find the generated file
    const files = await fs.readdir(outputDir);
    const pdfFile = files.find(f => f.endsWith('.pdf') && f !== path.basename(pdfPath));
    
    if (pdfFile) {
      const generatedPath = path.join(outputDir, pdfFile);
      if (await verifyFile(generatedPath)) {
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    throw new Error('Edited PDF not found');
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

