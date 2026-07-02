import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { IconTrash, IconClock, IconCalendarEvent } from '@tabler/icons-react';

// Reçoit l'objet complet "voyage" depuis App.jsx
export function Planning({ voyage }) {
  const voyageId = voyage?.id;
  const [activites, setActivites] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [jourActif, setJourActif] = useState(1);

  const [nom, setNom] = useState('');
  const [heure, setHeure] = useState('');

  // --- LE MOTEUR DE CALCUL DES JOURS ---
  let listeJours = [1]; // Par défaut, 1 jour
  const getFormatDate = (jourNumero) => {
    if (!voyage?.dateDebut) return '';
    const date = new Date(voyage.dateDebut);
    date.setDate(date.getDate() + (jourNumero - 1));
    // Format Suisse court : JJ.MM
    return date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }); 
  };

  if (voyage?.dateDebut && voyage?.dateFin) {
    const debut = new Date(voyage.dateDebut);
    const fin = new Date(voyage.dateFin);
    // Calcul mathématique du nombre de jours (Différence en millisecondes convertie en jours)
    const totalJours = Math.max(1, Math.ceil((fin - debut) / (1000 * 60 * 60 * 24)) + 1);
    // Crée un tableau dynamique : [1, 2, 3...] jusqu'au total
    listeJours = Array.from({ length: totalJours }, (_, i) => i + 1);
  }

  useEffect(() => {
    if (!voyageId) return;
    const q = query(collection(db, 'activites'), where('voyageId', '==', voyageId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => a.heure.localeCompare(b.heure));
      setActivites(data);
    });
    return () => unsubscribe();
  }, [voyageId]);

  const activitesDuJour = activites.filter(act => act.jour === jourActif);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nom || !heure) return;
    try {
      await addDoc(collection(db, 'activites'), { nom, heure, jour: jourActif, voyageId });
      setNom(''); setHeure(''); setShowForm(false);
    } catch (error) {
      console.error("Erreur :", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Voulez-vous vraiment supprimer cette activité ?")) {
      await deleteDoc(doc(db, 'activites', id));
    }
  };

  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #3A3A3C', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '16px', outline: 'none' };

  return (
    <div style={{ padding: '5px', textAlign: 'left' }}>
      
      {/* SÉLECTEUR DYNAMIQUE AVEC VRAIES DATES */}
      <div style={{ display: 'flex', overflowX: 'auto', backgroundColor: '#2C2C2E', padding: '6px', borderRadius: '12px', marginBottom: '20px', gap: '6px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        {listeJours.map((j) => (
          <button 
            key={j} 
            onClick={() => setJourActif(j)} 
            style={{ flex: '0 0 auto', minWidth: '70px', padding: '8px', border: 'none', borderRadius: '8px', backgroundColor: jourActif === j ? '#0A84FF' : 'transparent', color: jourActif === j ? '#FFF' : '#AEAEB2', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.2s' }}
          >
            <span style={{ fontWeight: jourActif === j ? 'bold' : '600', fontSize: '14px' }}>Jour {j}</span>
            {/* Affichage de la date sous le numéro du jour */}
            {voyage?.dateDebut && (
              <span style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>{getFormatDate(j)}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#FFF' }}>
        <IconCalendarEvent size={20} color="#0A84FF" />
        <span style={{ fontSize: '16px', fontWeight: '600' }}>Programme du {getFormatDate(jourActif)}</span>
      </div>

      <div style={{ position: 'relative', paddingLeft: '24px', borderLeft: '2px solid #3A3A3C', marginLeft: '12px' }}>
        {activitesDuJour.length === 0 && <p style={{ color: '#AEAEB2', fontStyle: 'italic', margin: '20px 0', fontSize: '15px' }}>Aucune activité prévue ce jour.</p>}

        {activitesDuJour.map((act, index) => (
          <div key={act.id} style={{ position: 'relative', marginBottom: index === activitesDuJour.length - 1 ? '0' : '20px' }}>
            <div style={{ position: 'absolute', left: '-31px', top: '15px', width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#1C1C1E', border: '3px solid #0A84FF', boxShadow: '0 0 0 4px #1C1C1E' }}></div>
            <div style={{ backgroundColor: '#2C2C2E', padding: '16px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginLeft: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', color: '#0A84FF', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px' }}><IconClock size={16} style={{ marginRight: '6px' }} />{act.heure}</div>
                <div style={{ color: '#FFF', fontSize: '16px', fontWeight: '600', lineHeight: '1.3' }}>{act.nom}</div>
              </div>
              <IconTrash size={22} color="#FF453A" style={{ cursor: 'pointer', opacity: 0.8, padding: '5px' }} onClick={() => handleDelete(act.id)} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '30px', paddingBottom: '20px' }}>
        {showForm ? (
          <form onSubmit={handleAdd} style={{ backgroundColor: '#2C2C2E', padding: '15px', borderRadius: '15px', border: '1px solid #3A3A3C' }}>
             <input type="time" value={heure} onChange={e => setHeure(e.target.value)} style={inputStyle} required />
             <input type="text" placeholder="Activité (ex: Visite distillerie)" value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} required />
             <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#1C1C1E', color: '#AEAEB2', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#0A84FF', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '16px', backgroundColor: 'rgba(10, 132, 255, 0.1)', color: '#0A84FF', border: '1px dashed rgba(10, 132, 255, 0.3)', borderRadius: '15px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', transition: 'background-color 0.2s' }}>+ Ajouter une activité</button>
        )}
      </div>

    </div>
  );
}