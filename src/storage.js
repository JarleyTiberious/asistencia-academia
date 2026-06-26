import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

// Tu configuración de Firebase (asegúrate de que mantienes tus claves reales si son distintas)
const firebaseConfig = {
  apiKey: "AIzaSyAs7...", 
  authDomain: "asistencia-academia.firebaseapp.com",
  projectId: "asistencia-academia",
  storageBucket: "asistencia-academia.appspot.com",
  messagingSenderId: "3672...",
  appId: "1:3672..."
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Objeto global de almacenamiento que usa tu App.jsx
window.storage = {
  async get(key) {
    try {
      const docRef = doc(db, "asistencia", key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data()) {
        // Devolvemos el valor o el objeto parseado según cómo lo pida la app
        return docSnap.data().value || docSnap.data();
      }
      return null;
    } catch (error) {
      console.error("Error al recuperar de Firebase:", error);
      return null;
    }
  },

  async set(key, value) {
    try {
      const docRef = doc(db, "asistencia", key);
      // Guardamos asegurando que la estructura sea limpia y directamente almacenable
      await setDoc(docRef, { value: value }, { merge: true });
      console.log(`Datos guardados con éxito para la clave: ${key}`);
      return true;
    } catch (error) {
      console.error("Error crítico al guardar en Firebase:", error);
      return false;
    }
  }
};
