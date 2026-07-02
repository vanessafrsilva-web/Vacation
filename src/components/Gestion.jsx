import React, { useState, useEffect } from 'react';
// On importe des nouvelles icônes (IconCamera pour les visites, IconCoffee pour les restos)
import { IconPlane, IconBed, IconCar, IconTrash, IconEdit, IconCamera, IconCoffee } from '@tabler/icons-react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';

// 1. LE MOULE RÉUTILISABLE
function GestionSection({ titre, icone, dbCollection, placeholder1, placeholder2, placeholder3, defaultOpen = false, voyageId }) {
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);

  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [val3, setVal3] = useState('');

  // LECTURE
  useEffect(() => {
    if (!voyageId) return;
    const q = query(collection(db, dbCollection), where('voyageId', '==', voyageId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setItems(data);
    });
    return () => unsubscribe();
  }, [dbCollection, voyageId]);

  // SAUVEGARDE
  const handleSave = async (e) => {
    e.preventDefault();
    if (!val1) return;

    try {
      if (editId) {
        await updateDoc(doc(db, dbCollection, editId), { val1, val2, val3 });
      } else {
        await addDoc(collection(db, dbCollection), { val1, val2, val3, voyageId });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur de sauvegarde : ", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(`Voulez-vous vraiment supprimer cet élément ?`)) {
      await deleteDoc(doc(db, dbCollection, id));
    }
  };

  const startEdit = (item) => {
    setEditId(item.id);
    setVal1(item.val1 || ''); setVal2(item.val2 || ''); setVal3(item.val3 || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setVal1(''); setVal2(''); setVal3(''); setEditId(null); setShowForm(false);
  };

  const sectionStyle = { backgroundColor: '#2C2C2E', borderRadius: '12px', padding: '15px', marginBottom: '15px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' };
  const summaryStyle = { display: 'flex', alignItems: 'center', fontWeight: '700', fontSize: '18px', cursor: 'pointer', listStyle: 'none', color: '#FFF' };
  const inputStyle = { width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '10px', border: '1px solid #3A3A3C', backgroundColor: '#1C1C1E', color: '#FFF', outline: 'none' };

  return (
    <details style={sectionStyle} open={defaultOpen}>
      <summary style={summaryStyle}>
        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', marginRight: '12px' }}>
          {icone}
        </div>
        {titre}
      </summary>
      
      <div style={{ marginTop: '15px' }}>
        {items.map(item => (
          <div key={item.id} style={{ padding: '15px', backgroundColor: '#3A3A3C', borderRadius: '10px', marginBottom: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <h4 style={{ margin: '0 0 5px 0', color: '#FFF', fontSize: '16px' }}>{item.val1}</h4>
              <div style={{ display: 'flex', gap: '15px' }}>
                <IconEdit size={20} color="#0A84FF" style={{ cursor: 'pointer' }} onClick={() => startEdit(item)} />
                <IconTrash size={20} color="#FF453A" style={{ cursor: 'pointer' }} onClick={() => handleDelete(item.id)} />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#AEAEB2' }}>{item.val2 || '--'} • {item.val3 || '--'}</p>
          </div>
        ))}

        {showForm ? (
          <form onSubmit={handleSave} style={{ marginTop: '15px', padding: '15px', backgroundColor: '#1C1C1E', borderRadius: '10px', border: '1px solid #3A3A3C' }}>
            <input type="text" placeholder={placeholder1} value={val1} onChange={e => setVal1(e.target.value)} style={inputStyle} required />
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="text" placeholder={placeholder2} value={val2} onChange={e => setVal2(e.target.value)} style={inputStyle} />
              <input type="text" placeholder={placeholder3} value={val3} onChange={e => setVal3(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button type="button" onClick={resetForm} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: '#2C2C2E', color: '#AEAEB2', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button type="submit" style={{ flex: 1, padding: '12px', borderRadius: '10px', border: 'none', backgroundColor: editId ? '#30D158' : '#0A84FF', color: '#FFF', fontWeight: 'bold', cursor: 'pointer' }}>{editId ? "Modifier" : "Ajouter"}</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ marginTop: '10px', width: '100%', padding: '12px', backgroundColor: 'rgba(10, 132, 255, 0.1)', color: '#0A84FF', border: '1px dashed rgba(10, 132, 255, 0.3)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}>
            + Ajouter {titre.toLowerCase()}
          </button>
        )}
      </div>
    </details>
  );
}

// 2. L'ÉCRAN PRINCIPAL
export function Gestion({ voyageId }) {
  return (
    <div style={{ padding: '5px', textAlign: 'left' }}>
      
      {/* Les classiques (Logistique) */}
      <GestionSection titre="Hôtels & Logements" icone={<IconBed color="#0A84FF" />} dbCollection="hotels" placeholder1="Nom (ex: B&B Highlands)" placeholder2="Check-in" placeholder3="Check-out" voyageId={voyageId} />
      <GestionSection titre="Vols & Transports" icone={<IconPlane color="#FF9F0A" />} dbCollection="vols" placeholder1="Transport (ex: Vol EasyJet)" placeholder2="Départ" placeholder3="Arrivée" voyageId={voyageId} />
      <GestionSection titre="Véhicules" icone={<IconCar color="#30D158" />} dbCollection="vehicules" placeholder1="Modèle (ex: Fiat 500)" placeholder2="Prise en charge" placeholder3="Retour" voyageId={voyageId} />
      
      {/* NOUVEAU : Les points d'intérêt (Découverte) */}
      <div style={{ marginTop: '30px', marginBottom: '15px' }}>
        <h3 style={{ color: '#AEAEB2', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', marginLeft: '5px' }}>À découvrir</h3>
      </div>

      <GestionSection 
        titre="Lieux à visiter" 
        icone={<IconCamera color="#FF375F" />} 
        dbCollection="lieux" 
        placeholder1="Lieu (ex: Château d'Édimbourg)" 
        placeholder2="Prix estimé" 
        placeholder3="Horaires ou remarques" 
        defaultOpen={true}
        voyageId={voyageId} 
      />

      <GestionSection 
        titre="Restos & Cafés" 
        icone={<IconCoffee color="#BF5AF2" />} 
        dbCollection="restos" 
        placeholder1="Nom (ex: The Old Forge Pub)" 
        placeholder2="Type (Pub, Pizzeria, Café...)" 
        placeholder3="Réservation requise ?" 
        voyageId={voyageId} 
      />

    </div>
  );
}