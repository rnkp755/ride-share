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
				type: "service_account",
				project_id: process.env.FIREBASE_PROJECT_ID,
				private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
				private_key: process.env.FIREBASE_PRIVATE_KEY.replace(
					/\\n/g,
					"\n"
				),
				client_email: process.env.FIREBASE_CLIENT_EMAIL,
				client_id: process.env.FIREBASE_CLIENT_ID,
				auth_uri: process.env.FIREBASE_AUTH_URI,
				token_uri: process.env.FIREBASE_TOKEN_URI,
				auth_provider_x509_cert_url:
					process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
				client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
				universe_domain: "googleapis.com",
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
