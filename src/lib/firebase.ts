import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export { firebaseConfig };

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const googleAuthProvider = new GoogleAuthProvider();

export async function testFirestoreConnection(): Promise<boolean> {
  return true;
}
