import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcodeTerminal from 'qrcode-terminal';
import { handleMessage } from './handlers/messageHandler.js';

/**
 * WhatsApp File Converter Bot
 * Main entry point
 */

console.log('🚀 Starting WhatsApp File Converter Bot...\n');

console.log('🚀 Starting WhatsApp File Converter Bot...\n');


// Initialize WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: '.wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

// QR Code generation
client.on('qr', (qr) => {
  console.log('\n📱 Scan this QR code with WhatsApp:\n');
  qrcodeTerminal.generate(qr, { small: true });
  console.log('\n');
});

// Client ready
client.on('ready', () => {
  console.log('✅ WhatsApp client is ready!');
  console.log('📱 Bot is now listening for messages...\n');
});

// Authentication
client.on('authenticated', () => {
  console.log('✅ Authenticated successfully');
});

client.on('auth_failure', (msg) => {
  console.error('❌ Authentication failed:', msg);
});

// Disconnected
client.on('disconnected', (reason) => {
  console.log('⚠️ Client was disconnected:', reason);
});

// Message handler
client.on('message', async (message) => {
  // Ignore messages from groups and status
  if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
    return;
  }
  
  // Handle message
  await handleMessage(message, client);
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Client error:', error);
});

// Initialize client
client.initialize().catch((error) => {
  console.error('❌ Failed to initialize client:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  try {
    await client.destroy();
    console.log('✅ Client destroyed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  try {
    await client.destroy();
    console.log('✅ Client destroyed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

