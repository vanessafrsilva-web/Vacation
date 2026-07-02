import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { IconTrash, IconCircleCheckFilled, IconCircle } from '@tabler/icons-react';

export function Checklist({ voyageId }) {
  const [taches, setTaches] = useState([]);
  const [nouvelleTache, setNouvelleTache] = useState('');

  // LECTURE EN TEMPS RÉEL (Filtrée par voyage)
  useEffect(() => {
    if (!voyageId) return;

    const q = query(collection(db, 'checklist'), where('voyageId', '==', voyageId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      
      // On trie pour mettre les tâches non faites en haut, et les faites en bas
      data.sort((a, b) => (a.fait === b.fait) ? 0 : a.fait ? 1 : -1);
      setTaches(data);
    });
    return () => unsubscribe();
  }, [voyageId]);

  // AJOUTER UNE TÂCHE
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nouvelleTache) return;

    try {
      await addDoc(collection(db, 'checklist'), {
        nom: nouvelleTache,
        fait: false, // Par défaut, la tâche n'est pas faite
        voyageId: voyageId
      });
      setNouvelleTache('');
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  // COCHER / DÉCOCHER
  const toggleFait = async (tache) => {
    try {
      await updateDoc(doc(db, 'checklist', tache.id), {
        fait: !tache.fait
      });
    } catch (error) {
      console.error("Erreur de mise à jour :", error);
    }
  };

  // SUPPRIMER
  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'checklist', id));
  };

  // CALCUL DE LA PROGRESSION
  const total = taches.length;
  const faites = taches.filter(t => t.fait).length;
  const progression = total === 0 ? 0 : Math.round((faites / total) * 100);

  // STYLES
  const inputStyle = { flex: 1, padding: '12px', borderRadius: '8px', border: 'none', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '16px' };

  return (
    <div style={{ padding: '5px', textAlign: 'left' }}>
      
      {/* 1. BARRE DE PROGRESSION */}
      <div style={{ backgroundColor: '#2C2C2E', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#FFF', fontWeight: 'bold' }}>
          <span>Préparation</span>
          <span style={{ color: progression === 100 ? '#30D158' : '#0A84FF' }}>{progression}%</span>
        </div>
        <div style={{ width: '100%', height: '8px', backgroundColor: '#1C1C1E', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${progression}%`, 
            height: '100%', 
            backgroundColor: progression === 100 ? '#30D158' : '#0A84FF',
            transition: 'width 0.4s ease-in-out' // Animation fluide
          }}></div>
        </div>
        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#AEAEB2' }}>
          {faites} sur {total} éléments complétés
        </p>
      </div>

      {/* 2. FORMULAIRE D'AJOUT RAPIDE */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Ajouter (ex: Passeport, Crème solaire...)" 
          value={nouvelleTache} 
          onChange={e => setNouvelleTache(e.target.value)} 
          style={inputStyle} 
        />
        <button type="submit" style={{ padding: '0 20px', borderRadius: '8px', border: 'none', backgroundColor: '#0A84FF', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' }}>
          +
        </button>
      </form>

      {/* 3. LISTE DES TÂCHES */}
      <div style={{ backgroundColor: '#2C2C2E', borderRadius: '10px', overflow: 'hidden' }}>
        {taches.length === 0 && (
          <p style={{ color: '#AEAEB2', fontStyle: 'italic', padding: '20px', textAlign: 'center', margin: 0 }}>
            Votre checklist est vide.
          </p>
        )}

        {taches.map((tache, index) => (
          <div key={tache.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '15px',
            borderBottom: index === taches.length - 1 ? 'none' : '1px solid #3A3A3C' // Ligne de séparation sauf pour le dernier
          }}>
            
            <div 
              onClick={() => toggleFait(tache)} 
              style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flex: 1 }}
            >
              {/* Icône cochée ou vide */}
              {tache.fait ? (
                <IconCircleCheckFilled size={24} color="#0A84FF" />
              ) : (
                <IconCircle size={24} color="#636366" />
              )}
              
              {/* Nom de la tâche (barré si fait) */}
              <span style={{ 
                marginLeft: '15px', 
                fontSize: '16px',
                color: tache.fait ? '#636366' : '#FFF',
                textDecoration: tache.fait ? 'line-through' : 'none',
                transition: 'all 0.2s'
              }}>
                {tache.nom}
              </span>
            </div>

            <IconTrash 
              size={20} 
              color="#FF453A" 
              style={{ cursor: 'pointer', opacity: 0.8, marginLeft: '10px' }} 
              onClick={() => handleDelete(tache.id)} 
            />
          </div>
        ))}
      </div>

    </div>
  );
}