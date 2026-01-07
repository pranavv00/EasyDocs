# Setup Guide

## Prerequisites

### macOS

1. Install Homebrew (if not already installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

2. Install required system dependencies:
```bash
brew install libreoffice
brew install poppler
brew install imagemagick
brew install tesseract
brew install ghostscript
```

### Linux (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y libreoffice poppler-utils imagemagick tesseract-ocr ghostscript
```

### Linux (CentOS/RHEL)

```bash
sudo yum install -y libreoffice poppler-utils ImageMagick tesseract ghostscript
```

## Installation

1. Navigate to the project directory:
```bash
cd whatsapp-file-converter
```

2. Install Node.js dependencies:
```bash
npm install
```

## Running the Bot

1. Start the bot:
```bash
npm start
```

2. Scan the QR code with your WhatsApp (use a secondary number, not your primary)

3. The bot will be ready to receive messages!

## Usage

1. Send any message to the bot to see the main menu
2. Type a number (1-27) to select an operation
3. Follow the instructions to upload files and provide inputs
4. The bot will process your request and send back the result

## Troubleshooting

### QR Code not appearing
- Make sure you're running the bot in a terminal that supports QR code display
- Try running in a different terminal

### LibreOffice not found
- Make sure LibreOffice is installed and in your PATH
- Try: `which soffice` to verify installation
- On macOS, you may need to add LibreOffice to PATH:
  ```bash
  export PATH="/Applications/LibreOffice.app/Contents/MacOS:$PATH"
  ```

### Ghostscript not found
- Verify installation: `which gs`
- On some systems, Ghostscript command is `gswin64c` (Windows) or `gs` (Linux/macOS)

### Tesseract OCR not working
- Verify installation: `which tesseract`
- Make sure English language data is installed:
  - macOS: `brew install tesseract-lang` (includes English)
  - Linux: `sudo apt-get install tesseract-ocr-eng`

### File conversion fails
- Check that input files are not corrupted
- Ensure files are not password-protected (unless using unlock feature)
- For large files, processing may take longer

### Bot crashes
- Check system resources (memory, disk space)
- Ensure all dependencies are installed
- Check logs for specific error messages

## File Size Limits

- WhatsApp has a file size limit of ~100MB
- Large PDFs may take longer to process
- Consider compressing files before sending if they're very large

## Security Notes

- This bot runs locally on your machine
- Files are stored temporarily in the `temp/` directory
- Files are automatically cleaned up after processing
- Never share your `.wwebjs_auth` folder (contains WhatsApp session)

## Production Deployment (Linux VPS)

1. Install all prerequisites (see Linux section above)
2. Install Node.js (v18 or higher):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. Install PM2 for process management:
```bash
sudo npm install -g pm2
```

4. Start the bot with PM2:
```bash
pm2 start index.js --name whatsapp-converter
pm2 save
pm2 startup
```

5. Monitor the bot:
```bash
pm2 logs whatsapp-converter
pm2 status
```

