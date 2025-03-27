const { chromium } = require("playwright");
const fs = require("fs");
require("dotenv").config();

(async () => {
    console.log("🔑 Logging into Outlook...");

    const browser = await chromium.launch({ headless: false }); // Open visible browser
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("https://outlook.office.com/mail/", { waitUntil: "load" });

    // Wait for login fields and fill them
    await page.fill('input[type="email"]', process.env.OUTLOOK_MAIL);
    await page.click('input[type="submit"]');

    await page.waitForSelector('input[type="password"]', { timeout: 60000 });
    await page.fill('input[type="password"]', process.env.OUTLOOK_PASSWORD);
    await page.click('input[type="submit"]');

    await page.waitForSelector('input[type="submit"]', { timeout: 60000 });
    await page.click('input[type="submit"]');

    console.log("✅ Login completed, saving session...");

    // Wait until Outlook inbox fully loads
    await page.waitForSelector('[aria-label="Mail"]', { timeout: 60000 });
    console.log("✅ Outlook loaded successfully!");

    // Save session state automatically
    await context.storageState({ path: "session.json" });
    console.log("✅ Session saved to session.json");

    await browser.close();
})();
