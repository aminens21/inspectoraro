import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCnRd3LBWcSzSDAi6N07lS-S5skJGmRKT4",
  authDomain: "taftichtaftich-eb38b.firebaseapp.com",
  databaseURL: "https://taftichtaftich-eb38b-default-rtdb.firebaseio.com",
  projectId: "taftichtaftich-eb38b",
  storageBucket: "taftichtaftich-eb38b.firebasestorage.app",
  messagingSenderId: "863612256733",
  appId: "1:863612256733:web:471a3b4db5ab510a2c7634"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
