import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { BottomNav } from './components/BottomNav';
import { Gestion } from './components/Gestion'; 
import { Planning } from './components/Planning';
import { Checklist } from './components/Checklist';
import { Budget } from './components/Budget';
import { Jour } from './components/Jour';
import { db } from './firebase';
// NOUVEAU : deleteDoc et doc pour supprimer le voyage
import { collection, addDoc, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';
import { IconChevronDown, IconPlus, IconPlaneDeparture, IconTrash } from '@tabler/icons-react';

function App() {
  const [activeTab, setActiveTab] = useState('gestion');
  const [voyages, setVoyages] = useState([]);
  const [voyageActif, setVoyageActif] = useState(''); 
  const [showAddVoyage, setShowAddVoyage] = useState(false);
  
  // États du Custom Dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [nouveauVoyageNom, setNouveauVoyageNom] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  // 1. GESTION DES CLICS HORS DU MENU POUR LE FERMER
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // 2. LECTURE DES VOYAGES
  useEffect(() => {
    const q = query(collection(db, 'voyages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const voyagesData = [];
      snapshot.forEach((doc) => {
        voyagesData.push({ id: doc.id, ...doc.data() });
      });
      // Tri par date de début (les plus récents en premier)
      voyagesData.sort((a, b) => new Date(b.dateDebut) - new Date(a.dateDebut));
      setVoyages(voyagesData);
      
      // Assigner un voyage par défaut si la liste n'est pas vide et qu'aucun n'est actif
      if (voyagesData.length > 0 && (!voyageActif || !voyagesData.find(v => v.id === voyageActif))) {
        setVoyageActif(voyagesData[0].id);
      }
    });
    return () => unsubscribe();
  }, [voyageActif]);

  // 3. AJOUTER UN VOYAGE
  const handleAddVoyage = async (e) => {
    e.preventDefault();
    if (!nouveauVoyageNom || !dateDebut || !dateFin) return;
    if (new Date(dateFin) < new Date(dateDebut)) {
      alert("La date de fin ne peut pas être avant le début !");
      return;
    }

    try {
      const docRef = await addDoc(collection(db, 'voyages'), { 
        nom: nouveauVoyageNom,
        dateDebut: dateDebut,
        dateFin: dateFin
      });
      setVoyageActif(docRef.id);
      setNouveauVoyageNom(''); setDateDebut(''); setDateFin('');
      setShowAddVoyage(false);
    } catch (error) {
      console.error("Erreur :", error);
    }
  };

  // 4. NOUVEAUTÉ : SUPPRIMER UN VOYAGE
  const handleDeleteVoyage = async (idASupprimer, nomVoyage, event) => {
    // Empêcher la fermeture du menu ou la sélection du voyage pendant qu'on supprime
    event.stopPropagation(); 
    
    if (window.confirm(`⚠️ Attention : Voulez-vous vraiment supprimer définitivement le voyage "${nomVoyage}" et toutes ses données associées ?`)) {
      try {
        await deleteDoc(doc(db, 'voyages', idASupprimer));
        // Note: Idéalement (dans un vrai back-end), on supprimerait aussi en cascade
        // toutes les activités, budgets et checklists liés à ce voyageId.
        if (voyageActif === idASupprimer) {
          setVoyageActif(''); // Réinitialise l'affichage
        }
        setIsDropdownOpen(false);
      } catch (error) {
        console.error("Erreur de suppression :", error);
      }
    }
  };

  const voyageActuelObj = voyages.find(v => v.id === voyageActif);

  const renderContent = () => {
    if (!voyageActuelObj) {
      return (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <IconPlaneDeparture size={60} color="#3A3A3C" style={{ marginBottom: '20px' }} />
          <h2 style={{ color: '#FFF', margin: '0 0 10px 0' }}>Aucun voyage actif</h2>
          <p style={{ color: '#AEAEB2', margin: 0, fontSize: '15px' }}>Créez votre premier itinéraire pour commencer à planifier.</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'planning': return <Planning voyage={voyageActuelObj} />;
      case 'jour': return <Jour voyage={voyageActuelObj} />;
      case 'gestion': return <Gestion voyageId={voyageActuelObj.id} />;
      case 'checklist': return <Checklist voyageId={voyageActuelObj.id} />;
      case 'facturation': return <Budget voyageId={voyageActuelObj.id} />;
      default: return <div>Écran introuvable</div>;
    }
  };

  return (
    <div style={{ paddingBottom: '80px', minHeight: '100vh', backgroundColor: '#000' }}> 
      
      {/* EN-TÊTE PREMIUM AVEC CUSTOM DROPDOWN */}
      <div style={{ padding: '20px 15px 15px 15px', backgroundColor: 'rgba(28, 28, 30, 0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '500px', margin: '0 auto', gap: '15px' }}>
          
          {/* NOUVEAU MENU DÉROULANT SUR MESURE (SANS BALISE SELECT) */}
          <div ref={dropdownRef} style={{ position: 'relative', flex: 1 }}>
            
            {/* Le bouton principal visible */}
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#2C2C2E',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '12px 18px',
                borderRadius: '16px',
                color: '#FFF',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <IconPlaneDeparture size={20} color="#0A84FF" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {voyageActuelObj ? voyageActuelObj.nom : "Sélectionner..."}
                </span>
              </div>
              <IconChevronDown size={20} color="#AEAEB2" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
            </button>

            {/* Le panneau flottant (La liste des options) */}
            {isDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                left: 0,
                right: 0,
                backgroundColor: '#2C2C2E',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                overflow: 'hidden',
                zIndex: 200,
                animation: 'slideDown 0.2s ease-out'
              }}>
                {voyages.length === 0 ? (
                  <div style={{ padding: '15px', color: '#AEAEB2', textAlign: 'center', fontSize: '14px' }}>Aucun voyage disponible</div>
                ) : (
                  voyages.map(v => (
                    <div 
                      key={v.id}
                      onClick={() => { setVoyageActif(v.id); setIsDropdownOpen(false); }}
                      style={{
                        padding: '15px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        backgroundColor: voyageActif === v.id ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
                        transition: 'background-color 0.2s'
                      }}
                    >
                      <div>
                        <div style={{ color: voyageActif === v.id ? '#0A84FF' : '#FFF', fontWeight: voyageActif === v.id ? 'bold' : 'normal', fontSize: '16px' }}>{v.nom}</div>
                        {v.dateDebut && <div style={{ color: '#8E8E93', fontSize: '12px', marginTop: '4px' }}>{new Date(v.dateDebut).toLocaleDateString('fr-CH')} - {new Date(v.dateFin).toLocaleDateString('fr-CH')}</div>}
                      </div>
                      
                      {/* BOUTON CORBEILLE POUR SUPPRIMER */}
                      <button 
                        onClick={(e) => handleDeleteVoyage(v.id, v.nom, e)}
                        style={{ background: 'transparent', border: 'none', color: '#FF453A', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Supprimer ce voyage"
                      >
                        <IconTrash size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <button onClick={() => { setShowAddVoyage(!showAddVoyage); setIsDropdownOpen(false); }} style={{ backgroundColor: '#0A84FF', border: 'none', color: '#FFF', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 15px rgba(10, 132, 255, 0.4)', transition: 'transform 0.2s', flexShrink: 0 }}>
            <IconPlus size={24} style={{ transform: showAddVoyage ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* FORMULAIRE DE CRÉATION */}
        {showAddVoyage && (
          <form onSubmit={handleAddVoyage} style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px', margin: '20px auto 0 auto', backgroundColor: '#2C2C2E', padding: '20px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 10px 30px rgba(0,0,0,0.3)', animation: 'slideDown 0.3s ease-out' }}>
            <h3 style={{ margin: '0 0 5px 0', color: '#FFF', fontSize: '18px' }}>Nouveau projet</h3>
            
            <input type="text" placeholder="Nom du voyage (ex: Écosse)" value={nouveauVoyageNom} onChange={e => setNouveauVoyageNom(e.target.value)} style={{ padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '16px', outline: 'none' }} required />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#AEAEB2', marginLeft: '5px', display: 'block', marginBottom: '4px' }}>Date de départ</label>
                <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '15px' }} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: '#AEAEB2', marginLeft: '5px', display: 'block', marginBottom: '4px' }}>Date de retour</label>
                <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', backgroundColor: '#1C1C1E', color: '#FFF', fontSize: '15px' }} required />
              </div>
            </div>
            
            <button type="submit" style={{ marginTop: '10px', padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#30D158', color: '#FFF', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px', boxShadow: '0 4px 12px rgba(48, 209, 88, 0.3)' }}>
              Créer le voyage
            </button>
          </form>
        )}
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '15px' }}>{renderContent()}</div>
      
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
    </div>
  );
}

export default App;