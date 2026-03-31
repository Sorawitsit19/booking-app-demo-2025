const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
    // กำหนดพาธสำหรับเซฟรูป
    const imagePath = path.join(__dirname, '..', 'images');
    if (!fs.existsSync(imagePath)) {
        fs.mkdirSync(imagePath, { recursive: true });
    }

    const browser = await puppeteer.launch({ 
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: 'new', 
        defaultViewport: { width: 1200, height: 1000 } 
    });
    const page = await browser.newPage();

    console.log('Navigating to http://localhost:3001/api-docs');
    await page.goto('http://localhost:3001/api-docs', { waitUntil: 'networkidle0' });
    await delay(1000);

    // 1. แคปเจอ LoginResponse Schema (เพื่อดูแบบฝึกหัด 1.1)
    await page.evaluate(() => {
        window.scrollBy(0, document.body.scrollHeight);
    });
    await delay(1000);
    // เปิด Schema Section
    const schemasBtn = await page.$('section.models h4');
    if (schemasBtn) {
        // อาจจะต้องคลิกให้เปิด/ปิด
        await delay(500);
        // เลื่อนหาแถว LoginResponse
        await page.screenshot({ path: path.join(imagePath, 'swagger-schema-loginresponse.png'), fullPage: true });
    }

    // เลื่อนกลับไปข้างบนสุด
    await page.evaluate(() => window.scrollTo(0, 0));

    // 2. ทดสอบ POST /api/login
    console.log('Testing POST /api/login');
    // ขยาย /api/login
    const loginOp = await page.$('#operations-Authentication-post_api_login');
    await loginOp.click();
    await delay(500);
    const tryBtnLogin = await loginOp.$('.try-out__btn');
    await tryBtnLogin.click();
    await delay(500);
    
    // ตั้งค่าบอดี้
    await page.evaluate(() => {
        const textArea = document.querySelector('#operations-Authentication-post_api_login textarea');
        if (textArea) {
           textArea.value = JSON.stringify({username: "admin", password: "admin123"}, null, 2);
           const event = new Event('input', { bubbles: true });
           textArea.dispatchEvent(event);
        }
    });

    const executeBtnLogin = await loginOp.$('.execute');
    await executeBtnLogin.click();
    await delay(1500);

    // เลื่อนบรรทัดให้เห็น response
    await page.evaluate((el) => {
        if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, executeBtnLogin);
    await delay(500);
    
    await page.screenshot({ path: path.join(imagePath, 'swagger-login.png') });

    // อ่าน token เพื่อเอาไป Authorize
    const responseBody = await page.evaluate(() => {
        const bodyBlock = document.querySelector('#operations-Authentication-post_api_login .highlight-code pre');
        return bodyBlock ? bodyBlock.innerText : '';
    });
    let token = '';
    try {
        const json = JSON.parse(responseBody);
        token = json.token;
    } catch(e) {}
    console.log('Got token:', token ? `${token.substring(0,15)}...` : 'NONE');

    // 3. ปิด Login tab เพื่อความเรียบร้อย
    await page.evaluate(() => {
       const btn = document.querySelector('#operations-Authentication-post_api_login .opblock-summary');
       if(btn) btn.click();
    });

    if (token) {
        // 4. ตั้งค่า Authorization
        console.log('Setting Authorization');
        const authBtn = await page.$('.btn.authorize');
        if (authBtn) {
            await authBtn.click();
            await delay(500);
            
            // ใส่ Token
            await page.evaluate((t) => {
                const input = document.querySelector('section.auth-container input[type="text"]');
                if (input) {
                   input.value = t;
                   input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, token);
            await delay(500);

            // กดปุ่ม Authorize
            const submitBtn = await page.$('.auth-btn-wrapper .authorize');
            if (submitBtn) await submitBtn.click();
            await delay(500);

            // กด Close
            const closeBtn = await page.$('.auth-btn-wrapper .btn-done');
            if (closeBtn) await closeBtn.click();
            await delay(500);
        }
    }

    // 5. ทดสอบ GET /api/bookings
    console.log('Testing GET /api/bookings');
    const getBookingsOp = await page.$('#operations-Bookings-get_api_bookings');
    if (getBookingsOp) {
        await getBookingsOp.click();
        await delay(500);
        const tryBtnBk = await getBookingsOp.$('.try-out__btn');
        if (tryBtnBk) await tryBtnBk.click();
        await delay(500);

        const executeBtnBk = await getBookingsOp.$('.execute');
        if (executeBtnBk) {
            await executeBtnBk.click();
            await delay(1000);
            
            await page.evaluate((el) => {
                if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, executeBtnBk);
            await delay(500);

            await page.screenshot({ path: path.join(imagePath, 'swagger-get-bookings.png') });
        }
        await page.evaluate(() => {
           const btn = document.querySelector('#operations-Bookings-get_api_bookings .opblock-summary');
           if(btn) btn.click();
        });
    }

    // 6. ทดสอบ GET /api/health
    console.log('Testing GET /api/health');
    const getHealthOp = await page.$('#operations-System-get_api_health');
    if (getHealthOp) {
        await getHealthOp.click();
        await delay(500);
        const tryBtnHe = await getHealthOp.$('.try-out__btn');
        if (tryBtnHe) await tryBtnHe.click();
        await delay(500);

        const executeBtnHe = await getHealthOp.$('.execute');
        if (executeBtnHe) {
            await executeBtnHe.click();
            await delay(1000);
            
            await page.evaluate((el) => {
                if(el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, executeBtnHe);
            await delay(500);

            await page.screenshot({ path: path.join(imagePath, 'swagger-health.png') });
        }
        await page.evaluate(() => {
           const btn = document.querySelector('#operations-System-get_api_health .opblock-summary');
           if(btn) btn.click();
        });
    }

    // 7. ทดสอบสร้าง API ใหม่อื่นๆ (ถ้ามี และพร้อมให้แคป)
    const newEndpoints = ['#operations-Bookings-post_api_checkin', '#operations-Bookings-post_api_checkout', '#operations-Bookings-post_api_confirmcheckout'];
    for (const ep of newEndpoints) {
        let op = await page.$(ep);
        if (op) {
            await op.click();
            await delay(500);
            const tryBtn = await op.$('.try-out__btn');
            if (tryBtn) await tryBtn.click();
            
            // Just inject dummy 1 for required ID
            await page.evaluate((selector) => {
                const textArea = document.querySelector(`${selector} textarea`);
                if (textArea) {
                    let d = { bookingId: 1, checkInId: 1, checkOutId: 1 };
                    let val = {};
                    if(selector.includes('checkin')) val = {bookingId:1};
                    if(selector.includes('checkout')) val = {checkInId:1};
                    if(selector.includes('confirm')) val = {checkOutId:1};

                    textArea.value = JSON.stringify(val, null, 2);
                    textArea.dispatchEvent(new Event('input', {bubbles: true}));
                }
            }, ep);
            await delay(500);

            const execBtn = await op.$('.execute');
            if(execBtn) {
               await execBtn.click();
               await delay(1000);
               await page.evaluate((el) => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, execBtn);
               await delay(500);
               await page.screenshot({ path: path.join(imagePath, `${ep.replace('#operations-Bookings-post_api_', '')}-swagger.png`) });
            }
        }
    }


    await browser.close();
    console.log('Puppeteer finished capturing screenshots.');
})();
