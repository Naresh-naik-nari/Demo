#!/usr/bin/env node

/**
 * Utility script to list available serial ports
 * Run with: node list-ports.js
 */

import { SerialPort } from 'serialport';

console.log('\n🔍 Scanning for available serial ports...\n');

SerialPort.list()
  .then(ports => {
    if (ports.length === 0) {
      console.log('❌ No serial ports found');
      console.log('   Make sure your device is connected via USB\n');
      return;
    }

    console.log(`✅ Found ${ports.length} serial port(s):\n`);
    
    ports.forEach((port, index) => {
      console.log(`${index + 1}. ${port.path}`);
      if (port.manufacturer) console.log(`   Manufacturer: ${port.manufacturer}`);
      if (port.serialNumber) console.log(`   Serial Number: ${port.serialNumber}`);
      if (port.vendorId) console.log(`   Vendor ID: ${port.vendorId}`);
      if (port.productId) console.log(`   Product ID: ${port.productId}`);
      
      // Highlight MAVLink-compatible devices
      const description = port.manufacturer?.toLowerCase() || '';
      if (description.includes('cube') || 
          description.includes('pixhawk') || 
          description.includes('ardupilot') ||
          description.includes('mavlink')) {
        console.log(`   ⭐ MAVLink-compatible device detected!`);
      }
      console.log('');
    });

    console.log('📝 To use a port, update your .env file:');
    console.log(`   USB_SERIAL_PORT=${ports[0].path}`);
    console.log('');
  })
  .catch(err => {
    console.error('❌ Error listing ports:', err.message);
    process.exit(1);
  });
