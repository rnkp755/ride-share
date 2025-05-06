import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import admin from "firebase-admin";

/**
 * Initialize Firebase Admin SDK
 * This checks if Firebase is already initialized to prevent duplicate initialization
 */
const initializeFirebaseAdmin = () => {
	if (getApps().length === 0) {
		return initializeApp({
			credential: admin.credential.cert({
				projectId: process.env.FIREBASE_PROJECT_ID,
				clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
				privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,
				privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
					/\\n/g,
					"\n"
				),
				authProviderX509CertUrl:
					process.env.FIREBASE_AUTH_PROVIDER_x509_CERT_URL,
				clientX509CertUrl: process.env.FIREBASE_CLIENT_x509_CERT_URL,
			}),
			databaseURL: process.env.FIREBASE_DATABASE_URL,
		});
	}
	return getApp();
};

/**
 * Get Firebase Messaging instance
 * @returns {admin.messaging.Messaging} Firebase Messaging instance
 */
const getFirebaseMessaging = () => {
	initializeFirebaseAdmin();
	return getMessaging();
};

export { initializeFirebaseAdmin, getFirebaseMessaging };
