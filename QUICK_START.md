# Quick Start Guide

## 1. Install Dependencies

### macOS
```bash
brew install libreoffice poppler imagemagick tesseract ghostscript
```

### Linux
```bash
sudo apt-get install -y libreoffice poppler-utils imagemagick tesseract-ocr ghostscript
```

## 2. Install Node.js Packages
```bash
npm install
```

## 3. Run the Bot
```bash
npm start
```

## 4. Connect WhatsApp
- Scan the QR code with your WhatsApp
- Use a secondary number (not your primary)

## 5. Start Using
- Send any message to see the menu
- Type a number (1-27) to select an operation
- Follow the prompts

## Example Workflow

### Merge PDFs
1. Type `1` (Merge PDFs)
2. Send first PDF file
3. Send second PDF file
4. Send more PDFs if needed
5. Type `done` to merge
6. Receive merged PDF

### Compress PDF
1. Type `5` (Compress PDF)
2. Send PDF file
3. Receive compressed PDF

### Image to PDF
1. Type `8` (Image → PDF)
2. Send image file (JPG, PNG, etc.)
3. Receive PDF

## Commands
- `menu` - Show main menu
- `cancel` - Cancel current operation
- `clear` - Clear all uploaded files

## Troubleshooting

**QR Code not showing?**
- Use a terminal that supports QR codes
- Try a different terminal

**LibreOffice not found?**
```bash
# macOS
export PATH="/Applications/LibreOffice.app/Contents/MacOS:$PATH"

# Verify
which soffice
```

**Conversion fails?**
- Check file is not corrupted
- Ensure file is not password-protected
- Try a smaller file first

## File Limits
- WhatsApp limit: ~100MB per file
- Large files take longer to process
- Temp files auto-cleanup after 1 hour

