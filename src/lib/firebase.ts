import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

export interface FirebaseAppConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export const firebaseConfig: FirebaseAppConfig = {
  projectId: "pra-onde-eu-vou",
  appId: "1:195963951609:web:e2ffed38e48574d4550528",
  apiKey: "AIzaSyBSTUNBvgtiSdwWXt61HKM_Q1oDYrnplT4",
  authDomain: "pra-onde-eu-vou.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-praondeeuvou-2ff69082-c0b9-415e-8507-2379a77537cb",
  storageBucket: "pra-onde-eu-vou.firebasestorage.app",
  messagingSenderId: "195963951609",
  measurementId: "",
  oAuthClientId: "195963951609-6ead0duq81cv2ouiq4kurpa02eq1j2ml.apps.googleusercontent.com",
  recaptchaSiteKey: ""
};

// Inicializa o Firebase Client
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Inicializa o Firestore com o Database ID configurado
export const db = getFirestore(
  firebaseApp,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

// Validação de conectividade
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'ping'));
    return true;
  } catch (err: any) {
    if (err instanceof Error && err.message.includes('the client is offline')) {
      console.warn('[Firebase] Verifique a conexão com o Firestore.');
    }
    return false;
  }
}
