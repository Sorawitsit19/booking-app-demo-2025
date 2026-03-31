const { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

(async () => {
    // 1. รันสร้างไฟล์ newman
    console.log('Running node create-newman-files.js...');
    execSync('node create-newman-files.js', { stdio: 'inherit' });

    // 2. รัน newman อัตโนมัติ (สมมติว่าเซิร์ฟเวอร์รันอยู่แล้ว)
    console.log('Running Newman tests...');
    try {
        const out = execSync('npx newman run newman/hotel-booking-collection.json -e newman/hotel-booking-env.json -r cli,htmlextra --reporter-htmlextra-export ./reports/api-test-report.html --reporter-htmlextra-title "Hotel Booking API Test Report"');
        console.log(out.toString());
        fs.writeFileSync('../newman_output.txt', out.toString());
    } catch(e) {
        console.error('Newman error, maybe some tests failed.');
        if(e.stdout) {
           console.log(e.stdout.toString());
           fs.writeFileSync('../newman_output.txt', e.stdout.toString());
        }
    }

    // 3. เริ่ม Puppeteer เพื่อแคปรายงาน
    const browser = await puppeteer.launch({ 
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new', 
        defaultViewport: { width: 1200, height: 1000 } 
    });
    const page = await browser.newPage();
    
    // แปลง path ให้เป็นรูปแบบ file://
    const reportPath = path.resolve('./reports/api-test-report.html');
    const imagePathDir = path.resolve('../images');

    const reportImgArg = process.argv[2] || 'newman-report.png';
    const termImgArg = process.argv[3] || 'newman-terminal.png';

    // ถ่ายรูป Newman Report ครั้งแรก
    await page.goto(`file://${reportPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(imagePathDir, reportImgArg) });
    
    const cliOutput = fs.readFileSync('../newman_output.txt', 'utf8');
    const htmlContent = `<html><body style="background:#000;color:#0f0;font-family:monospace;white-space:pre-wrap;padding:20px;">${cliOutput.replace(/</g, '<').replace(/>/g, '>')}</body></html>`;
    fs.writeFileSync('../newman_cli.html', htmlContent);
    await page.goto(`file://${path.resolve('../newman_cli.html').replace(/\\/g, '/')}`, { waitUntil: 'networkidle0' });
    if(termImgArg !== 'none') {
        await page.screenshot({ path: path.join(imagePathDir, termImgArg), fullPage: true });
    }

    await browser.close();
    console.log('Finished capturing newman report and terminal.');
})();
