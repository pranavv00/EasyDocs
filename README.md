# WhatsApp File Converter Bot

A free, open-source WhatsApp-based document automation bot similar to iLovePDF.

## Features

### Organize PDF
- Merge PDFs
- Split PDF
- Remove pages
- Extract pages

### Optimize PDF
- Compress PDF
- Repair PDF
- OCR PDF

### Convert TO PDF
- JPG → PDF
- WORD → PDF
- POWERPOINT → PDF
- EXCEL → PDF
- HTML → PDF

### Convert FROM PDF
- PDF → JPG
- PDF → WORD
- PDF → POWERPOINT
- PDF → EXCEL
- PDF → PDF/A

### Edit PDF
- Rotate PDF
- Add page numbers
- Add watermark
- Crop PDF
- Basic edit

### PDF Security
- Unlock PDF
- Protect PDF (password)
- Sign PDF
- Redact PDF
- Compare PDF

## Prerequisites

### System Dependencies (macOS)
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install libreoffice
brew install poppler
brew install imagemagick
brew install tesseract
brew install ghostscript
```

### System Dependencies (Linux)
```bash
sudo apt-get update
sudo apt-get install -y libreoffice poppler-utils imagemagick tesseract-ocr ghostscript
```

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```

Scan the QR code with your WhatsApp to connect.

## Architecture

- `index.js` - Main entry point, WhatsApp initialization
- `handlers/` - WhatsApp message handlers and session management
- `services/` - Conversion and processing services
- `utils/` - Utility functions for file management
- `temp/` - Temporary file storage (auto-cleaned)

## Session Management

The bot uses a session-based state machine to handle multi-step operations:
- Each user has a unique session
- Sessions track uploaded files, current step, and selected operation
- Sessions automatically expire after inactivity

## Error Handling

All operations include comprehensive error handling:
- File validation before processing
- Output verification before sending
- Automatic cleanup of temporary files
- User-friendly error messages

# EasyDocs
