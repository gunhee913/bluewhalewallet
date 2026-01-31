import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export const maxDuration = 60;

export async function GET() {
  const token = process.env.BROWSERLESS_TOKEN;
  
  if (!token) {
    return NextResponse.json({ error: 'No token' });
  }
  
  try {
    console.log('1. Token exists:', token.slice(0, 10) + '...');
    
    const wsUrl = `wss://chrome.browserless.io?token=${token}`;
    console.log('2. Connecting to:', wsUrl.replace(token, '***'));
    
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
    });
    console.log('3. Connected!');
    
    const page = await browser.newPage();
    console.log('4. Page created');
    
    await page.goto('https://example.com');
    console.log('5. Page loaded');
    
    const title = await page.title();
    console.log('6. Title:', title);
    
    await browser.close();
    console.log('7. Browser closed');
    
    return NextResponse.json({ 
      success: true, 
      title,
      message: 'Browserless works!' 
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    
    let msg = 'Unknown';
    if (error instanceof Error) {
      msg = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      msg = String((error as {message: unknown}).message);
    }
    
    return NextResponse.json({ 
      success: false, 
      error: msg 
    });
  }
}
