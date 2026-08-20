const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let appInstance = null;

/**
 * Initializes the Firebase Admin SDK.
 * Reads credentials from:
 * 1. FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_JSON (direct JSON string)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH (.env specified file path)
 * 3. Default relative paths: ./config/firebase-service-account.json or ./firebase-service-account.json
 */
const initializeFirebase = () => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    return appInstance;
  }

  try {
    let serviceAccount = null;

    // Option 1: Direct JSON string in environment variable (useful for cloud/CI/CD)
    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (jsonEnv) {
      try {
        serviceAccount = typeof jsonEnv === 'string' ? JSON.parse(jsonEnv) : jsonEnv;
      } catch (parseErr) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', parseErr.message);
      }
    }

    // Option 2: File path provided via environment variable or default fallback paths
    if (!serviceAccount) {
      const potentialPaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        path.join(__dirname, 'firebase-service-account.json'),
        path.join(__dirname, '../firebase-service-account.json'),
        path.join(process.cwd(), 'firebase-service-account.json'),
        path.join(process.cwd(), 'config', 'firebase-service-account.json')
      ].filter(Boolean);

      for (const filePath of potentialPaths) {
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
        if (fs.existsSync(resolvedPath)) {
          const rawData = fs.readFileSync(resolvedPath, 'utf8');
          serviceAccount = JSON.parse(rawData);
          console.log(`🔑 Firebase Service Account loaded from: ${resolvedPath}`);
          break;
        }
      }
    }

    if (serviceAccount) {
      appInstance = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log(`✅ Firebase Admin SDK initialized successfully (Project: ${serviceAccount.project_id || 'DEFAULT'})`);
      return appInstance;
    } else {
      console.warn('⚠️  Firebase Admin SDK not initialized: Service account key not found.');
      console.warn('💡  Set FIREBASE_SERVICE_ACCOUNT_PATH in .env or place firebase-service-account.json in ./config/');
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  }

  return appInstance;
};

/**
 * Returns the Firebase Messaging instance if initialized.
 */
const getMessagingService = () => {
  const existingApps = getApps();
  if (existingApps.length === 0) {
    initializeFirebase();
  }

  const apps = getApps();
  if (apps.length === 0) {
    throw new Error('Firebase Admin SDK is not initialized. Please verify your service account key credentials.');
  }

  return getMessaging(apps[0]);
};

module.exports = {
  initializeFirebase,
  getMessaging: getMessagingService,
  isFirebaseInitialized: () => getApps().length > 0
};
