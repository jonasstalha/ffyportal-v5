// Quick Firebase data check
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  // You need to add your config here
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkData() {
  try {
    const querySnapshot = await getDocs(collection(db, 'consumption_reports'));
    console.log(`Found ${querySnapshot.size} documents in consumption_reports collection`);
    
    querySnapshot.forEach((doc) => {
      console.log('Document ID:', doc.id);
      console.log('Data:', doc.data());
      console.log('---');
    });
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

checkData();