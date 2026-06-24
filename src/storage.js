import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs, initializeLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlOPjQ8NvGtoKf9YTRPlxMWDZxOvV2NEE",
  authDomain: "academia-pirineos-c62f7.firebaseapp.com",
  projectId: "academia-pirineos-c62f7",
  storageBucket: "academia-pirineos-c62f7.firebasestorage.app",
  messagingSenderId: "836599476727",
  appId: "1:836599476727:web:a910b33c1a8a47100afef2",
  measurementId: "G-2TP5S9SRFT"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: initializeLocalCache(),
  experimentalForceLongPolling: true 
});

const COLLECTION = 'asistencia_kv';

window.storage = {
  async get(key) {
    const ref = doc(db, COLLECTION, key);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { key, value: "[]", shared: false };
    return { key, value: snap.data().value, shared: false };
  },
  async set(key, value) {
    const ref = doc(db, COLLECTION, key);
    await setDoc(ref, { value, updatedAt: Date.now() });
    return { key, value, shared: false };
  },
  async delete(key) {
    const ref = doc(db, COLLECTION, key);
    await deleteDoc(ref);
    return { key, deleted: true, shared: false };
  },
  async list(prefix = '') {
    const snap = await getDocs(collection(db, COLLECTION));
    const keys = snap.docs.map(d => d.id).filter(k => k.startsWith(prefix));
    return { keys, prefix, shared: false };
  },
};
