import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;
import fs from 'fs-extra';
import path from 'path';
import { getSession, updateSession, clearSession, addFileToSession, getSessionFiles, clearSessionFiles } from '../utils/sessionManager.js';
import { getTempFilePath, verifyFile, cleanupFile } from '../utils/fileManager.js';
import { detectFileType, formatFileSize, delay } from '../utils/helpers.js';

// Import all services
import * as pdfService from '../services/pdfService.js';
import * as pdfOptimizeService from '../services/pdfOptimizeService.js';
import * as conversionService from '../services/conversionService.js';
import * as pdfEditService from '../services/pdfEditService.js';
import * as pdfSecurityService from '../services/pdfSecurityService.js';

/**
 * WhatsApp Message Handler
 * Handles all incoming messages and file uploads
 */

/**
 * Get main menu
 */
function getMainMenu() {
  return `📄 *WhatsApp File Converter Bot*

Choose an option:

*ORGANIZE PDF*
1️⃣ Merge PDFs
2️⃣ Split PDF
3️⃣ Remove Pages
4️⃣ Extract Pages

*OPTIMIZE PDF*
5️⃣ Compress PDF
6️⃣ Repair PDF
7️⃣ OCR PDF

*CONVERT TO PDF*
8️⃣ Image → PDF
9️⃣ Word → PDF
🔟 PowerPoint → PDF
1️⃣1️⃣ Excel → PDF
1️⃣2️⃣ HTML → PDF

*CONVERT FROM PDF*
1️⃣3️⃣ PDF → Image
1️⃣4️⃣ PDF → Word
1️⃣5️⃣ PDF → PowerPoint
1️⃣6️⃣ PDF → Excel
1️⃣7️⃣ PDF → PDF/A

*EDIT PDF*
1️⃣8️⃣ Rotate PDF
1️⃣9️⃣ Add Page Numbers
2️⃣0️⃣ Add Watermark
2️⃣1️⃣ Crop PDF
2️⃣2️⃣ Basic Edit

*PDF SECURITY*
2️⃣3️⃣ Unlock PDF
2️⃣4️⃣ Protect PDF
2️⃣5️⃣ Sign PDF
2️⃣6️⃣ Redact PDF
2️⃣7️⃣ Compare PDFs

Type *menu* to see this menu again
Type *cancel* to cancel current operation
Type *clear* to clear all uploaded files`;
}

/**
 * Handle incoming message
 */
export async function handleMessage(message, client) {
  const userId = message.from;
  const body = message.body.trim().toLowerCase();
  const session = getSession(userId);
  
  try {
    // Handle menu commands
    if (body === 'menu' || body === 'start' || body === 'help') {
      await message.reply(getMainMenu());
      updateSession(userId, { currentStep: 'idle', selectedOperation: null });
      return;
    }
    
    if (body === 'cancel') {
      updateSession(userId, { currentStep: 'idle', selectedOperation: null });
      await message.reply('✅ Operation cancelled. Type *menu* to see options.');
      return;
    }
    
    if (body === 'clear') {
      clearSessionFiles(userId);
      updateSession(userId, { currentStep: 'idle', selectedOperation: null });
      await message.reply('✅ All uploaded files cleared. Type *menu* to see options.');
      return;
    }
    
    // Handle file uploads
    if (message.hasMedia) {
      await handleFileUpload(message, client, userId);
      return;
    }
    
    // Handle operation selection
    if (session.currentStep === 'idle') {
      await handleOperationSelection(message, userId);
      return;
    }
    
    // Handle step-by-step operations
    if (session.currentStep !== 'idle') {
      await handleStepOperation(message, userId, client);
      return;
    }
    
    // If we reach here and have an operation selected but no step, user might have sent text instead of file
    if (session.selectedOperation && session.currentStep === 'waiting_for_file') {
      await message.reply('📎 Please send a file. Type *cancel* to cancel or *menu* to see options.');
      return;
    }
    
    // Unknown message
    await message.reply('❓ I didn\'t understand that. Type *menu* to see options.');
    
  } catch (error) {
    console.error('Error handling message:', error);
    await message.reply(`❌ Error: ${error.message}\n\nType *menu* to start over.`);
    updateSession(userId, { currentStep: 'idle', selectedOperation: null });
  }
}

/**
 * Handle file upload
 */
async function handleFileUpload(message, client, userId) {
  try {
    await message.reply('📥 Downloading file...');
    
    const media = await message.downloadMedia();
    if (!media) {
      await message.reply('❌ Failed to download file. Please try again.');
      return;
    }
    
    const fileExtension = media.mimetype.includes('pdf') ? '.pdf' :
                         media.mimetype.includes('image') ? '.jpg' :
                         media.mimetype.includes('word') ? '.docx' :
                         media.mimetype.includes('presentation') ? '.pptx' :
                         media.mimetype.includes('spreadsheet') ? '.xlsx' :
                         media.mimetype.includes('html') ? '.html' : '.bin';
    
    const filePath = getTempFilePath(fileExtension);
    const buffer = Buffer.from(media.data, 'base64');
    await fs.writeFile(filePath, buffer);
    
    if (!(await verifyFile(filePath))) {
      await message.reply('❌ Failed to save file. Please try again.');
      return;
    }
    
    const fileType = detectFileType(filePath, media.mimetype);
    const fileSize = await fs.stat(filePath).then(s => s.size);
    
    // Add file to session
    addFileToSession(userId, {
      path: filePath,
      type: fileType,
      mimetype: media.mimetype,
      size: fileSize,
      filename: media.filename || `file${fileExtension}`,
    });
    
    const session = getSession(userId);
    const fileCount = session.uploadedFiles.length;
    
    await message.reply(`✅ File received! (${formatFileSize(fileSize)})\n\nType *menu* to see options or continue with your current operation.`);
    
    // If operation is selected, check if we need more files
    if (session.selectedOperation) {
      await checkOperationRequirements(message, userId, client);
    }
    
  } catch (error) {
    console.error('Error handling file upload:', error);
    await message.reply(`❌ Error uploading file: ${error.message}`);
  }
}

/**
 * Handle operation selection
 */
async function handleOperationSelection(message, userId) {
  const body = message.body.trim();
  const session = getSession(userId);
  
  const operationMap = {
    '1': 'merge_pdf',
    '2': 'split_pdf',
    '3': 'remove_pages',
    '4': 'extract_pages',
    '5': 'compress_pdf',
    '6': 'repair_pdf',
    '7': 'ocr_pdf',
    '8': 'image_to_pdf',
    '9': 'word_to_pdf',
    '10': 'powerpoint_to_pdf',
    '11': 'excel_to_pdf',
    '12': 'html_to_pdf',
    '13': 'pdf_to_image',
    '14': 'pdf_to_word',
    '15': 'pdf_to_powerpoint',
    '16': 'pdf_to_excel',
    '17': 'pdf_to_pdfa',
    '18': 'rotate_pdf',
    '19': 'add_page_numbers',
    '20': 'add_watermark',
    '21': 'crop_pdf',
    '22': 'basic_edit_pdf',
    '23': 'unlock_pdf',
    '24': 'protect_pdf',
    '25': 'sign_pdf',
    '26': 'redact_pdf',
    '27': 'compare_pdf',
  };
  
  const operation = operationMap[body];
  if (!operation) {
    await message.reply('❌ Invalid option. Please type a number from the menu or *menu* to see options.');
    return;
  }
  
  updateSession(userId, { selectedOperation: operation, currentStep: 'waiting_for_file' });
  
  // Provide instructions based on operation
  const instructions = getOperationInstructions(operation);
  await message.reply(instructions);
}

/**
 * Get operation instructions
 */
function getOperationInstructions(operation) {
  const instructions = {
    'merge_pdf': '📎 *Merge PDFs*\n\nPlease send all PDF files you want to merge (one by one).\nAfter sending all files, type *done* to merge them.',
    'split_pdf': '✂️ *Split PDF*\n\nPlease send the PDF file you want to split.\nAfter sending, I\'ll ask for the page range.',
    'remove_pages': '🗑️ *Remove Pages*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for the pages to remove.',
    'extract_pages': '📄 *Extract Pages*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for the pages to extract.',
    'compress_pdf': '🗜️ *Compress PDF*\n\nPlease send the PDF file to compress.',
    'repair_pdf': '🔧 *Repair PDF*\n\nPlease send the PDF file to repair.',
    'ocr_pdf': '👁️ *OCR PDF*\n\nPlease send the PDF file for OCR processing.',
    'image_to_pdf': '🖼️ *Image to PDF*\n\nPlease send the image file (JPG, PNG, etc.).',
    'word_to_pdf': '📝 *Word to PDF*\n\nPlease send the Word document (.doc or .docx).',
    'powerpoint_to_pdf': '📊 *PowerPoint to PDF*\n\nPlease send the PowerPoint file (.ppt or .pptx).',
    'excel_to_pdf': '📈 *Excel to PDF*\n\nPlease send the Excel file (.xls or .xlsx).',
    'html_to_pdf': '🌐 *HTML to PDF*\n\nPlease send the HTML file.',
    'pdf_to_image': '🖼️ *PDF to Image*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask which page to convert (or type "all" for all pages).',
    'pdf_to_word': '📝 *PDF to Word*\n\n⚠️ Note: PDF to Word conversion has limitations. PDFs are fixed-layout documents, so the output may not be perfectly editable.\n\nPlease send the PDF file.',
    'pdf_to_powerpoint': '📊 *PDF to PowerPoint*\n\nNote: This conversion has limitations. Please send the PDF file.',
    'pdf_to_excel': '📈 *PDF to Excel*\n\nPlease send the PDF file.',
    'pdf_to_pdfa': '📋 *PDF to PDF/A*\n\nPlease send the PDF file.',
    'rotate_pdf': '🔄 *Rotate PDF*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for rotation angle and pages.',
    'add_page_numbers': '🔢 *Add Page Numbers*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for position.',
    'add_watermark': '💧 *Add Watermark*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for watermark text or image.',
    'crop_pdf': '✂️ *Crop PDF*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for crop dimensions.',
    'basic_edit_pdf': '✏️ *Basic Edit PDF*\n\nPlease send the PDF file.',
    'unlock_pdf': '🔓 *Unlock PDF*\n\nPlease send the PDF file.\nIf password protected, I\'ll ask for the password.',
    'protect_pdf': '🔒 *Protect PDF*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for a password.',
    'sign_pdf': '✍️ *Sign PDF*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for the signature image.',
    'redact_pdf': '🖊️ *Redact PDF*\n\nPlease send the PDF file.\nAfter sending, I\'ll ask for redaction areas.',
    'compare_pdf': '🔍 *Compare PDFs*\n\nPlease send the first PDF file.\nAfter sending, I\'ll ask for the second PDF.',
  };
  
  return instructions[operation] || 'Please send the required file.';
}

/**
 * Check operation requirements
 */
async function checkOperationRequirements(message, userId, client) {
  const session = getSession(userId);
  const operation = session.selectedOperation;
  const files = getSessionFiles(userId);
  
  // Operations that need multiple files
  if (operation === 'merge_pdf') {
    if (files.length === 0) {
      await message.reply('📎 Please send PDF files to merge. Type *done* when finished.');
    } else {
      await message.reply(`📎 Received ${files.length} file(s). Send more PDFs or type *done* to merge.`);
    }
    return;
  }
  
  if (operation === 'compare_pdf') {
    if (files.length === 0) {
      await message.reply('📎 Please send the first PDF file.');
    } else if (files.length === 1) {
      await message.reply('📎 Please send the second PDF file to compare.');
    }
    return;
  }
  
  // Operations that need one file
  if (files.length > 0) {
    await processOperation(message, userId, client);
  }
}

/**
 * Handle step-by-step operations
 */
async function handleStepOperation(message, userId, client) {
  const session = getSession(userId);
  const body = message.body.trim();
  const files = getSessionFiles(userId);
  
  // Handle "done" for merge operation
  if (session.selectedOperation === 'merge_pdf' && body === 'done') {
    if (files.length < 2) {
      await message.reply('❌ Please send at least 2 PDF files to merge.');
      return;
    }
    await processOperation(message, userId, client);
    return;
  }
  
  // Handle page range inputs
  if (session.currentStep === 'waiting_for_page_range') {
    session.metadata.pageRange = body;
    updateSession(userId, { currentStep: 'processing' });
    await processOperation(message, userId, client);
    return;
  }
  
  // Handle page number input for PDF to image
  if (session.currentStep === 'waiting_for_page_number') {
    session.metadata.pageNumber = body.toLowerCase();
    updateSession(userId, { currentStep: 'processing' });
    await processOperation(message, userId, client);
    return;
  }
  
  // Handle other step inputs (password, angle, etc.)
  if (session.currentStep.startsWith('waiting_for_')) {
    const inputType = session.currentStep.replace('waiting_for_', '');
    session.metadata[inputType] = body;
    updateSession(userId, { currentStep: 'processing' });
    await processOperation(message, userId, client);
    return;
  }
  
  // If we have files and an operation but no specific step, try to process
  if (files.length > 0 && session.selectedOperation) {
    await processOperation(message, userId, client);
    return;
  }
}

/**
 * Validate file type for operation
 */
function validateFileType(files, requiredType, operationName) {
  if (files.length === 0) {
    throw new Error(`Please send a ${requiredType} file.`);
  }
  if (files[0].type !== requiredType) {
    throw new Error(`Invalid file type for ${operationName}. Expected ${requiredType}, received ${files[0].type || 'unknown'}.`);
  }
}

/**
 * Process the selected operation
 */
async function processOperation(message, userId, client) {
  const session = getSession(userId);
  const operation = session.selectedOperation;
  const files = getSessionFiles(userId);
  const metadata = session.metadata || {};
  
  try {
    await message.reply('⏳ Processing... This may take a moment.');
    
    let outputPath;
    let outputPaths = [];
    
    switch (operation) {
      case 'merge_pdf':
        if (files.length < 2) {
          throw new Error('Please send at least 2 PDF files to merge.');
        }
        const pdfPaths = files.map(f => f.path).filter(p => p.endsWith('.pdf'));
        if (pdfPaths.length < 2) {
          throw new Error('Please send PDF files only.');
        }
        outputPath = await pdfService.mergePDFs(pdfPaths);
        break;
        
      case 'split_pdf':
        validateFileType(files, 'pdf', 'Split PDF');
        if (!metadata.pageRange) {
          updateSession(userId, { currentStep: 'waiting_for_page_range' });
          await message.reply('📄 Please specify page range (e.g., "1-5", "1,3,5", "1-" for all from page 1):');
          return;
        }
        outputPath = await pdfService.splitPDF(files[0].path, metadata.pageRange);
        break;
        
      case 'remove_pages':
        validateFileType(files, 'pdf', 'Remove Pages');
        if (!metadata.pageRange) {
          updateSession(userId, { currentStep: 'waiting_for_page_range' });
          await message.reply('📄 Please specify pages to remove (e.g., "1-3", "5,7,9"):');
          return;
        }
        outputPath = await pdfService.removePages(files[0].path, metadata.pageRange);
        break;
        
      case 'extract_pages':
        validateFileType(files, 'pdf', 'Extract Pages');
        if (!metadata.pageRange) {
          updateSession(userId, { currentStep: 'waiting_for_page_range' });
          await message.reply('📄 Please specify pages to extract (e.g., "1-3", "5,7,9"):');
          return;
        }
        outputPath = await pdfService.extractPages(files[0].path, metadata.pageRange);
        break;
        
      case 'compress_pdf':
        validateFileType(files, 'pdf', 'Compress PDF');
        outputPath = await pdfOptimizeService.compressPDF(files[0].path, metadata.quality || 'ebook');
        break;
        
      case 'repair_pdf':
        validateFileType(files, 'pdf', 'Repair PDF');
        outputPath = await pdfOptimizeService.repairPDF(files[0].path);
        break;
        
      case 'ocr_pdf':
        validateFileType(files, 'pdf', 'OCR PDF');
        outputPath = await pdfOptimizeService.ocrPDF(files[0].path);
        break;
        
      case 'image_to_pdf':
        if (files.length === 0) throw new Error('Please send an image file.');
        if (files[0].type !== 'image') {
          throw new Error(`Please send an image file (JPG, PNG, etc.). Received: ${files[0].type}`);
        }
        outputPath = await conversionService.imageToPDF(files[0].path);
        break;
        
      case 'word_to_pdf':
        if (files.length === 0) throw new Error('Please send a Word document.');
        outputPath = await conversionService.wordToPDF(files[0].path);
        break;
        
      case 'powerpoint_to_pdf':
        if (files.length === 0) throw new Error('Please send a PowerPoint file.');
        outputPath = await conversionService.powerpointToPDF(files[0].path);
        break;
        
      case 'excel_to_pdf':
        if (files.length === 0) throw new Error('Please send an Excel file.');
        outputPath = await conversionService.excelToPDF(files[0].path);
        break;
        
      case 'html_to_pdf':
        if (files.length === 0) throw new Error('Please send an HTML file.');
        outputPath = await conversionService.htmlToPDF(files[0].path);
        break;
        
      case 'pdf_to_image':
        if (files.length === 0) throw new Error('Please send a PDF file.');
        if (files[0].type !== 'pdf') {
          throw new Error(`Please send a PDF file. Received: ${files[0].type}`);
        }
        if (!metadata.pageNumber && metadata.pageNumber !== '0') {
          updateSession(userId, { currentStep: 'waiting_for_page_number' });
          await message.reply('📄 Please specify page number (1, 2, 3, etc.) or type "all" for all pages:');
          return;
        }
        const pageNum = metadata.pageNumber === 'all' || metadata.pageNumber === '0' ? 0 : parseInt(metadata.pageNumber);
        const images = await conversionService.pdfToImage(files[0].path, pageNum);
        outputPaths = Array.isArray(images) ? images : [images];
        break;
        
      case 'pdf_to_word':
        validateFileType(files, 'pdf', 'PDF to Word');
        outputPath = await conversionService.pdfToWord(files[0].path);
        break;
        
      case 'pdf_to_powerpoint':
        validateFileType(files, 'pdf', 'PDF to PowerPoint');
        outputPath = await conversionService.pdfToPowerpoint(files[0].path);
        break;
        
      case 'pdf_to_excel':
        validateFileType(files, 'pdf', 'PDF to Excel');
        outputPath = await conversionService.pdfToExcel(files[0].path);
        break;
        
      case 'pdf_to_pdfa':
        validateFileType(files, 'pdf', 'PDF to PDF/A');
        outputPath = await conversionService.pdfToPDFA(files[0].path);
        break;
        
      case 'rotate_pdf':
        validateFileType(files, 'pdf', 'Rotate PDF');
        if (!metadata.angle) {
          updateSession(userId, { currentStep: 'waiting_for_angle' });
          await message.reply('🔄 Please specify rotation angle (90, 180, or 270):');
          return;
        }
        if (!metadata.pageRange) {
          updateSession(userId, { currentStep: 'waiting_for_page_range' });
          await message.reply('📄 Please specify pages to rotate (e.g., "1-5" or "all"):');
          return;
        }
        outputPath = await pdfEditService.rotatePDF(files[0].path, parseInt(metadata.angle), metadata.pageRange);
        break;
        
      case 'add_page_numbers':
        validateFileType(files, 'pdf', 'Add Page Numbers');
        if (!metadata.position) {
          updateSession(userId, { currentStep: 'waiting_for_position' });
          await message.reply('🔢 Please specify position (bottom-left, bottom-center, bottom-right, top-left, top-center, top-right):');
          return;
        }
        outputPath = await pdfEditService.addPageNumbers(files[0].path, metadata.position);
        break;
        
      case 'add_watermark':
        validateFileType(files, 'pdf', 'Add Watermark');
        if (!metadata.watermarkText && files.length < 2) {
          updateSession(userId, { currentStep: 'waiting_for_watermark' });
          await message.reply('💧 Please send watermark image or type watermark text:');
          return;
        }
        const watermarkImage = files.length > 1 ? files[1].path : null;
        outputPath = await pdfEditService.addWatermark(files[0].path, metadata.watermarkText || 'WATERMARK', watermarkImage);
        break;
        
      case 'crop_pdf':
        validateFileType(files, 'pdf', 'Crop PDF');
        // For simplicity, we'll use default crop values
        // In a full implementation, you'd ask for x, y, width, height
        await message.reply('❌ Crop PDF requires specific dimensions. This feature needs manual input.');
        updateSession(userId, { currentStep: 'idle', selectedOperation: null });
        return;
        
      case 'basic_edit_pdf':
        validateFileType(files, 'pdf', 'Basic Edit PDF');
        outputPath = await pdfEditService.basicEditPDF(files[0].path);
        break;
        
      case 'unlock_pdf':
        validateFileType(files, 'pdf', 'Unlock PDF');
        outputPath = await pdfSecurityService.unlockPDF(files[0].path, metadata.password || '');
        break;
        
      case 'protect_pdf':
        validateFileType(files, 'pdf', 'Protect PDF');
        if (!metadata.password) {
          updateSession(userId, { currentStep: 'waiting_for_password' });
          await message.reply('🔒 Please provide a password:');
          return;
        }
        outputPath = await pdfSecurityService.protectPDF(files[0].path, metadata.password);
        break;
        
      case 'sign_pdf':
        validateFileType(files, 'pdf', 'Sign PDF');
        if (files.length < 2) {
          updateSession(userId, { currentStep: 'waiting_for_signature' });
          await message.reply('✍️ Please send the signature image:');
          return;
        }
        outputPath = await pdfSecurityService.signPDF(files[0].path, files[1].path, metadata.position || 'bottom-right');
        break;
        
      case 'redact_pdf':
        validateFileType(files, 'pdf', 'Redact PDF');
        await message.reply('❌ Redact PDF requires specific coordinates. This feature needs manual input.');
        updateSession(userId, { currentStep: 'idle', selectedOperation: null });
        return;
        
      case 'compare_pdf':
        if (files.length < 2) {
          await message.reply('📎 Please send the second PDF file to compare.');
          return;
        }
        if (files[0].type !== 'pdf' || files[1].type !== 'pdf') {
          throw new Error('Both files must be PDFs for comparison.');
        }
        const comparison = await pdfSecurityService.comparePDFs(files[0].path, files[1].path);
        await message.reply(`🔍 *Comparison Results:*\n\n` +
          `Page Count Match: ${comparison.pageCountMatch ? '✅' : '❌'}\n` +
          `PDF 1 Pages: ${comparison.pageCount1}\n` +
          `PDF 2 Pages: ${comparison.pageCount2}\n` +
          `File Size Match: ${comparison.fileSizeMatch ? '✅' : '❌'}\n` +
          `Identical: ${comparison.identical ? '✅' : '❌'}`);
        updateSession(userId, { currentStep: 'idle', selectedOperation: null });
        clearSessionFiles(userId);
        return;
        
      default:
        throw new Error('Unknown operation');
    }
    
    // Send output file(s)
    if (outputPaths.length > 0) {
      for (const outPath of outputPaths) {
        if (await verifyFile(outPath)) {
          await sendFile(message, outPath, client);
          await delay(500);
        }
      }
    } else if (outputPath && await verifyFile(outputPath)) {
      await sendFile(message, outputPath, client);
    } else {
      throw new Error('Failed to create output file');
    }
    
    await message.reply('✅ Done! Type *menu* to see more options.');
    
    // Cleanup and reset
    clearSessionFiles(userId);
    updateSession(userId, { currentStep: 'idle', selectedOperation: null, metadata: {} });
    
  } catch (error) {
    console.error('Error processing operation:', error);
    await message.reply(`❌ Error: ${error.message}\n\nType *menu* to start over.`);
    updateSession(userId, { currentStep: 'idle', selectedOperation: null });
  }
}

/**
 * Send file via WhatsApp
 */
async function sendFile(message, filePath, client) {
  try {
    const media = MessageMedia.fromFilePath(filePath);
    await message.reply(media);
    
    // Cleanup after sending
    await delay(1000);
    await cleanupFile(filePath);
  } catch (error) {
    console.error('Error sending file:', error);
    throw new Error('Failed to send file: ' + error.message);
  }
}

