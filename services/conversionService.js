import fs from 'fs-extra';
import path from 'path';
import sharp from 'sharp';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { execCommand, delay } from '../utils/helpers.js';
import { PDFDocument } from 'pdf-lib';

/**
 * Conversion Service
 * Handles conversions TO and FROM PDF
 */

/**
 * Convert JPG/Image to PDF
 * @param {string} imagePath - Path to image file
 * @returns {Promise<string>} Path to output PDF
 */
export async function imageToPDF(imagePath) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(imagePath))) {
      throw new Error('Input image not found');
    }
    
    // Use pdf-lib to create PDF from image
    const pdfDoc = await PDFDocument.create();
    
    // Read image file
    const imageBytes = await fs.readFile(imagePath);
    const ext = path.extname(imagePath).toLowerCase();
    
    let image;
    if (ext === '.png') {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (['.jpg', '.jpeg'].includes(ext)) {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      // Try to convert other formats to PNG first using sharp
      const pngBuffer = await sharp(imageBytes).png().toBuffer();
      image = await pdfDoc.embedPng(pngBuffer);
    }
    
    // Get image dimensions
    const imageDims = image.scale(1);
    
    // Create a page with the same size as the image
    const page = pdfDoc.addPage([imageDims.width, imageDims.height]);
    
    // Draw the image on the page
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: imageDims.width,
      height: imageDims.height,
    });
    
    // Save the PDF
    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(outputPath, pdfBytes);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('Failed to create PDF from image');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Convert Word document to PDF using LibreOffice
 * @param {string} wordPath - Path to Word document
 * @returns {Promise<string>} Path to output PDF
 */
export async function wordToPDF(wordPath) {
  return await officeToPDF(wordPath);
}

/**
 * Convert PowerPoint to PDF using LibreOffice
 * @param {string} pptPath - Path to PowerPoint file
 * @returns {Promise<string>} Path to output PDF
 */
export async function powerpointToPDF(pptPath) {
  return await officeToPDF(pptPath);
}

/**
 * Convert Excel to PDF using LibreOffice
 * @param {string} excelPath - Path to Excel file
 * @returns {Promise<string>} Path to output PDF
 */
export async function excelToPDF(excelPath) {
  return await officeToPDF(excelPath);
}

/**
 * Generic Office document to PDF converter
 * @param {string} officePath - Path to Office document
 * @returns {Promise<string>} Path to output PDF
 */
async function officeToPDF(officePath) {
  const outputPath = getTempFilePath('.pdf');
  const outputDir = path.dirname(outputPath);
  
  try {
    if (!(await verifyFile(officePath))) {
      throw new Error('Input file not found');
    }
    
    const command = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${officePath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('Conversion failed: ' + result.error);
    }
    
    await delay(3000); // LibreOffice needs time to process
    
    // Find the generated PDF file
    const files = await fs.readdir(outputDir);
    const inputBasename = path.basename(officePath, path.extname(officePath));
    
    // Try multiple strategies to find the output file
    let pdfFile = files.find(f => 
      f.endsWith('.pdf') && 
      (f.startsWith(inputBasename) || f.toLowerCase().includes(inputBasename.toLowerCase()))
    );
    
    // If not found, look for any recently created PDF file
    if (!pdfFile) {
      const now = Date.now();
      let latestFile = null;
      let latestTime = 0;
      
      const pdfFiles = files.filter(f => f.endsWith('.pdf'));
      for (const file of pdfFiles) {
        try {
          const filePath = path.join(outputDir, file);
          const stats = await fs.stat(filePath);
          // Check if file was created in the last 10 seconds
          if (now - stats.mtimeMs < 10000 && stats.mtimeMs > latestTime) {
            latestTime = stats.mtimeMs;
            latestFile = file;
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      if (latestFile) {
        pdfFile = latestFile;
      }
    }
    
    if (pdfFile) {
      const generatedPath = path.join(outputDir, pdfFile);
      if (await verifyFile(generatedPath)) {
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    throw new Error(`Converted PDF not found. Files in directory: ${files.slice(0, 10).join(', ')}`);
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Convert HTML to PDF using headless browser approach
 * For now, we'll use a simple approach with html-pdf-node or LibreOffice
 * @param {string} htmlPath - Path to HTML file
 * @returns {Promise<string>} Path to output PDF
 */
export async function htmlToPDF(htmlPath) {
  const outputPath = getTempFilePath('.pdf');
  const outputDir = path.dirname(outputPath);
  
  try {
    if (!(await verifyFile(htmlPath))) {
      throw new Error('Input HTML file not found');
    }
    
    // Try LibreOffice first (it can convert HTML to PDF)
    const command = `soffice --headless --convert-to pdf --outdir "${outputDir}" "${htmlPath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('HTML to PDF conversion failed: ' + result.error);
    }
    
    await delay(3000);
    
    // Find the generated PDF
    const files = await fs.readdir(outputDir);
    const inputBasename = path.basename(htmlPath, path.extname(htmlPath));
    
    // Try multiple strategies to find the output file
    let pdfFile = files.find(f => 
      f.endsWith('.pdf') && 
      (f.startsWith(inputBasename) || f.toLowerCase().includes(inputBasename.toLowerCase()))
    );
    
    // If not found, look for any recently created PDF file
    if (!pdfFile) {
      const now = Date.now();
      let latestFile = null;
      let latestTime = 0;
      
      const pdfFiles = files.filter(f => f.endsWith('.pdf'));
      for (const file of pdfFiles) {
        try {
          const filePath = path.join(outputDir, file);
          const stats = await fs.stat(filePath);
          // Check if file was created in the last 10 seconds
          if (now - stats.mtimeMs < 10000 && stats.mtimeMs > latestTime) {
            latestTime = stats.mtimeMs;
            latestFile = file;
          }
        } catch (e) {
          // Ignore errors
        }
      }
      
      if (latestFile) {
        pdfFile = latestFile;
      }
    }
    
    if (pdfFile) {
      const generatedPath = path.join(outputDir, pdfFile);
      if (await verifyFile(generatedPath)) {
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    throw new Error(`Converted PDF not found. Files in directory: ${files.slice(0, 10).join(', ')}`);
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Convert PDF to JPG/Images
 * @param {string} pdfPath - Path to PDF file
 * @param {number} pageNumber - Page number to convert (0 for all pages)
 * @returns {Promise<string|string[]>} Path(s) to output image(s)
 */
export async function pdfToImage(pdfPath, pageNumber = 0) {
  const outputDir = path.dirname(getTempFilePath('.jpg'));
  const outputPrefix = path.join(outputDir, `pdf_image_${Date.now()}`);
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // Verify it's actually a PDF file
    const ext = path.extname(pdfPath).toLowerCase();
    if (ext !== '.pdf') {
      throw new Error(`Input file is not a PDF (extension: ${ext}). Please send a PDF file.`);
    }
    
    // Quick check: try to read first few bytes to verify it's a PDF
    const fileBuffer = await fs.readFile(pdfPath);
    const header = fileBuffer.slice(0, 4).toString();
    if (header !== '%PDF') {
      throw new Error('Input file does not appear to be a valid PDF file. Please send a PDF file.');
    }
    
    // Use pdftoppm (from poppler) to convert PDF to images
    let command;
    if (pageNumber > 0) {
      // Convert specific page (0-indexed)
      command = `pdftoppm -png -f ${pageNumber - 1} -l ${pageNumber - 1} "${pdfPath}" "${outputPrefix}"`;
    } else {
      // Convert all pages
      command = `pdftoppm -png "${pdfPath}" "${outputPrefix}"`;
    }
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('PDF to image conversion failed: ' + result.error);
    }
    
    await delay(1000);
    
    // Find generated images
    const files = await fs.readdir(outputDir);
    const imageFiles = files
      .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith('.png'))
      .sort();
    
    if (imageFiles.length === 0) {
      throw new Error('No images generated');
    }
    
    // Convert PNG to JPG using sharp
    const jpgPaths = [];
    for (const imageFile of imageFiles) {
      const pngPath = path.join(outputDir, imageFile);
      const jpgPath = pngPath.replace('.png', '.jpg');
      
      await sharp(pngPath)
        .jpeg({ quality: 90 })
        .toFile(jpgPath);
      
      await fs.remove(pngPath); // Remove PNG
      jpgPaths.push(jpgPath);
    }
    
    return pageNumber > 0 ? jpgPaths[0] : jpgPaths;
  } catch (error) {
    // Cleanup any generated files
    const files = await fs.readdir(outputDir).catch(() => []);
    for (const file of files) {
      if (file.startsWith(path.basename(outputPrefix))) {
        await fs.remove(path.join(outputDir, file)).catch(() => {});
      }
    }
    throw error;
  }
}

/**
 * Convert PDF to Word using LibreOffice
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Path to output Word document
 */
export async function pdfToWord(pdfPath) {
  return await pdfToOffice(pdfPath, 'docx');
}

/**
 * Convert PDF to PowerPoint using LibreOffice
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Path to output PowerPoint file
 */
export async function pdfToPowerpoint(pdfPath) {
  // PDF to PPT is tricky - we'll convert to images first, then to PPT
  // For now, return error as this is complex
  throw new Error('PDF to PowerPoint conversion is not directly supported. Please use PDF to Word or PDF to Images instead.');
}

/**
 * Convert PDF to Excel using LibreOffice
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Path to output Excel file
 */
export async function pdfToExcel(pdfPath) {
  return await pdfToOffice(pdfPath, 'xlsx');
}

/**
 * Generic PDF to Office converter
 * @param {string} pdfPath - Path to PDF file
 * @param {string} format - Output format (docx, xlsx, etc.)
 * @returns {Promise<string>} Path to output file
 */
async function pdfToOffice(pdfPath, format) {
  const outputPath = getTempFilePath(`.${format}`);
  const outputDir = path.dirname(outputPath);
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // LibreOffice has limited support for PDF to Office conversions
    // Try ODT first for Word, then convert if needed
    let targetFormat = format;
    if (format === 'docx') {
      // Try ODT first (better support), then we'll convert to DOCX
      targetFormat = 'odt';
    }
    
    const command = `soffice --headless --convert-to ${targetFormat} --outdir "${outputDir}" "${pdfPath}" 2>&1`;
    
    const result = await execCommand(command);
    
    // Log the output for debugging
    if (result.output) {
      console.log('LibreOffice output:', result.output);
    }
    if (result.error && !result.success) {
      console.log('LibreOffice error:', result.error);
    }
    
    // Check if command succeeded (LibreOffice returns 0 even if conversion fails sometimes)
    // So we need to check if the file was actually created
    await delay(4000);
    const filesAfter = await fs.readdir(outputDir);
    const hasOutput = filesAfter.some(f => 
      f.endsWith(`.${targetFormat}`) || (format === 'docx' && f.endsWith('.odt'))
    );
    
    if (!result.success && !hasOutput) {
      throw new Error(`PDF to ${format.toUpperCase()} conversion failed. LibreOffice may not support this conversion. Error: ${result.error || 'Unknown error'}`);
    }
    
    // If command failed but file exists, continue (LibreOffice sometimes returns non-zero exit codes)
    if (!result.success && hasOutput) {
      console.log('LibreOffice command reported failure but output file exists, continuing...');
    }
    
    await delay(4000); // Increased delay for LibreOffice
    
    // Find the generated file - LibreOffice creates files based on input name
    const files = await fs.readdir(outputDir);
    const inputBasename = path.basename(pdfPath, '.pdf');
    
    // First, try to find the target format (e.g., .docx)
    let outputFile = files.find(f => 
      f.endsWith(`.${format}`) && 
      (f.startsWith(inputBasename) || f.toLowerCase().includes(inputBasename.toLowerCase()))
    );
    
    // If converting to docx and not found, look for ODT file (intermediate format)
    if (!outputFile && format === 'docx') {
      const odtFile = files.find(f => 
        f.endsWith('.odt') && 
        (f.startsWith(inputBasename) || f.toLowerCase().includes(inputBasename.toLowerCase()))
      );
      
      if (odtFile) {
        // Convert ODT to DOCX
        const odtPath = path.join(outputDir, odtFile);
        const docxPath = path.join(outputDir, path.basename(odtFile, '.odt') + '.docx');
        const convertCmd = `soffice --headless --convert-to docx --outdir "${outputDir}" "${odtPath}"`;
        const convertResult = await execCommand(convertCmd);
        await delay(2000);
        
        // Check if DOCX was created
        const newFiles = await fs.readdir(outputDir);
        const createdDocx = newFiles.find(f => f.endsWith('.docx') && f !== path.basename(outputPath));
        if (createdDocx) {
          outputFile = createdDocx;
        } else {
          // If DOCX conversion failed, use ODT file
          outputFile = odtFile;
          // Change output extension to .odt
          const odtOutputPath = outputPath.replace('.docx', '.odt');
          const generatedPath = path.join(outputDir, odtFile);
          if (await verifyFile(generatedPath)) {
            await fs.move(generatedPath, odtOutputPath, { overwrite: true });
            return odtOutputPath;
          }
        }
      }
    }
    
    // If not found, look for any recently created file with the correct extension
    if (!outputFile) {
      const now = Date.now();
      let latestFile = null;
      let latestTime = 0;
      
      for (const file of files) {
        if (file.endsWith(`.${format}`) || (format === 'docx' && file.endsWith('.odt'))) {
          try {
            const filePath = path.join(outputDir, file);
            const stats = await fs.stat(filePath);
            // Check if file was created in the last 15 seconds
            if (now - stats.mtimeMs < 15000 && stats.mtimeMs > latestTime) {
              latestTime = stats.mtimeMs;
              latestFile = file;
            }
          } catch (e) {
            // Ignore errors
          }
        }
      }
      
      if (latestFile) {
        outputFile = latestFile;
      }
    }
    
    // Last resort: find any .format file in the directory
    if (!outputFile) {
      const formatFiles = files.filter(f => f.endsWith(`.${format}`) || (format === 'docx' && f.endsWith('.odt')));
      if (formatFiles.length > 0) {
        // Get the most recently modified one
        let latestFile = null;
        let latestTime = 0;
        for (const file of formatFiles) {
          try {
            const filePath = path.join(outputDir, file);
            const stats = await fs.stat(filePath);
            if (stats.mtimeMs > latestTime) {
              latestTime = stats.mtimeMs;
              latestFile = file;
            }
          } catch (e) {
            // Ignore errors
          }
        }
        outputFile = latestFile;
      }
    }
    
    if (outputFile) {
      const generatedPath = path.join(outputDir, outputFile);
      if (await verifyFile(generatedPath)) {
        // If we got an ODT file but need DOCX, try to convert it
        if (outputFile.endsWith('.odt') && format === 'docx') {
          const finalDocxPath = path.join(outputDir, path.basename(outputFile, '.odt') + '.docx');
          const convertCmd = `soffice --headless --convert-to docx --outdir "${outputDir}" "${generatedPath}"`;
          await execCommand(convertCmd);
          await delay(2000);
          
          const newFiles = await fs.readdir(outputDir);
          const docxFile = newFiles.find(f => f.endsWith('.docx') && f.startsWith(path.basename(outputFile, '.odt')));
          if (docxFile) {
            const docxPath = path.join(outputDir, docxFile);
            if (await verifyFile(docxPath)) {
              await fs.move(docxPath, outputPath, { overwrite: true });
              await fs.remove(generatedPath).catch(() => {}); // Clean up ODT
              return outputPath;
            }
          }
          // If conversion failed, return ODT with warning
          await fs.move(generatedPath, outputPath.replace('.docx', '.odt'), { overwrite: true });
          throw new Error('PDF to DOCX conversion is limited. LibreOffice created an ODT file instead. ODT files can be opened in Microsoft Word, LibreOffice, or Google Docs.');
        }
        
        await fs.move(generatedPath, outputPath, { overwrite: true });
        return outputPath;
      }
    }
    
    // Debug: list what files are actually in the directory
    const debugFiles = files.filter(f => f.endsWith(`.${format}`) || (format === 'docx' && f.endsWith('.odt')));
    throw new Error(`PDF to ${format.toUpperCase()} conversion failed. LibreOffice may not support this conversion well. Files found: ${files.slice(0, 10).join(', ')}. Looking for .${format} or .odt files: ${debugFiles.join(', ')}. Note: PDF to Word conversion has limitations as PDFs are fixed-layout documents.`);
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

/**
 * Convert PDF to PDF/A (archival format)
 * @param {string} pdfPath - Path to PDF file
 * @returns {Promise<string>} Path to PDF/A file
 */
export async function pdfToPDFA(pdfPath) {
  const outputPath = getTempFilePath('.pdf');
  
  try {
    if (!(await verifyFile(pdfPath))) {
      throw new Error('Input PDF not found');
    }
    
    // Use Ghostscript to convert to PDF/A
    const command = `gs -dPDFA -dBATCH -dNOPAUSE -dUseCIEColor -sProcessColorModel=DeviceRGB -sDEVICE=pdfwrite -sPDFACompatibilityPolicy=1 -sOutputFile="${outputPath}" "${pdfPath}"`;
    
    const result = await execCommand(command);
    
    if (!result.success) {
      throw new Error('PDF/A conversion failed: ' + result.error);
    }
    
    await delay(500);
    
    if (!(await verifyFile(outputPath))) {
      throw new Error('PDF/A file not created');
    }
    
    return outputPath;
  } catch (error) {
    await cleanupFile(outputPath);
    throw error;
  }
}

