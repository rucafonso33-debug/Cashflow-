import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot,
  query,
  where,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AppSettings, Income, FixedExpense, FutureEvent, FinancialGoal } from '../types';

export const saveUserData = async (userId: string, data: any) => {
  try {
    await setDoc(doc(db, 'users', userId), data);
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserData = async (userId: string) => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const subscribeToUserData = (userId: string, callback: (data: any) => void) => {
  return onSnapshot(doc(db, 'users', userId), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
};
