import { getAuth,onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js'


const firebaseConfig = {
    
  };

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);