import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import {
  IconPlus, IconMapPin, IconClock, IconCoffee, IconBed, IconSteeringWheel,
  IconCalendarEvent, IconX, IconTrash, IconPlaneDeparture, IconCar,
  IconInfoCircle, IconCalendarDue, IconPencil
} from '@tabler/icons-react';
import { Carte } from './Carte';

// Chaque catégorie définit son icône/couleur ET, si besoin, un champ de
// détail spécifique (label + placeholder) affiché uniquement pour elle.
const CATEGORIES = [
  {
    id: 'vol', label: 'Vol', icon: <IconPlaneDeparture size={20} />, color: '#6E8AA6', bg: '#EEF2F0',
    detailLabel: 'Compagnie & n° de vol', detailPlaceholder: 'ex: EasyJet EZY1234', departArrivee: true
  },
  {
    id: 'hotel', label: 'Hébergement', icon: <IconBed size={20} />, color: '#9A6B87', bg: '#F3ECF1',
    dateDepart: true, rechercheAdresse: true
  },
  {
    id: 'taxi', label: 'Taxi / Chauffeur', icon: <IconSteeringWheel size={20} />, color: '#F59E0B', bg: '#FBF3E3',
    detailLabel: 'Chauffeur / société & contact', detailPlaceholder: 'ex: Uber, +41 79 000 00 00'
  },
  {
    id: 'transport', label: 'Transport', icon: <IconCar size={20} />, color: '#5E8A87', bg: '#EEF3F2',
    detailLabel: 'Compagnie / réf. réservation', detailPlaceholder: 'ex: Train ScotRail, résa #12345'
  },
  {
    id: 'resto', label: 'Resto / Brunch', icon: <IconCoffee size={20} />, color: '#B8863C', bg: '#F1E8D8',
    detailLabel: 'Réservation au nom de', detailPlaceholder: 'ex: Réservé au nom de Vanessa', rechercheAdresse: true, notable: true
  },
  {
    id: 'visite', label: 'Visite / Activité', icon: <IconMapPin size={20} />, color: '#B97490', bg: '#F8EFF2',
    detailLabel: 'Détails', detailPlaceholder: 'ex: Billets déjà achetés en ligne', rechercheAdresse: true, notable: true
  }
];

// Catégorie Budget associée à chaque catégorie Planning, pour que le prix
// renseigné ici alimente automatiquement le total du Bilan / Budget.
const CATEGORIE_BUDGET = {
  vol: 'Essence', hotel: 'Autre', taxi: 'Essence',
  transport: 'Essence', resto: 'Verres/Resto', visite: 'Activités'
};

export const Planning = ({ voyage, currentUserId }) => {
  const [activites, setActivites] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const [heure, setHeure] = useState('');
  const [lieu, setLieu] = useState('');
  const [depart, setDepart] = useState('');
  const [arrivee, setArrivee] = useState('');
  const [categorie, setCategorie] = useState('visite');
  const [detail, setDetail] = useState('');
  const [dateDepart, setDateDepart] = useState('');
  const [prix, setPrix] = useState('');
  const [lat, setLat] = useState(null);
  const [lon, setLon] = useState(null);
  const [idEnEdition, setIdEnEdition] = useState(null); // null = ajout, sinon id de l'entrée modifiée

  // Recherche d'adresse (hôtel / resto / visite) via OpenStreetMap Nominatim —
  // gratuit, sans clé ni carte bancaire. Moins riche que Google Places mais
  // suffisant pour retrouver une adresse à partir d'un nom de lieu.
  const [suggestionsLieu, setSuggestionsLieu] = useState([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [rechercheTerminee, setRechercheTerminee] = useState(false); // pour distinguer "pas encore cherché" de "0 résultat"
  const [erreurRecherche, setErreurRecherche] = useState(false);

  const catActive = CATEGORIES.find((c) => c.id === categorie);

  useEffect(() => {
    if (!suggestionsOuvertes || !catActive?.rechercheAdresse || lieu.trim().length < 3) {
      setSuggestionsLieu([]);
      setRechercheTerminee(false);
      setErreurRecherche(false);
      return;
    }
    const minuteur = setTimeout(async () => {
      setRechercheEnCours(true);
      setErreurRecherche(false);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(lieu)}&addressdetails=1&limit=5`
        );
        if (!res.ok) throw new Error(`Statut ${res.status}`);
        const data = await res.json();
        setSuggestionsLieu(data);
        setRechercheTerminee(true);
      } catch (error) {
        console.warn("Recherche d'adresse impossible.", error);
        setSuggestionsLieu([]);
        setRechercheTerminee(true);
        setErreurRecherche(true);
      } finally {
        setRechercheEnCours(false);
      }
    }, 600);
    return () => clearTimeout(minuteur);
  }, [lieu, suggestionsOuvertes, catActive?.rechercheAdresse]);

  const choisirSuggestion = (s) => {
    setLieu(s.display_name);
    setLat(parseFloat(s.lat));
    setLon(parseFloat(s.lon));
    setSuggestionsOuvertes(false);
    setSuggestionsLieu([]);
  };

  useEffect(() => {
    if (!voyage?.id) return;
    const q = query(collection(db, `voyages/${voyage.id}/activites`));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => new Date(a.date + 'T' + a.heure) - new Date(b.date + 'T' + b.heure));
      setActivites(data);
    });
  }, [voyage?.id]);

  const groups = activites.reduce((acc, act) => {
    if (!acc[act.date]) acc[act.date] = [];
    acc[act.date].push(act);
    return acc;
  }, {});

  const resetForm = () => {
    setTitre(''); setDate(''); setHeure(''); setLieu(''); setDepart(''); setArrivee('');
    setCategorie('visite'); setDetail(''); setDateDepart(''); setPrix('');
    setLat(null); setLon(null);
    setIdEnEdition(null);
    setSuggestionsOuvertes(false); setSuggestionsLieu([]);
    setShowForm(false);
  };

  const commencerEdition = (act) => {
    setTitre(act.titre); setDate(act.date); setHeure(act.heure); setLieu(act.lieu || '');
    setDepart(act.depart || ''); setArrivee(act.arrivee || '');
    setCategorie(act.categorie); setDetail(act.detail || ''); setDateDepart(act.dateDepart || '');
    setPrix(act.prix ? String(act.prix) : '');
    setLat(act.lat ?? null); setLon(act.lon ?? null);
    setIdEnEdition(act.id);
    setShowForm(true);
  };

  // Crée, met à jour ou supprime la dépense Budget liée à cette activité,
  // pour que le prix renseigné ici alimente le total du Bilan / Budget.
  const synchroniserBudget = async (activiteId, titreActivite, prixSaisi, categoriePlanning) => {
    const budgetRef = collection(db, 'budget');
    const q = query(budgetRef, where('voyageId', '==', voyage.id), where('activiteId', '==', activiteId));
    const snapshot = await getDocs(q);
    const docExistant = snapshot.docs[0];

    const montant = parseFloat(prixSaisi);
    const aUnPrix = prixSaisi && !isNaN(montant) && montant > 0;

    if (!aUnPrix) {
      if (docExistant) await deleteDoc(doc(db, 'budget', docExistant.id));
      return;
    }

    const payload = {
      titre: titreActivite,
      montant,
      categorie: CATEGORIE_BUDGET[categoriePlanning] || 'Autre',
      voyageId: voyage.id,
      activiteId,
      estRemboursement: false,
      estApportCagnotte: false
    };

    if (docExistant) {
      await updateDoc(doc(db, 'budget', docExistant.id), payload);
    } else {
      await addDoc(budgetRef, {
        ...payload,
        payePar: currentUserId || (voyage.voyageurs || [])[0]?.id || 'moi',
        beneficiaires: (voyage.voyageurs || []).map((v) => v.id),
        timestamp: Date.now()
      });
    }
  };

  const handleAddActivite = async (e) => {
    e.preventDefault();
    const payload = {
      titre, date, heure, categorie,
      lieu: catActive?.departArrivee ? '' : lieu,
      depart: catActive?.departArrivee ? depart : null,
      arrivee: catActive?.departArrivee ? arrivee : null,
      detail: detail || null,
      dateDepart: (catActive?.dateDepart && dateDepart) ? dateDepart : null,
      prix: prix ? parseFloat(prix) : null,
      lat: catActive?.departArrivee ? null : lat,
      lon: catActive?.departArrivee ? null : lon
    };

    let idActivite = idEnEdition;
    if (idEnEdition) {
      await updateDoc(doc(db, `voyages/${voyage.id}/activites`, idEnEdition), payload);
    } else {
      const docRef = await addDoc(collection(db, `voyages/${voyage.id}/activites`), payload);
      idActivite = docRef.id;
    }

    await synchroniserBudget(idActivite, titre, prix, categorie);
    resetForm();
  };

  const handleDeleteActivite = async (id, titreActivite) => {
    if (window.confirm(`Supprimer « ${titreActivite} » du planning ?`)) {
      await deleteDoc(doc(db, `voyages/${voyage.id}/activites`, id));
      // Retire aussi la dépense Budget liée, si elle existe
      const q = query(collection(db, 'budget'), where('voyageId', '==', voyage.id), where('activiteId', '==', id));
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => deleteDoc(doc(db, 'budget', d.id)));
    }
  };

  const noterActivite = async (act, valeur) => {
    // Un nouveau clic sur l'étoile déjà atteinte remet la note à zéro (annuler)
    const nouvelleValeur = act.note === valeur ? 0 : valeur;
    await updateDoc(doc(db, `voyages/${voyage.id}/activites`, act.id), { note: nouvelleValeur });
  };

  return (
    <div style={{ padding: '20px 10px', fontFamily: "system-ui, sans-serif" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Planning</h2>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} style={{ backgroundColor: '#B8863C', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '16px', fontWeight: '700', cursor: 'pointer' }}>
          {showForm ? <IconX size={18} /> : <IconPlus size={18} />}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAddActivite} style={{ backgroundColor: '#F7F1E8', padding: '20px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #E8DFCF' }}>

          {/* Grille de catégories, comme un pense-bête visuel */}
          <p style={{ fontSize: '13px', color: '#475569', fontWeight: '600', margin: '0 0 8px 2px' }}>Type</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategorie(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px',
                  borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  border: categorie === c.id ? `2px solid ${c.color}` : '2px solid transparent',
                  backgroundColor: categorie === c.id ? c.bg : '#FFFFFF'
                }}
              >
                <span style={{ color: c.color, display: 'flex' }}>{c.icon}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: categorie === c.id ? c.color : '#2B2420' }}>{c.label}</span>
              </button>
            ))}
          </div>

          <input placeholder="Titre (ex: Vol Genève → Édimbourg)" value={titre} onChange={e => setTitre(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} required />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              {catActive?.dateDepart && <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Arrivée</label>}
              <input type="date" value={date} min={voyage?.dateDebut} max={voyage?.dateFin} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} required />
            </div>
            <div style={{ flex: 1 }}>
              {catActive?.dateDepart && <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Heure</label>}
              <input type="time" value={heure} onChange={e => setHeure(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} required />
            </div>
          </div>

          {/* Date de départ, uniquement pour un hébergement (séjour sur plusieurs jours) */}
          {catActive?.dateDepart && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Départ (checkout)</label>
              <input type="date" value={dateDepart} min={date || voyage?.dateDebut} max={voyage?.dateFin} onChange={e => setDateDepart(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          )}

          {catActive?.departArrivee ? (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="Départ (ex: Genève)" value={depart} onChange={(e) => setDepart(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              <input placeholder="Arrivée (ex: Édimbourg)" value={arrivee} onChange={(e) => setArrivee(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <input
                placeholder={catActive?.rechercheAdresse ? 'Lieu (ex: Hôtel Balmoral, Édimbourg)' : 'Lieu'}
                value={lieu}
                onChange={(e) => { setLieu(e.target.value); setLat(null); setLon(null); setSuggestionsOuvertes(true); }}
                onFocus={() => setSuggestionsOuvertes(true)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              {rechercheEnCours && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', border: '2px solid #E8DFCF', borderTopColor: '#B8863C', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              )}
              {suggestionsOuvertes && suggestionsLieu.length > 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '12px', boxShadow: '0 8px 24px rgba(43,36,32,0.1)', zIndex: 50, overflow: 'hidden' }}>
                  {suggestionsLieu.map((s) => (
                    <div
                      key={s.place_id}
                      onClick={() => choisirSuggestion(s)}
                      style={{ padding: '10px 12px', fontSize: '13px', color: '#2B2420', cursor: 'pointer', borderBottom: '1px solid #F1E8D8', display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                    >
                      <IconMapPin size={14} color="#B5A793" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{s.display_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {suggestionsOuvertes && !rechercheEnCours && rechercheTerminee && suggestionsLieu.length === 0 && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '12px', boxShadow: '0 8px 24px rgba(43,36,32,0.1)', zIndex: 50, padding: '12px', fontSize: '12.5px', color: erreurRecherche ? '#B3453A' : '#8A7B68' }}>
                  {erreurRecherche
                    ? "La recherche a échoué (réseau ou service temporairement indisponible). Tu peux réessayer, ou taper l'adresse complète toi-même."
                    : "Aucun résultat trouvé pour ce nom — essaie d'être plus précis (ex: ajoute la ville), ou tape l'adresse complète toi-même."}
                </div>
              )}
            </div>
          )}

          {/* Champ de détail propre à la catégorie sélectionnée */}
          {catActive?.detailLabel && (
            <div style={{ marginBottom: '15px' }}>
              <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>{catActive.detailLabel}</label>
              <input placeholder={catActive.detailPlaceholder} value={detail} onChange={e => setDetail(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Prix (optionnel — s'ajoute au Bilan / Budget)</label>
            <input type="number" step="0.01" placeholder="ex: 700" value={prix} onChange={(e) => setPrix(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>

          <button type="submit" style={{ width: '100%', padding: '12px', backgroundColor: '#2B2420', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}>
            {idEnEdition ? 'Enregistrer les modifications' : 'Enregistrer'}
          </button>
        </form>
      )}

      {Object.keys(groups).length === 0 && !showForm && (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#F7F1E8', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <p style={{ color: '#8A7B68', fontSize: '14px', margin: 0 }}>Rien de prévu pour l'instant.<br/>Ajoute un vol, un hôtel, une activité...</p>
        </div>
      )}

      {Object.keys(groups).sort().map((day) => (
        <div key={day} style={{ marginBottom: '30px' }}>
          <h3 style={{ fontSize: '14px', color: '#8A7B68', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IconCalendarEvent size={16} /> {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {groups[day].map((act, index) => {
              const cat = CATEGORIES.find(c => c.id === act.categorie);
              return (
                <div key={act.id} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                  {index < groups[day].length - 1 && (
                    <div style={{ position: 'absolute', left: '26px', top: '50px', bottom: '-15px', width: '2px', backgroundColor: '#E8DFCF', zIndex: 0 }}></div>
                  )}
                  <div style={{ backgroundColor: cat?.bg, color: cat?.color, padding: '12px', borderRadius: '14px', zIndex: 1, height: 'fit-content' }}>{cat?.icon}</div>
                  <div style={{ flex: 1, backgroundColor: '#FFF', padding: '16px', borderRadius: '16px', marginBottom: '16px', border: '1px solid #E8DFCF', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: '700', color: '#2B2420', fontSize: '15px' }}>{act.titre}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button onClick={() => commencerEdition(act)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px' }}><IconPencil size={15} /></button>
                        <button onClick={() => handleDeleteActivite(act.id, act.titre)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px' }}><IconTrash size={16} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: '#8A7B68', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <IconClock size={12} />
                      {act.heure}
                      {cat?.departArrivee
                        ? ((act.depart || act.arrivee)
                          ? ` • ${act.depart || '?'} → ${act.arrivee || '?'}`
                          : (act.lieu ? ` • ${act.lieu}` : ''))
                        : (act.lieu ? ` • ${act.lieu}` : '')}
                      {act.prix != null && (
                        <span style={{ fontWeight: '700', color: '#B8863C' }}>· {act.prix.toFixed(2)} CHF</span>
                      )}
                    </div>
                    {act.dateDepart && (
                      <div style={{ fontSize: '12px', color: '#8A7B68', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IconCalendarDue size={12} /> Jusqu'au {new Date(act.dateDepart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      </div>
                    )}
                    {act.detail && (
                      <div style={{ fontSize: '12px', color: cat?.color, marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '4px', backgroundColor: cat?.bg, padding: '6px 10px', borderRadius: '8px' }}>
                        <IconInfoCircle size={13} style={{ flexShrink: 0, marginTop: '1px' }} /> {act.detail}
                      </div>
                    )}

                    {cat?.notable && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((etoile) => (
                          <span
                            key={etoile}
                            onClick={() => noterActivite(act, etoile * 2)}
                            style={{ cursor: 'pointer', fontSize: '18px', lineHeight: 1, color: (act.note != null && etoile * 2 <= act.note) ? '#B8863C' : '#E8DFCF' }}
                          >
                            ★
                          </span>
                        ))}
                        {act.note != null && (
                          <span style={{ fontSize: '12px', fontWeight: '700', color: '#8A7B68', marginLeft: '4px' }}>{act.note}/10</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Vue d'ensemble du trajet — intégrée ici plutôt que dans un onglet séparé */}
      {activites.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <Carte voyage={voyage} integree />
        </div>
      )}
    </div>
  );
};
