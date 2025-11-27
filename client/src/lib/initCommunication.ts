import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Initialize communication collections with sample data
export const initializeCommunication = async () => {
  try {
    console.log('Initializing communication collections...');

    // Create sample users if needed
    const usersRef = collection(db, 'users');
    await addDoc(usersRef, {
      name: 'Administrateur',
      email: 'admin@fruitsforyou.com',
      role: 'admin',
      createdAt: serverTimestamp()
    });

    await addDoc(usersRef, {
      name: 'Responsable Qualité',
      email: 'qualite@fruitsforyou.com',
      role: 'quality_manager',
      createdAt: serverTimestamp()
    });

    await addDoc(usersRef, {
      name: 'Responsable Production',
      email: 'production@fruitsforyou.com',
      role: 'production_manager',
      createdAt: serverTimestamp()
    });

    // Create sample messages
    const messagesRef = collection(db, 'messages');
    await addDoc(messagesRef, {
      senderName: 'System',
      senderEmail: 'system@fruitsforyou.com',
      content: 'Bienvenue dans le système de communication FruitsForYou!',
      priority: 'medium',
      read: false,
      recipientEmail: null, // Broadcast message
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp()
    });

    await addDoc(messagesRef, {
      senderName: 'Administrateur',
      senderEmail: 'admin@fruitsforyou.com',
      content: 'Nouveau lot d\'avocats reçu et prêt pour contrôle qualité.',
      priority: 'high',
      read: false,
      recipientEmail: 'qualite@fruitsforyou.com',
      recipientName: 'Responsable Qualité',
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp()
    });

    // Create sample notifications
    const notificationsRef = collection(db, 'communication-notifications');
    await addDoc(notificationsRef, {
      content: 'Système de communication initialisé avec succès',
      read: false,
      createdAt: serverTimestamp(),
      timestamp: serverTimestamp()
    });

    console.log('Communication collections initialized successfully!');
  } catch (error) {
    console.error('Error initializing communication:', error);
  }
};
