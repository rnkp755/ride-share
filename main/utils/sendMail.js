import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendMail = async (email, subject, text) => {
    try {
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject,
            text,
        });
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

const sendOTPMail = async (email, otp) => {
    const subject = "Your OTP Code";
    const text = `Your Verification OTP is ${otp}. It will expire in 5 minutes.`;
    await sendMail(email, subject, text);
};

export { sendOTPMail };
