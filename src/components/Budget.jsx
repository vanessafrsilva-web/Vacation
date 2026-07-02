import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from 'firebase/firestore';
import { Convertisseur } from './Convertisseur';
import { IconTrash, IconReceipt2, IconGasStation, IconBasket, IconCoffee, IconTicket, IconBuildingStore } from '@tabler/icons-react';

export function Budget({ voyageId }) {
  const [depenses, setDepenses] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [titre, setTitre] = useState('');
  const [montant, setMontant] = useState('');
  const [categorie, setCategorie] = useState('Courses');
  
  const [payePar, setPayePar] = useState('Moi'); 
  const [beneficiaire, setBeneficiaire] = useState('Commun');

  useEffect(() => {
    if (!voyageId) return;
    const q = query(collection(db, 'budget'), where('voyageId', '==', voyageId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setDepenses(data);
    });
    return () => unsubscribe();
  }, [voyageId]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!titre || !montant) return;

    try {
      await addDoc(collection(db, 'budget'), {
        titre,
        montant: parseFloat(montant),
        payePar,
        beneficiaire,
        categorie,
        voyageId,
        timestamp: Date.now()
      });
      setTitre(''); setMontant(''); setShowForm(false);
      setBeneficiaire('Commun');
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer cette dépense ?")) {
      await deleteDoc(doc(db, 'budget', id));
    }
  };

  let totalVoyage = 0;
  let balanceMoi = 0;

  depenses.forEach(dep => {
    totalVoyage += dep.montant;
    if (dep.payePar === 'Moi') {
      if (dep.beneficiaire === 'Commun') {
        balanceMoi += (dep.montant / 2);
      } else if (dep.beneficiaire === 'Copine') {
        balanceMoi += dep.montant;
      }
    } else if (dep.payePar === 'Copine') {
      if (dep.beneficiaire === 'Commun') {
        balanceMoi -= (dep.montant / 2);
      } else if (dep.beneficiaire === 'Moi') {
        balanceMoi -= dep.montant;
      }
    }
  });

  const getIcon = (cat) => {
    switch (cat) {
      case 'Essence': return <div style={{backgroundColor: 'rgba(255, 159, 10, 0.2)', padding: '10px', borderRadius: '12px'}}><IconGasStation size={24} color="#FF9F0A" /></div>;
      case 'Courses': return <div style={{backgroundColor: 'rgba(48, 209, 88, 0.2)', padding: '10px', borderRadius: '12px'}}><IconBasket size={24} color="#30D158" /></div>;
      case 'Verres/Resto': return <div style={{backgroundColor: 'rgba(191, 90, 242, 0.2)', padding: '10px', borderRadius: '12px'}}><IconCoffee size={24} color="#BF5AF2" /></div>;
      case 'Activités': return <div style={{backgroundColor: 'rgba(10, 132, 255, 0.2)', padding: '10px', borderRadius: '12px'}}><IconTicket size={24} color="#0A84FF" /></div>;
      default: return <div style={{backgroundColor: 'rgba(142, 142, 147, 0.2)', padding: '10px', borderRadius: '12px'}}><IconBuildingStore size={24} color="#8E8E93" /></div>;
    }
  };

  const inputStyle = { width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '12px', border: '1px solid #3A3A3C', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '16px', outline: 'none' };
  const choiceBtnStyle = (isActive, color) => ({
    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
    border: isActive ? `2px solid ${color}` : '2px solid transparent',
    backgroundColor: isActive ? `${color}20` : '#1C1C1E',
    color: isActive ? color : '#AEAEB2'
  });

  return (
    <div style={{ padding: '5px', textAlign: 'left' }}>
      
      {/* Intégration du Convertisseur */}
      <div style={{ marginBottom: '25px' }}>
        <Convertisseur />
      </div>
      
      {/* 1. TABLEAU DE BORD PREMIUM */}
      <div style={{ backgroundColor: '#1C1C1E', padding: '25px 20px', borderRadius: '20px', marginBottom: '25px', textAlign: 'center', border: '1px solid #2C2C2E', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <p style={{ margin: '0 0 8px 0', color: '#AEAEB2', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Budget Total</p>
        <h2 style={{ margin: '0 0 20px 0', color: '#FFF', fontSize: '36px', fontWeight: '800' }}>{totalVoyage.toFixed(2)} <span style={{fontSize:'20px', color:'#636366'}}>CHF</span></h2>
        
        <div style={{ 
          padding: '15px', 
          borderRadius: '15px', 
          backgroundColor: balanceMoi === 0 ? '#2C2C2E' : (balanceMoi > 0 ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)'), 
          color: balanceMoi === 0 ? '#AEAEB2' : (balanceMoi > 0 ? '#30D158' : '#FF453A'),
          border: `1px solid ${balanceMoi === 0 ? '#3A3A3C' : (balanceMoi > 0 ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)')}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
        }}>
          <IconReceipt2 size={24} />
          <span style={{ fontWeight: '700', fontSize: '16px' }}>
            {balanceMoi === 0 && "Les comptes sont à zéro !"}
            {balanceMoi > 0 && `Elle vous doit ${Math.abs(balanceMoi).toFixed(2)} CHF`}
            {balanceMoi < 0 && `Vous lui devez ${Math.abs(balanceMoi).toFixed(2)} CHF`}
          </span>
        </div>
      </div>

      {/* 2. FORMULAIRE INTELLIGENT */}
      <div style={{ marginBottom: '30px' }}>
        {showForm ? (
          <form onSubmit={handleAdd} style={{ backgroundColor: '#2C2C2E', padding: '20px', borderRadius: '20px', border: '1px solid #3A3A3C' }}>
             <div style={{ display: 'flex', gap: '12px' }}>
               <input type="text" placeholder="Titre (ex: Tesco, Pub...)" value={titre} onChange={e => setTitre(e.target.value)} style={{...inputStyle, flex: 2}} required />
               <input type="number" step="0.01" placeholder="Prix" value={montant} onChange={e => setMontant(e.target.value)} style={{...inputStyle, flex: 1}} required />
             </div>
             
             <select value={categorie} onChange={e => setCategorie(e.target.value)} style={inputStyle}>
               <option value="Courses">🛒 Courses / Supermarché</option>
               <option value="Verres/Resto">🍻 Verres & Restos</option>
               <option value="Essence">⛽️ Essence & Transports</option>
               <option value="Activités">🎟️ Visites & Activités</option>
               <option value="Autre">🛍️ Autre</option>
             </select>

             <p style={{ margin: '5px 0 10px 5px', fontSize: '13px', color: '#AEAEB2' }}>Qui a avancé l'argent ?</p>
             <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
               <button type="button" onClick={() => setPayePar('Moi')} style={choiceBtnStyle(payePar === 'Moi', '#0A84FF')}>Moi</button>
               <button type="button" onClick={() => setPayePar('Copine')} style={choiceBtnStyle(payePar === 'Copine', '#BF5AF2')}>Copine</button>
             </div>

             <p style={{ margin: '0 0 10px 5px', fontSize: '13px', color: '#AEAEB2' }}>C'était pour qui ?</p>
             <div style={{ display: 'flex', gap: '8px', marginBottom: '25px' }}>
               <button type="button" onClick={() => setBeneficiaire('Commun')} style={choiceBtnStyle(beneficiaire === 'Commun', '#30D158')}>Commun (50/50)</button>
               <button type="button" onClick={() => setBeneficiaire('Moi')} style={choiceBtnStyle(beneficiaire === 'Moi', '#0A84FF')}>Moi</button>
               <button type="button" onClick={() => setBeneficiaire('Copine')} style={choiceBtnStyle(beneficiaire === 'Copine', '#BF5AF2')}>Copine</button>
             </div>

             <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#1C1C1E', color: '#FFF', cursor: 'pointer', fontWeight: 'bold' }}>Annuler</button>
              <button type="submit" style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#30D158', color: '#000', fontWeight: '900', cursor: 'pointer', fontSize: '16px' }}>Sauvegarder</button>
             </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '16px', backgroundColor: '#0A84FF', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(10, 132, 255, 0.3)' }}>
            + Nouvelle dépense
          </button>
        )}
      </div>

      {/* 3. HISTORIQUE */}
      <div>
        <h3 style={{ color: '#FFF', fontSize: '20px', marginBottom: '15px', fontWeight: '700' }}>Transactions</h3>
        {depenses.length === 0 && <p style={{ color: '#AEAEB2', fontSize: '15px', textAlign: 'center', padding: '20px' }}>Votre portefeuille est vide.</p>}
        
        {depenses.map(dep => (
          <div key={dep.id} style={{ backgroundColor: '#1C1C1E', padding: '16px', borderRadius: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #2C2C2E' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ marginRight: '15px' }}>{getIcon(dep.categorie)}</div>
              <div>
                <p style={{ margin: '0 0 4px 0', color: '#FFF', fontWeight: '600', fontSize: '16px' }}>{dep.titre}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ color: '#AEAEB2', fontSize: '12px' }}>Payé par <strong style={{color: dep.payePar === 'Moi' ? '#0A84FF' : '#BF5AF2'}}>{dep.payePar}</strong></span>
                  <span style={{ color: '#636366', fontSize: '10px' }}>•</span>
                  <span style={{ color: '#AEAEB2', fontSize: '12px' }}>Pour <strong style={{color: dep.beneficiaire === 'Commun' ? '#30D158' : (dep.beneficiaire === 'Moi' ? '#0A84FF' : '#BF5AF2')}}>{dep.beneficiaire}</strong></span>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ color: '#FFF', fontWeight: '800', fontSize: '16px' }}>{dep.montant.toFixed(2)}</span>
              <button onClick={() => handleDelete(dep.id)} style={{ background: 'transparent', border: 'none', padding: '5px', cursor: 'pointer', display: 'flex' }}>
                <IconTrash size={20} color="#FF453A" style={{ opacity: 0.7 }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}