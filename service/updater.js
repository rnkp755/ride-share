const { chromium } = require("playwright");
const { MongoClient } = require("mongodb");
const nodemailer = require("nodemailer");
require("dotenv").config();

(async () => {
  console.log(`🚀 Starting token fetch...`);

  let browser;

  try {
    // Launch browser with session.json
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: "session.json",
    });
    const page = await context.newPage();

    let accessTokenFound = false;

    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB);
    const collection = db.collection(process.env.MONGODB_COLLECTION);

    // Listen for responses
    page.on("response", async (response) => {
      const url = response.url();

      if (
        url.includes("service.svc") &&
        url.includes("action=GetAccessTokenforResource") &&
        !accessTokenFound
      ) {
        console.log(`🔍 Found target request: ${url}`);

        try {
          const json = await response.json();
          const accessToken = json.AccessToken;

          if (accessToken) {
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
            accessTokenFound = true;

            console.log(`✅ All done, closing browser...`);
            await browser.close();
            process.exit(0);
          } else {
            throw new Error("AccessToken not found in JSON");
          }
        } catch (err) {
          console.error("❗ Error parsing response JSON:", err);
          await notifyByEmail(
            `Error parsing AccessToken: ${err.message}`
          );
          await browser.close();
          process.exit(1);
        }
      }
    });

    console.log("🔄 Navigating to Outlook...");
    await page.goto("https://outlook.office.com/mail/", {
      waitUntil: "load",
      timeout: 60000,
    });

    console.log("🔄 Reloading page to trigger requests...");
    await page.reload({ waitUntil: "load" });

    // Wait some time for responses to come (but only if nothing triggered)
    await page.waitForTimeout(10000);

    if (!accessTokenFound) {
      throw new Error(
        "No AccessToken found. Session might have expired."
      );
    }
  } catch (error) {
    console.error("❗ Critical error occurred:", error.message);
    await notifyByEmail(`Updater failed: ${error.message}`);
    if (browser) await browser.close();
    process.exit(1);
  }
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
