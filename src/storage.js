import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// ==========================================
// ⚠️ RELLENA AQUÍ CON TUS CLAVES REALES DE FIREBASE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyAs7...", // <-- Pon aquí tu apiKey real de Firebase
  authDomain: "asistencia-academia-l2ct.firebaseapp.com",
  projectId: "asistencia-academia-l2ct",
  storageBucket: "asistencia-academia-l2ct.appspot.com",
  messagingSenderId: "3672...", // <-- Pon tu número real
  appId: "1:3672..." // <-- Pon tu appId real
};

// Inicializar Firebase de forma segura
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Objeto global de almacenamiento conectado a la colección "asistencia"
window.storage = {
  async get(key) {
    try {
      const docRef = doc(db, "asistencia", key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().value;
      }
      return null;
    } catch (error) {
      console.error("Error crítico al LEER de Firebase:", error);
      return null;
    }
  },

  async set(key, value) {
    try {
      const docRef = doc(db, "asistencia", key);
      await setDoc(docRef, { value: value }, { merge: true });
      console.log(`💾 Guardado con éxito en Firebase: ${key}`);
      return true;
    } catch (error) {
      console.error("Error crítico al GUARDAR en Firebase:", error);
      return false;
    }
  }
};
