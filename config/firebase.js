const { initializeApp, cert, getApps, getApp } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');

let appInstance = null;


const initializeFirebase = () => {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    return appInstance;
  }

  try {
    let serviceAccount = null;

    const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (jsonEnv) {
      try {
        let parsed = jsonEnv;
        if (typeof parsed === 'string') {
          const trimmed = parsed.trim();
          if (trimmed.startsWith('{')) {
            parsed = JSON.parse(trimmed);
          } else {
            const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
            parsed = JSON.parse(decoded);
          }
        }
        serviceAccount = parsed;
      } catch (parseErr) {
        console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string:', parseErr.message);
      }
    }


    if (!serviceAccount) {
      const potentialPaths = [
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
        '/etc/secrets/firebase-service-account.json',
        '/etc/secrets/firebase.json',
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
      if (serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      appInstance = initializeApp({
        credential: cert(serviceAccount)
      });
      console.log(`✅ Firebase Admin SDK initialized successfully (Project: ${serviceAccount.project_id || 'DEFAULT'})`);
      return appInstance;
    } else {
      console.warn('⚠️  Firebase Admin SDK not initialized: Service account key not found.');
      console.warn('💡  Set FIREBASE_SERVICE_ACCOUNT_KEY / FIREBASE_SERVICE_ACCOUNT_BASE64 in Render Environment variables, or add a Secret File at /etc/secrets/firebase-service-account.json');
    }
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin SDK:', error.message);
  }

  return appInstance;
};

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
