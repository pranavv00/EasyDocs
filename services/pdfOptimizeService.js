import fs from 'fs-extra';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { execCommand, delay } from '../utils/helpers.js';
import path from 'path';

/**
 * PDF Optimization Service
 * Handles compression, repair, and OCR operations
 */

/**
 * Compress PDF using Ghostscript
 * @param {string} pdfPath - Path to input PDF
 * @param {string} quality - Compression quality: 'screen', 'ebook', 'printer', 'prepress'
 * @returns {Promise<string>} Path to compressed PDF
 */
export async function compressPDF(pdfPath, quality = 'ebook') {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // Ghostscript quality settings
    const qualitySettings = {
      screen: '/screen',
      ebook: '/ebook',
      printer: '/printer',
      prepress: '/prepress',
    };
    
    const dpi = quality === 'screen' ? 72 : quality === 'ebook' ? 150 : 300;
    const qualitySetting = qualitySettings[quality] || qualitySettings.ebook;
    
    // Use Ghostscript to compress
    const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${qualitySetting} -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages=true -dCompressFonts=true -r${dpi} -sOutputFile="${outputPath}" "${pdfPath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      // Fallback: try with LibreOffice
      return await compressPDFWithLibreOffice(pdfPath);
    }
    
    await delay(500); // Small delay to ensure file is written
    
    if (!(await verifyFile(outputPath))) {
      // Fallback to LibreOffice
      await cleanupFile(outputPath);
      return await compressPDFWithLibreOffice(pdfPath);
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Compress PDF using LibreOffice (fallback)
 * @param {string} pdfPath - Path to input PDF
 * @returns {Promise<string>} Path to compressed PDF
 */
async function compressPDFWithLibreOffice(pdfPath) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    // LibreOffice can re-save PDFs with compression
    const command = `soffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${pdfPath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('Compression failed');
    }
    
    await delay(1000);
    
    // Find the output file (LibreOffice may rename it)
    const dir = path.dirname(outputPath);
    const files = await fs.readdir(dir);
    const pdfFile = files.find(f => f.endsWith('.pdf') && f !== path.basename(pdfPath));
    
    if (pdfFile) {
      const generatedPath = path.join(dir, pdfFile);
      if (await verifyFile(generatedPath)) {
        // Rename to our output path
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    throw new Error('Compressed PDF not found');
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Repair PDF by re-saving with LibreOffice
 * @param {string} pdfPath - Path to input PDF
 * @returns {Promise<string>} Path to repaired PDF
 */
export async function repairPDF(pdfPath) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // Try to repair using Ghostscript first
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${pdfPath}"`;
    
    const gsResult = await execCommand(gsCommand);
    
    if (gsResult.success) {
      await delay(500);
      if (await verifyFile(outputPath)) {
        return outputPath;
      }
    }
    
    // Fallback to LibreOffice
    await cleanupFile(outputPath);
    const loCommand = `soffice --headless --convert-to pdf --outdir "${path.dirname(outputPath)}" "${pdfPath}"`;
    
    const loResult = await execCommand(loCommand);
    
    if (!loResult.success) {
      throw new Error('PDF repair failed');
    }
    
    await delay(1000);
    
    // Find the output file
    const dir = path.dirname(outputPath);
    const files = await fs.readdir(dir);
    const pdfFile = files.find(f => f.endsWith('.pdf') && f !== path.basename(pdfPath));
    
    if (pdfFile) {
      const generatedPath = path.join(dir, pdfFile);
      if (await verifyFile(generatedPath)) {
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    throw new Error('Repaired PDF not found');
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Perform OCR on PDF using Tesseract
 * @param {string} pdfPath - Path to input PDF
 * @returns {Promise<string>} Path to OCR'd PDF
 */
export async function ocrPDF(pdfPath) {
  const outputPath = getTempFilePath('.pdf');
  const tempDir = path.dirname(outputPath);
  const tempImagesDir = path.join(tempDir, `ocr_images_${Date.now()}`);
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    await fs.ensureDir(tempImagesDir);
    
    // Convert PDF to images using pdftoppm (from poppler)
    const imagePrefix = path.join(tempImagesDir, 'page');
    const convertCommand = `pdftoppm -png "${pdfPath}" "${imagePrefix}"`;
    
    const convertResult = await execCommand(convertCommand);
    
    if (!convertResult.success) {
      throw new Error('Failed to convert PDF to images');
    }
    
    await delay(1000);
    
    // Get all generated images
    const imageFiles = (await fs.readdir(tempImagesDir))
      .filter(f => f.endsWith('.png'))
      .sort();
    
    if (imageFiles.length === 0) {
      throw new Error('No images generated from PDF');
    }
    
    // OCR each image and create PDF with text layer
    // For now, we'll use a simpler approach: convert images back to PDF
    // Full OCR with text layer requires more complex setup
    
    // Use tesseract to OCR and create PDF
    const ocrPdfs = [];
    
    for (const imageFile of imageFiles) {
      const imagePath = path.join(tempImagesDir, imageFile);
      const ocrPdfPath = path.join(tempImagesDir, `${path.basename(imageFile, '.png')}.pdf`);
      
      // Tesseract OCR to PDF
      const ocrCommand = `tesseract "${imagePath}" "${ocrPdfPath.replace('.pdf', '')}" -l eng pdf`;
      const ocrResult = await execCommand(ocrCommand);
      
      if (ocrResult.success) {
        await delay(500);
        if (await verifyFile(ocrPdfPath)) {
          ocrPdfs.push(ocrPdfPath);
        }
      }
    }
    
    if (ocrPdfs.length === 0) {
      throw new Error('OCR failed - no PDFs generated');
    }
    
    // Merge OCR'd PDFs
    if (ocrPdfs.length === 1) {
      await fs.copy(ocrPdfs[0], outputPath);
    } else {
      // Use pdftk or pdfunite to merge
      const mergeCommand = `pdfunite ${ocrPdfs.map(p => `"${p}"`).join(' ')} "${outputPath}"`;
      const mergeResult = await execCommand(mergeCommand);
      
      if (!mergeResult.success) {
        // Fallback: use pdf-lib
        const { mergePDFs } = await import('./pdfService.js');
        const merged = await mergePDFs(ocrPdfs);
        await fs.move(merged, outputPath, { overwrite: true });
      }
    }
    
    // Cleanup temp images
    await fs.remove(tempImagesDir);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('OCR PDF not created');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    await fs.remove(tempImagesDir).catch(() => {});
    throw error;
  }
}

