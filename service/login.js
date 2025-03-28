import { chromium } from "playwright";
import { MongoClient } from "mongodb";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

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

    console.log("🔄 Reloading page to trigger request...");
    await page.reload({ waitUntil: "load" });

    // Click on New Mail button to trigger requests
    await page.click('button[aria-label="New mail"]', { timeout: 60000 });

    // Preparing MongoDB
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(process.env.MONGODB_COLLECTION);

    // Listen for responses
    page.on("request", async (request) => {
        const url = request.url();

        if (url.includes("recommendations")) {
            console.log(`🔍 Found target request: ${url}`);

            try {
                const headers = request.headers();
                const authHeader =
                    headers["authorization"] || headers["Authorization"];

                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const accessToken = authHeader.split(" ")[1];

                    console.log(
                        "✅ AccessToken extracted:",
                        accessToken.slice(0, 20),
                        "..."
                    );

                    // ======= MongoDB Update =======
                    const result = await collection.updateOne(
                        { _id: process.env.MONGODB_DOC_ID },
                        { $set: { accessToken, updatedAt: new Date() } },
                        { upsert: true }
                    );

                    console.log(
                        "📝 MongoDB update result:",
                        result.modifiedCount || result.upsertedCount
                    );

                    // Clean up
                    await client.close();
                    await page.click('button[aria-label="Discard"]', {
                        timeout: 60000,
                    });
                    console.log(`✅ All done, closing browser...`);
                } else {
                    throw new Error("AccessToken not found in JSON");
                }
            } catch (error) {
                console.error("❗ Error parsing response JSON:", error);
                await notifyByEmail(
                    `Error parsing AccessToken: ${error.message}`
                );
            } finally {
                await browser
                    .close()
                    .catch(() => console.log("Browser already closed."));
                process.exit(0);
            }
        }
    });
})();

async function notifyByEmail(message) {
    try {
        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        let info = await transporter.sendMail({
            from: `"Outlook Token Bot" <${process.env.EMAIL_USER}>`,
            to: process.env.EMAIL_TO,
            subject: "❗ Outlook Token Updater Failed",
            text: `${message}\n\nPlease run login.js to refresh the session.`,
        });

        console.log(`📧 Failure notification sent: ${info.messageId}`);
    } catch (err) {
        console.error("❗ Failed to send email:", err.message);
    }
}
