import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Tu configuración real de Firebase (Vite la leerá perfectamente)
const firebaseConfig = {
  apiKey: "AIzaSyAs7...", // Aquí se mantendrán tus credenciales reales actuales de tu archivo original
  authDomain: "asistencia-academia.firebaseapp.com",
  projectId: "asistencia-academia",
  storageBucket: "asistencia-academia.appspot.com",
  messagingSenderId: "3672...",
  appId: "1:3672..."
};

// Inicializar Firebase de forma estándar y compatible
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Objeto global storage para que App.jsx guarde y cargue los datos sin tocar nada
window.storage = {
  async get(key) {
    try {
      const docRef = doc(db, "asistencia", key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { value: docSnap.data().value };
      }
      return null;
    } catch (error) {
      console.error("Error al recuperar datos de Firebase:", error);
      return null;
    }
  },
  async set(key, value) {
    try {
      const docRef = doc(db, "asistencia", key);
      await setDoc(docRef, { value: value }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error al guardar datos en Firebase:", error);
      return false;
    }
  }
};
