// Импорт SDK модулей напрямую из CDN
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Конфигурация Firebase. Замените на ваши данные из Firebase Console!
const firebaseConfig = {
  apiKey: "AIzaSyDFugIRxsKrrkaVYGk9jOFyLNKZ9Ov5i-4",
  authDomain: "pyshka-103be.firebaseapp.com",
  projectId: "pyshka-103be",
  storageBucket: "pyshka-103be.firebasestorage.app",
  messagingSenderId: "469132090560",
  appId: "1:469132090560:web:03f3e46ca15d39d1162125",
  measurementId: "G-WL48FH85LP"
};


// Инициализация сервисов
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
