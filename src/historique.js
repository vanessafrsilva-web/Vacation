import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Petit utilitaire partagé par tous les modules : enregistre une ligne dans
// l'historique du voyage. Volontairement simple (pas de diff détaillé,
// juste une phrase lisible) pour rester facile à appeler partout.
export async function enregistrerHistorique(voyageId, description, auteurNom) {
  if (!voyageId) return;
  try {
    await addDoc(collection(db, 'historique'), {
      voyageId,
      description,
      auteurNom: auteurNom || 'Quelqu\'un',
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn("Impossible d'enregistrer dans l'historique.", error);
  }
}
