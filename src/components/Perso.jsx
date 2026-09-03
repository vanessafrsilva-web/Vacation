import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  IconArrowLeft, IconPlus, IconX, IconTrash, IconPencil, IconTool, IconChecklist,
  IconCalendar, IconGauge, IconCamera, IconAlertTriangle, IconCircle, IconCircleCheckFilled,
  IconNote, IconChevronDown, IconChefHat, IconBook2, IconCalendarWeek, IconChevronLeft, IconChevronRight,
  IconHeart, IconGift, IconMapPin, IconClock, IconBulb, IconArrowRight, IconMaximize
} from '@tabler/icons-react';

const MODULES_PERSO = [
  { id: 'van', titre: 'Ma Voiture', description: 'Entretien, rappels et petites tâches liées à la voiture', icon: IconTool, couleur: '#B8863C', fond: '#F1E8D8' },
  { id: 'taches', titre: 'Mes Tâches', description: 'Ta to-do list du quotidien', icon: IconChecklist, couleur: '#16C784', fond: '#E6F9F1' },
  { id: 'recettes', titre: 'Recettes', description: 'Carnet de recettes et planning des repas', icon: IconChefHat, couleur: '#B97490', fond: '#F8EFF2' },
  { id: 'dates', titre: 'Nos Dates', description: 'Journal des attentions et planification de vos rendez-vous', icon: IconHeart, couleur: '#C2707D', fond: '#F8EFF2' }
];

const TYPES_ENTRETIEN = [
  { id: 'vidange', label: 'Vidange', emoji: '🛢️' },
  { id: 'freins', label: 'Freins / Plaquettes', emoji: '🛑' },
  { id: 'pneus', label: 'Pneus', emoji: '🛞' },
  { id: 'controle', label: 'Contrôle technique', emoji: '🔍' },
  { id: 'batterie', label: 'Batterie', emoji: '🔋' },
  { id: 'clim', label: 'Climatisation', emoji: '❄️' },
  { id: 'autre', label: 'Autre', emoji: '🔧' }
];

const CATEGORIES_TACHES = [
  { id: 'maison', label: 'Maison', color: '#9A6B87', bg: '#F3ECF1' },
  { id: 'admin', label: 'Admin', color: '#6E8AA6', bg: '#EEF2F0' },
  { id: 'courses', label: 'Courses', color: '#B8863C', bg: '#F1E8D8' },
  { id: 'sante', label: 'Santé', color: '#B3453A', bg: '#FEF2F2' },
  { id: 'autre', label: 'Autre', color: '#8A7B68', bg: '#F1E8D8' }
];

const PRIORITES = [
  { id: 'urgent', label: 'Urgent', color: '#B3453A' },
  { id: 'normal', label: 'Normal', color: '#6E8AA6' },
  { id: 'optionnel', label: 'Optionnel', color: '#B5A793' }
];

const MOMENTS = [
  { id: 'matin', label: 'Matin', emoji: '☀️' },
  { id: 'midi', label: 'Midi', emoji: '🌤️' },
  { id: 'soir', label: 'Soir', emoji: '🌙' }
];

const CATEGORIES_RECETTES = [
  { id: 'petit-dej', label: 'Petit-déj', color: '#F59E0B', bg: '#FBF3E3' },
  { id: 'plat', label: 'Plat', color: '#B8863C', bg: '#F1E8D8' },
  { id: 'dessert', label: 'Dessert', color: '#B97490', bg: '#F8EFF2' },
  { id: 'autre', label: 'Autre', color: '#8A7B68', bg: '#F1E8D8' }
];

const TYPES_ATTENTIONS = [
  { id: 'fleurs', label: 'Fleurs', emoji: '💐' },
  { id: 'resto', label: 'Restaurant', emoji: '🍽️' },
  { id: 'cadeau', label: 'Cadeau', emoji: '🎁' },
  { id: 'sortie', label: 'Sortie', emoji: '🎫' },
  { id: 'attention', label: 'Petite attention', emoji: '✨' },
  { id: 'autre', label: 'Autre', emoji: '❤️' }
];

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Visionneuse plein écran, réutilisable — tap sur une photo pour la voir
// en entier, jamais coupée. Fermeture au tap en dehors ou sur la croix.
function PhotoLightbox({ url, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(20,16,13,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        style={{ position: 'absolute', top: 'calc(16px + env(safe-area-inset-top))', right: '16px', border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFF', width: '38px', height: '38px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <IconX size={20} />
      </button>
      <img
        src={url}
        alt="Photo agrandie"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: '8px' }}
      />
    </div>
  );
}

export function Perso({ utilisateur, onClose }) {
  const [ongletActif, setOngletActif] = useState(null); // null = menu | 'van' | 'taches' | 'recettes' | 'dates'

  const moduleActif = MODULES_PERSO.find((m) => m.id === ongletActif);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');`}</style>

      <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 15px 15px 15px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid #E8DFCF' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => (ongletActif === null ? onClose() : setOngletActif(null))}
            style={{ flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '13px', color: '#2B2420', cursor: 'pointer' }}
          >
            <IconArrowLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: '21px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>
            {moduleActif ? moduleActif.titre : 'Perso'}
          </h2>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '18px 15px 40px 15px' }}>
        {ongletActif === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {MODULES_PERSO.map((m) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.id}
                  onClick={() => setOngletActif(m.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px', padding: '16px',
                    backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '20px', cursor: 'pointer'
                  }}
                >
                  <div style={{ flexShrink: 0, width: '52px', height: '52px', borderRadius: '15px', backgroundColor: m.fond, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={24} color={m.couleur} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: '0 0 3px 0', fontSize: '16px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>{m.titre}</p>
                    <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.4' }}>{m.description}</p>
                  </div>
                  <IconArrowRight size={18} color="#B5A793" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        )}
        {ongletActif === 'van' && <EntretienVan utilisateur={utilisateur} />}
        {ongletActif === 'taches' && <TachesPerso utilisateur={utilisateur} />}
        {ongletActif === 'recettes' && <RecettesPerso utilisateur={utilisateur} />}
        {ongletActif === 'dates' && <DatesPerso utilisateur={utilisateur} />}
      </div>
    </div>
  );
}

// =====================================================================
// ONGLET "MON VAN" — historique d'entretien avec rappels manuels
// =====================================================================
function EntretienVan({ utilisateur }) {
  const [entrees, setEntrees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const [type, setType] = useState('vidange');
  const [fournisseur, setFournisseur] = useState('');
  const [date, setDate] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [cout, setCout] = useState('');
  const [rappel, setRappel] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoStoragePath, setPhotoStoragePath] = useState(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'entretien_van'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntrees(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  // --- "À faire" : petites choses en attente liées à la voiture, distinct
  // de l'historique (déjà fait) et distinct de "Mes Tâches" (vie perso
  // générale) — ex: "changer la clé", "prendre rdv pneus hiver".
  const [aFaire, setAFaire] = useState([]);
  const [nouvelleAFaire, setNouvelleAFaire] = useState('');

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'taches_van'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.fait === b.fait ? 0 : a.fait ? 1 : -1));
      setAFaire(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  const ajouterAFaire = async (e) => {
    e.preventDefault();
    if (!nouvelleAFaire.trim()) return;
    try {
      await addDoc(collection(db, 'taches_van'), {
        nom: nouvelleAFaire.trim(), fait: false, uid: utilisateur.uid, createdAt: serverTimestamp()
      });
      setNouvelleAFaire('');
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const toggleAFaire = async (t) => {
    try {
      await updateDoc(doc(db, 'taches_van', t.id), { fait: !t.fait });
    } catch (error) {
      console.error('Erreur de mise à jour :', error);
    }
  };

  const supprimerAFaire = async (id) => {
    try {
      await deleteDoc(doc(db, 'taches_van', id));
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const resetForm = () => {
    setType('vidange'); setDate(''); setKm(''); setNotes(''); setCout(''); setFournisseur(''); setRappel('');
    setPhotoPreview(null); setPhotoStoragePath(null); setIdEnEdition(null); setShowForm(false);
  };

  const compresser = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const largeurMax = 1400;
        const ratio = Math.min(1, largeurMax / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.8);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handlePhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setUploadEnCours(true);
    try {
      const blob = await compresser(fichier);
      const chemin = `perso/${utilisateur.uid}/entretien/${Date.now()}_${fichier.name}`;
      const storageRef = ref(storage, chemin);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      setPhotoPreview(url);
      setPhotoStoragePath(chemin);
    } catch (error) {
      console.warn("Échec de l'envoi de la photo.", error);
    } finally {
      setUploadEnCours(false);
    }
  };

  const commencerEdition = (entree) => {
    setType(entree.type); setDate(entree.date); setKm(entree.km ? String(entree.km) : '');
    setNotes(entree.notes || ''); setCout(entree.cout ? String(entree.cout) : '');
    setFournisseur(entree.fournisseur || '');
    setRappel(entree.rappel || ''); setPhotoPreview(entree.photoUrl || null);
    setPhotoStoragePath(entree.photoStoragePath || null);
    setIdEnEdition(entree.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) return;
    const payload = {
      type, date, km: km ? parseInt(km, 10) : null, notes, fournisseur: fournisseur || null,
      cout: cout ? parseFloat(cout) : null, rappel: rappel || null,
      photoUrl: photoPreview || null, photoStoragePath: photoStoragePath || null
    };
    try {
      if (idEnEdition) {
        await updateDoc(doc(db, 'entretien_van', idEnEdition), payload);
      } else {
        await addDoc(collection(db, 'entretien_van'), {
          ...payload, uid: utilisateur.uid, createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const handleDelete = async (entree) => {
    if (!window.confirm('Supprimer cette entrée ?')) return;
    try {
      if (entree.photoStoragePath) await deleteObject(ref(storage, entree.photoStoragePath));
      await deleteDoc(doc(db, 'entretien_van', entree.id));
      if (idEnEdition === entree.id) resetForm();
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const infoType = (id) => TYPES_ENTRETIEN.find((t) => t.id === id) || TYPES_ENTRETIEN[TYPES_ENTRETIEN.length - 1];

  // Rappels à venir ou dépassés, triés par date la plus proche
  const rappelsActifs = useMemo(() => {
    const aujourdHui = new Date().toISOString().slice(0, 10);
    return entrees
      .filter((e) => e.rappel)
      .map((e) => ({ ...e, depasse: e.rappel < aujourdHui }))
      .sort((a, b) => a.rappel.localeCompare(b.rappel));
  }, [entrees]);

  const totalDepense = useMemo(() => entrees.reduce((somme, e) => somme + (e.cout || 0), 0), [entrees]);

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div>
      <p style={{ margin: '0 0 16px 0', fontSize: '12.5px', color: '#8A7B68', fontWeight: '600' }}>🚗 Mazda 3 Sky-Active</p>

      {totalDepense > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '14px', backgroundColor: '#2B2420', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: '#D9CDB8', fontWeight: '700' }}>Total dépensé en entretien</span>
          <span style={{ fontSize: '16px', color: '#FFFFFF', fontWeight: '800' }}>{totalDepense.toFixed(2)} CHF</span>
        </div>
      )}

      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>🔧 À faire</p>
        {aFaire.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '10px' }}>
            {aFaire.map((t) => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', backgroundColor: '#F7F1E8', borderRadius: '11px' }}>
                <div onClick={() => toggleAFaire(t)} style={{ cursor: 'pointer', display: 'flex' }}>
                  {t.fait ? <IconCircleCheckFilled size={19} color="#16C784" /> : <IconCircle size={19} color="#B5A793" />}
                </div>
                <span onClick={() => toggleAFaire(t)} style={{ flex: 1, fontSize: '13.5px', fontWeight: '600', color: t.fait ? '#B5A793' : '#2B2420', textDecoration: t.fait ? 'line-through' : 'none', cursor: 'pointer' }}>
                  {t.nom}
                </span>
                <button onClick={() => supprimerAFaire(t.id)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '3px' }}><IconTrash size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={ajouterAFaire} style={{ display: 'flex', gap: '7px' }}>
          <input type="text" placeholder="ex: Changer la clé" value={nouvelleAFaire} onChange={(e) => setNouvelleAFaire(e.target.value)} style={{ flex: 1, padding: '9px 11px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
          <button type="submit" style={{ width: '38px', border: 'none', backgroundColor: '#B8863C', color: '#FFF', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconPlus size={17} />
          </button>
        </form>
      </div>

      {rappelsActifs.length > 0 && (
        <div style={{ marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {rappelsActifs.map((r) => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 14px', borderRadius: '14px',
              backgroundColor: r.depasse ? '#FEF2F2' : '#FBF3E3', border: `1px solid ${r.depasse ? '#F3D2D0' : '#F1E0BE'}`
            }}>
              <IconAlertTriangle size={17} color={r.depasse ? '#B3453A' : '#B8863C'} />
              <span style={{ flex: 1, fontSize: '13px', fontWeight: '700', color: '#2B2420' }}>
                {infoType(r.type).emoji} {infoType(r.type).label} — {r.depasse ? 'à faire (dépassé)' : `prévu le ${formatDate(r.rappel)}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '18px', border: '1px solid #E8DFCF', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>{idEnEdition ? 'Modifier' : 'Nouvelle entrée'}</span>
            <button type="button" onClick={resetForm} style={{ border: 'none', background: 'none', color: '#8A7B68', cursor: 'pointer' }}><IconX size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginBottom: '12px' }}>
            {TYPES_ENTRETIEN.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} style={{
                padding: '9px 6px', borderRadius: '11px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                border: type === t.id ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
                backgroundColor: type === t.id ? '#F1E8D8' : '#F7F1E8', color: type === t.id ? '#B8863C' : '#8A7B68'
              }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Date <span style={{ color: '#B3453A' }}>*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Kilométrage (optionnel)</label>
          <input type="number" placeholder="ex: 84500" value={km} onChange={(e) => setKm(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Notes</label>
          <input type="text" placeholder="ex: 4 pneus Michelin" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Garage / Mécano</label>
          <input type="text" placeholder="ex: EuroMaster Lausanne" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Coût (optionnel)</label>
              <input type="number" step="0.01" placeholder="CHF" value={cout} onChange={(e) => setCout(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Rappel (optionnel)</label>
              <input type="date" value={rappel} onChange={(e) => setRappel(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {photoPreview ? (
            <div style={{ position: 'relative', marginBottom: '14px', borderRadius: '12px', overflow: 'hidden' }}>
              <img
                src={photoPreview}
                alt="Facture"
                onClick={() => setLightboxUrl(photoPreview)}
                style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block', cursor: 'zoom-in' }}
              />
              <button
                type="button"
                onClick={() => setLightboxUrl(photoPreview)}
                aria-label="Agrandir la photo"
                style={{ position: 'absolute', top: '8px', right: '46px', border: 'none', backgroundColor: 'rgba(43,36,32,0.6)', color: '#FFF', width: '28px', height: '28px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <IconMaximize size={14} />
              </button>
              <button type="button" onClick={() => { setPhotoPreview(null); setPhotoStoragePath(null); }} style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', backgroundColor: 'rgba(43,36,32,0.6)', color: '#FFF', width: '28px', height: '28px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconX size={14} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', marginBottom: '14px', borderRadius: '12px', border: '1.5px dashed #D9CDB8', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              <IconCamera size={16} />
              {uploadEnCours ? 'Envoi...' : 'Photo de la facture (optionnel)'}
              <input type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} disabled={uploadEnCours} />
            </label>
          )}

          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
            {idEnEdition ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '14px', backgroundColor: '#B8863C', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '14.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <IconPlus size={18} /> Nouvelle entrée
        </button>
      )}

      {entrees.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          Aucun entretien enregistré pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entrees.map((e) => {
            const info = infoType(e.type);
            return (
              <div key={e.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>{info.emoji} {info.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#8A7B68', display: 'flex', alignItems: 'center', gap: '3px' }}><IconCalendar size={12} /> {formatDate(e.date)}</span>
                      {e.km && <span style={{ fontSize: '12px', color: '#8A7B68', display: 'flex', alignItems: 'center', gap: '3px' }}><IconGauge size={12} /> {e.km.toLocaleString('fr-CH')} km</span>}
                      {e.cout && <span style={{ fontSize: '12px', color: '#8A7B68', fontWeight: '700' }}>{e.cout.toFixed(2)} CHF</span>}
                    </div>
                    {e.fournisseur && (
                      <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#6E8AA6', backgroundColor: '#EEF2F0', padding: '2px 8px', borderRadius: '999px' }}>
                        🔧 {e.fournisseur}
                      </span>
                    )}
                    {e.notes && <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#475569' }}>{e.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => commencerEdition(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={16} /></button>
                    <button onClick={() => handleDelete(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                  </div>
                </div>
                {e.photoUrl && (
                  <div style={{ position: 'relative', marginTop: '10px', display: 'inline-block' }}>
                    <img
                      src={e.photoUrl}
                      alt="Facture"
                      onClick={() => setLightboxUrl(e.photoUrl)}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E8DFCF', cursor: 'zoom-in', display: 'block' }}
                    />
                    <button
                      onClick={() => setLightboxUrl(e.photoUrl)}
                      aria-label="Agrandir la photo"
                      style={{ position: 'absolute', bottom: '-5px', right: '-5px', border: '1.5px solid #FFFFFF', backgroundColor: '#2B2420', color: '#FFF', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <IconMaximize size={11} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && <PhotoLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}

// =====================================================================
// ONGLET "MES TÂCHES" — todo-list vie perso générale
// =====================================================================
function TachesPerso({ utilisateur }) {
  const [taches, setTaches] = useState([]);
  const [nouvelleTache, setNouvelleTache] = useState('');
  const [detailsOuverts, setDetailsOuverts] = useState(false);
  const [categorie, setCategorie] = useState('autre');
  const [priorite, setPriorite] = useState('normal');
  const [echeance, setEcheance] = useState('');
  const [idEnEdition, setIdEnEdition] = useState(null);
  const [filtreCategorie, setFiltreCategorie] = useState('toutes');

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'taches_perso'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (a.fait === b.fait ? 0 : a.fait ? 1 : -1));
      setTaches(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  const resetForm = () => {
    setNouvelleTache(''); setCategorie('autre'); setPriorite('normal'); setEcheance('');
    setIdEnEdition(null); setDetailsOuverts(false);
  };

  const commencerEdition = (t) => {
    setNouvelleTache(t.nom); setCategorie(t.categorie || 'autre'); setPriorite(t.priorite || 'normal');
    setEcheance(t.echeance || ''); setIdEnEdition(t.id); setDetailsOuverts(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!nouvelleTache.trim()) return;
    try {
      if (idEnEdition) {
        await updateDoc(doc(db, 'taches_perso', idEnEdition), {
          nom: nouvelleTache.trim(), categorie, priorite, echeance: echeance || null
        });
      } else {
        await addDoc(collection(db, 'taches_perso'), {
          nom: nouvelleTache.trim(), fait: false, categorie, priorite, echeance: echeance || null,
          uid: utilisateur.uid, createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const toggleFait = async (t) => {
    try {
      await updateDoc(doc(db, 'taches_perso', t.id), { fait: !t.fait });
    } catch (error) {
      console.error('Erreur de mise à jour :', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'taches_perso', id));
      if (idEnEdition === id) resetForm();
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const tachesFiltrees = filtreCategorie === 'toutes' ? taches : taches.filter((t) => (t.categorie || 'autre') === filtreCategorie);
  const total = taches.length;
  const faites = taches.filter((t) => t.fait).length;
  const progression = total === 0 ? 0 : Math.round((faites / total) * 100);
  const getCategorie = (id) => CATEGORIES_TACHES.find((c) => c.id === id) || CATEGORIES_TACHES[CATEGORIES_TACHES.length - 1];
  const getPriorite = (id) => PRIORITES.find((p) => p.id === id) || PRIORITES[1];

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div>
      {total > 0 && (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>Avancement</span>
            <span style={{ fontSize: '13px', fontWeight: '800', color: progression === 100 ? '#16C784' : '#6E8AA6' }}>{progression}%</span>
          </div>
          <div style={{ height: '7px', backgroundColor: '#EEF2F7', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${progression}%`, height: '100%', backgroundColor: progression === 100 ? '#16C784' : '#6E8AA6', borderRadius: '999px' }} />
          </div>
        </div>
      )}

      {total > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px' }}>
          <div onClick={() => setFiltreCategorie('toutes')} style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', border: filtreCategorie === 'toutes' ? '1.5px solid #2B2420' : '1.5px solid #E8DFCF', backgroundColor: filtreCategorie === 'toutes' ? '#F1E8D8' : '#FFFFFF', color: filtreCategorie === 'toutes' ? '#2B2420' : '#8A7B68' }}>Toutes</div>
          {CATEGORIES_TACHES.map((c) => (
            <div key={c.id} onClick={() => setFiltreCategorie(c.id)} style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', border: filtreCategorie === c.id ? `1.5px solid ${c.color}` : '1.5px solid #E8DFCF', backgroundColor: filtreCategorie === c.id ? c.bg : '#FFFFFF', color: filtreCategorie === c.id ? c.color : '#8A7B68' }}>{c.label}</div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '12px', marginBottom: '18px' }}>
        {idEnEdition && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '8px 10px', backgroundColor: '#EEF2F0', borderRadius: '10px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#6E8AA6' }}>✏️ Modification</span>
            <button type="button" onClick={resetForm} style={{ border: 'none', background: 'none', color: '#6E8AA6', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: '10px' }}>
          <input type="text" placeholder="Ajouter une tâche..." value={nouvelleTache} onChange={(e) => setNouvelleTache(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
          <button type="submit" style={{ width: '46px', borderRadius: '14px', border: 'none', backgroundColor: '#16C784', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <IconPlus size={22} stroke={2.5} style={{ transform: idEnEdition ? 'rotate(45deg)' : 'none' }} />
          </button>
        </div>
        <button type="button" onClick={() => setDetailsOuverts((v) => !v)} style={{ background: 'none', border: 'none', color: '#6E8AA6', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '10px 2px 2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {detailsOuverts ? 'Masquer les détails' : 'Ajouter catégorie, priorité, échéance...'}
          <IconChevronDown size={14} style={{ transform: detailsOuverts ? 'rotate(180deg)' : 'none' }} />
        </button>
        {detailsOuverts && (
          <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid #F1E8D8', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13px', fontWeight: '600', color: '#2B2420', backgroundColor: '#FFFFFF' }}>
                {CATEGORIES_TACHES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <select value={priorite} onChange={(e) => setPriorite(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13px', fontWeight: '600', color: '#2B2420', backgroundColor: '#FFFFFF' }}>
                {PRIORITES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} style={{ padding: '10px 12px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13px', color: '#2B2420', backgroundColor: '#FFFFFF', outline: 'none' }} />
          </div>
        )}
      </form>

      {tachesFiltrees.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          {total === 0 ? 'Aucune tâche pour l\'instant.' : 'Rien dans cette catégorie.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tachesFiltrees.map((t) => {
            const cat = getCategorie(t.categorie);
            const prio = getPriorite(t.priorite);
            return (
              <div key={t.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div onClick={() => toggleFait(t)} style={{ display: 'flex', alignItems: 'center', gap: '11px', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                    {t.fait ? <IconCircleCheckFilled size={22} color="#16C784" /> : <IconCircle size={22} color={cat.color} />}
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '14.5px', fontWeight: '700', color: t.fait ? '#B5A793' : '#2B2420', textDecoration: t.fait ? 'line-through' : 'none' }}>{t.nom}</span>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: cat.color, backgroundColor: cat.bg, padding: '2px 7px', borderRadius: '999px' }}>{cat.label}</span>
                        {t.priorite === 'urgent' && <span style={{ fontSize: '11px', fontWeight: '700', color: prio.color, backgroundColor: '#FEF2F2', padding: '2px 7px', borderRadius: '999px' }}>{prio.label}</span>}
                        {t.echeance && <span style={{ fontSize: '11px', color: '#B5A793', display: 'flex', alignItems: 'center', gap: '3px' }}><IconCalendar size={11} /> {formatDate(t.echeance)}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => commencerEdition(t)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={15} /></button>
                    <button onClick={() => handleDelete(t.id)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ONGLET "RECETTES" — carnet de recettes + planning hebdomadaire
// =====================================================================
function RecettesPerso({ utilisateur }) {
  const [sousOnglet, setSousOnglet] = useState('planning'); // 'planning' | 'carnet'

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setSousOnglet('planning')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '11px',
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
            border: sousOnglet === 'planning' ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
            backgroundColor: sousOnglet === 'planning' ? '#F1E8D8' : '#FFFFFF',
            color: sousOnglet === 'planning' ? '#B8863C' : '#8A7B68'
          }}
        >
          <IconCalendarWeek size={15} /> Planning
        </button>
        <button
          onClick={() => setSousOnglet('carnet')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '11px',
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
            border: sousOnglet === 'carnet' ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
            backgroundColor: sousOnglet === 'carnet' ? '#F1E8D8' : '#FFFFFF',
            color: sousOnglet === 'carnet' ? '#B8863C' : '#8A7B68'
          }}
        >
          <IconBook2 size={15} /> Mes Recettes
        </button>
      </div>

      {/* Le carnet est toujours chargé (même si l'onglet planning est actif)
          pour pouvoir choisir une recette existante dans le sélecteur. */}
      <RecetteBookEtPlanning utilisateur={utilisateur} sousOnglet={sousOnglet} />
    </div>
  );
}

function RecetteBookEtPlanning({ utilisateur, sousOnglet }) {
  const [recettes, setRecettes] = useState([]);

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'recettes_perso'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
      setRecettes(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  return sousOnglet === 'planning'
    ? <PlanningSemaine utilisateur={utilisateur} recettes={recettes} />
    : <CarnetRecettes utilisateur={utilisateur} recettes={recettes} />;
}

// --- PLANNING HEBDOMADAIRE ---------------------------------------------
function lundiDeLaSemaine(offset) {
  const auj = new Date();
  const jour = auj.getDay(); // 0 = dimanche
  const decalage = jour === 0 ? -6 : 1 - jour; // recule jusqu'au lundi
  const lundi = new Date(auj);
  lundi.setDate(auj.getDate() + decalage + offset * 7);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

const JOURS_LABEL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function PlanningSemaine({ utilisateur, recettes }) {
  const [semaineOffset, setSemaineOffset] = useState(0);
  const [planning, setPlanning] = useState({}); // clé "date_moment" -> entrée
  const [slotOuvert, setSlotOuvert] = useState(null); // { date, moment } ou null
  const [rechercheSlot, setRechercheSlot] = useState('');
  const [texteLibreSlot, setTexteLibreSlot] = useState('');

  const lundi = useMemo(() => lundiDeLaSemaine(semaineOffset), [semaineOffset]);
  const joursSemaine = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lundi);
      d.setDate(lundi.getDate() + i);
      return d;
    });
  }, [lundi]);

  const dateDebut = joursSemaine[0];
  const dateFin = joursSemaine[6];

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const debutISO = toISODate(dateDebut);
    const finISO = toISODate(dateFin);
    const q = query(collection(db, 'planning_repas'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.date >= debutISO && data.date <= finISO) {
          map[`${data.date}_${data.moment}`] = { id: d.id, ...data };
        }
      });
      setPlanning(map);
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [utilisateur?.uid, toISODate(dateDebut), toISODate(dateFin)]);

  const ouvrirSlot = (date, moment) => {
    const cle = `${date}_${moment}`;
    const existant = planning[cle];
    setTexteLibreSlot(existant?.recetteNom || '');
    setRechercheSlot('');
    setSlotOuvert({ date, moment });
  };

  const assignerRecette = async (recette) => {
    if (!slotOuvert) return;
    const { date, moment } = slotOuvert;
    try {
      await setDoc(doc(db, 'planning_repas', `${utilisateur.uid}_${date}_${moment}`), {
        uid: utilisateur.uid, date, moment,
        recetteId: recette?.id || null,
        recetteNom: recette?.nom || texteLibreSlot.trim(),
        createdAt: serverTimestamp()
      }, { merge: true });
      setSlotOuvert(null);
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const validerTexteLibre = async (e) => {
    e.preventDefault();
    if (!texteLibreSlot.trim()) return;
    await assignerRecette(null);
  };

  const viderSlot = async (date, moment) => {
    const cle = `${date}_${moment}`;
    const existant = planning[cle];
    if (!existant) return;
    try {
      await deleteDoc(doc(db, 'planning_repas', existant.id));
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const recettesFiltrees = rechercheSlot.trim()
    ? recettes.filter((r) => r.nom.toLowerCase().includes(rechercheSlot.trim().toLowerCase()))
    : recettes;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <button onClick={() => setSemaineOffset((v) => v - 1)} style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2B2420' }}>
          <IconChevronLeft size={16} />
        </button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>
            {semaineOffset === 0 ? 'Cette semaine' : dateDebut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' – ' + dateFin.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <button onClick={() => setSemaineOffset((v) => v + 1)} style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', width: '34px', height: '34px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2B2420' }}>
          <IconChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {joursSemaine.map((d, i) => {
          const dateISO = toISODate(d);
          const aujourdHui = toISODate(new Date()) === dateISO;
          return (
            <div key={dateISO} style={{ backgroundColor: '#FFFFFF', border: aujourdHui ? '1.5px solid #B8863C' : '1px solid #E8DFCF', borderRadius: '16px', padding: '12px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '12.5px', fontWeight: '800', color: aujourdHui ? '#B8863C' : '#2B2420' }}>
                {JOURS_LABEL[i]} {d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {MOMENTS.map((m) => {
                  const entree = planning[`${dateISO}_${m.id}`];
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '52px', flexShrink: 0, fontSize: '11px', color: '#B5A793', fontWeight: '700' }}>{m.emoji} {m.label}</span>
                      {entree ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#F7F1E8', borderRadius: '9px', padding: '7px 10px' }}>
                          <span style={{ flex: 1, fontSize: '12.5px', fontWeight: '600', color: '#2B2420' }}>{entree.recetteNom}</span>
                          <button onClick={() => ouvrirSlot(dateISO, m.id)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '2px', display: 'flex' }}><IconPencil size={13} /></button>
                          <button onClick={() => viderSlot(dateISO, m.id)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '2px', display: 'flex' }}><IconX size={14} /></button>
                        </div>
                      ) : (
                        <button onClick={() => ouvrirSlot(dateISO, m.id)} style={{ flex: 1, border: '1px dashed #D9CDB8', background: 'transparent', borderRadius: '9px', padding: '7px 10px', color: '#B5A793', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'left' }}>
                          + Ajouter
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {slotOuvert && (
        <div
          onClick={() => setSlotOuvert(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43, 36, 32, 0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#FFFFFF', borderRadius: '20px 20px 0 0', padding: '20px', width: '100%', maxWidth: '460px', maxHeight: '75vh', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#2B2420' }}>
                {JOURS_LABEL[joursSemaine.findIndex((d) => toISODate(d) === slotOuvert.date)]} · {MOMENTS.find((m) => m.id === slotOuvert.moment)?.label}
              </h3>
              <button onClick={() => setSlotOuvert(null)} style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', width: '30px', height: '30px', borderRadius: '10px', cursor: 'pointer' }}><IconX size={16} /></button>
            </div>

            <form onSubmit={validerTexteLibre} style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
              <input
                type="text"
                placeholder="Écrire rapidement (ex: Pâtes au pesto)"
                value={texteLibreSlot}
                onChange={(e) => { setTexteLibreSlot(e.target.value); setRechercheSlot(e.target.value); }}
                style={{ flex: 1, padding: '11px 13px', borderRadius: '11px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button type="submit" style={{ width: '42px', border: 'none', backgroundColor: '#B8863C', color: '#FFF', borderRadius: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <IconPlus size={18} />
              </button>
            </form>

            {recettes.length > 0 && (
              <>
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#B5A793', fontWeight: '700' }}>OU CHOISIR UNE RECETTE</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recettesFiltrees.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => assignerRecette(r)}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', backgroundColor: '#F7F1E8', borderRadius: '11px', cursor: 'pointer' }}
                    >
                      <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#2B2420', flex: 1 }}>{r.nom}</span>
                      {r.categorie && <span style={{ fontSize: '10.5px', fontWeight: '700', color: CATEGORIES_RECETTES.find((c) => c.id === r.categorie)?.color || '#8A7B68' }}>{CATEGORIES_RECETTES.find((c) => c.id === r.categorie)?.label}</span>}
                    </div>
                  ))}
                  {recettesFiltrees.length === 0 && (
                    <p style={{ fontSize: '12.5px', color: '#B5A793', textAlign: 'center', padding: '10px' }}>Aucune recette ne correspond.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- CARNET DE RECETTES --------------------------------------------------
function CarnetRecettes({ utilisateur, recettes }) {
  const [showForm, setShowForm] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState(null);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState('plat');
  const [ingredients, setIngredients] = useState('');
  const [etapes, setEtapes] = useState('');
  const [recetteOuverte, setRecetteOuverte] = useState(null); // pour la vue détail

  const resetForm = () => {
    setNom(''); setCategorie('plat'); setIngredients(''); setEtapes('');
    setIdEnEdition(null); setShowForm(false);
  };

  const commencerEdition = (r) => {
    setNom(r.nom); setCategorie(r.categorie || 'plat');
    setIngredients(r.ingredients || ''); setEtapes(r.etapes || '');
    setIdEnEdition(r.id); setShowForm(true); setRecetteOuverte(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;
    const payload = { nom: nom.trim(), categorie, ingredients, etapes };
    try {
      if (idEnEdition) {
        await updateDoc(doc(db, 'recettes_perso', idEnEdition), payload);
      } else {
        await addDoc(collection(db, 'recettes_perso'), { ...payload, uid: utilisateur.uid, createdAt: serverTimestamp() });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cette recette ?')) return;
    try {
      await deleteDoc(doc(db, 'recettes_perso', id));
      setRecetteOuverte(null);
      if (idEnEdition === id) resetForm();
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const inputStyle = { width: '100%', padding: '11px', borderRadius: '11px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '14.5px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const getCat = (id) => CATEGORIES_RECETTES.find((c) => c.id === id) || CATEGORIES_RECETTES[CATEGORIES_RECETTES.length - 1];

  return (
    <div>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '13px', backgroundColor: '#B8863C', color: '#FFF', border: 'none', borderRadius: '15px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <IconPlus size={17} /> Nouvelle recette
        </button>
      ) : (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '18px', border: '1px solid #E8DFCF', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>{idEnEdition ? 'Modifier' : 'Nouvelle recette'}</span>
            <button type="button" onClick={resetForm} style={{ border: 'none', background: 'none', color: '#8A7B68', cursor: 'pointer' }}><IconX size={18} /></button>
          </div>

          <input type="text" placeholder="Nom de la recette" value={nom} onChange={(e) => setNom(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />

          <div style={{ display: 'flex', gap: '7px', marginBottom: '10px', flexWrap: 'wrap' }}>
            {CATEGORIES_RECETTES.map((c) => (
              <button key={c.id} type="button" onClick={() => setCategorie(c.id)} style={{
                padding: '7px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                border: categorie === c.id ? `1.5px solid ${c.color}` : '1.5px solid #E8DFCF',
                backgroundColor: categorie === c.id ? c.bg : '#FFFFFF', color: categorie === c.id ? c.color : '#8A7B68'
              }}>
                {c.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Ingrédients</label>
          <textarea placeholder={'ex: 200g de farine\n2 œufs\n1 pincée de sel'} value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} style={{ ...inputStyle, marginBottom: '10px', resize: 'vertical', fontFamily: 'inherit' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Étapes</label>
          <textarea placeholder="ex: Mélanger, cuire 20 min à 180°..." value={etapes} onChange={(e) => setEtapes(e.target.value)} rows={4} style={{ ...inputStyle, marginBottom: '14px', resize: 'vertical', fontFamily: 'inherit' }} />

          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
            {idEnEdition ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>
      )}

      {recettes.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          Aucune recette pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {recettes.map((r) => {
            const cat = getCat(r.categorie);
            return (
              <div key={r.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '13px' }}>
                <div onClick={() => setRecetteOuverte(recetteOuverte === r.id ? null : r.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>{r.nom}</span>
                    <span style={{ fontSize: '10.5px', fontWeight: '700', color: cat.color, backgroundColor: cat.bg, padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>{cat.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={(e) => { e.stopPropagation(); commencerEdition(r); }} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={15} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                    <IconChevronDown size={16} color="#B5A793" style={{ transform: recetteOuverte === r.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '4px', alignSelf: 'center' }} />
                  </div>
                </div>

                {recetteOuverte === r.id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1E8D8' }}>
                    {r.ingredients && (
                      <>
                        <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: '800', color: '#8A7B68' }}>INGRÉDIENTS</p>
                        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', whiteSpace: 'pre-line', lineHeight: '1.6' }}>{r.ingredients}</p>
                      </>
                    )}
                    {r.etapes && (
                      <>
                        <p style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: '800', color: '#8A7B68' }}>ÉTAPES</p>
                        <p style={{ margin: 0, fontSize: '13px', color: '#475569', whiteSpace: 'pre-line', lineHeight: '1.6' }}>{r.etapes}</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// ONGLET "NOS DATES" — journal des attentions (fleurs, cadeaux...)
// + planificateur de rendez-vous/sorties avec timeline
// =====================================================================
function DatesPerso({ utilisateur }) {
  const [sousOnglet, setSousOnglet] = useState('journal'); // 'journal' | 'planifier'

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setSousOnglet('journal')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '11px',
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
            border: sousOnglet === 'journal' ? '1.5px solid #C2707D' : '1.5px solid #E8DFCF',
            backgroundColor: sousOnglet === 'journal' ? '#F8EFF2' : '#FFFFFF',
            color: sousOnglet === 'journal' ? '#C2707D' : '#8A7B68'
          }}
        >
          <IconGift size={15} /> Journal
        </button>
        <button
          onClick={() => setSousOnglet('planifier')}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '11px',
            fontSize: '12.5px', fontWeight: '800', cursor: 'pointer',
            border: sousOnglet === 'planifier' ? '1.5px solid #C2707D' : '1.5px solid #E8DFCF',
            backgroundColor: sousOnglet === 'planifier' ? '#F8EFF2' : '#FFFFFF',
            color: sousOnglet === 'planifier' ? '#C2707D' : '#8A7B68'
          }}
        >
          <IconMapPin size={15} /> Planifier
        </button>
      </div>

      {sousOnglet === 'journal'
        ? <JournalAttentions utilisateur={utilisateur} />
        : <PlanificateurDates utilisateur={utilisateur} />}
    </div>
  );
}

// --- JOURNAL DES ATTENTIONS (fleurs, cadeaux, restos...) ---------------
function JournalAttentions({ utilisateur }) {
  const [entrees, setEntrees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState(null);

  const [type, setType] = useState('fleurs');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [lieu, setLieu] = useState('');
  const [montant, setMontant] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'dates_attentions'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setEntrees(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  const resetForm = () => {
    setType('fleurs'); setDate(toISODate(new Date())); setLieu(''); setMontant(''); setNotes('');
    setIdEnEdition(null); setShowForm(false);
  };

  const commencerEdition = (entree) => {
    setType(entree.type); setDate(entree.date); setLieu(entree.lieu || '');
    setMontant(entree.montant ? String(entree.montant) : ''); setNotes(entree.notes || '');
    setIdEnEdition(entree.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) return;
    const payload = {
      type, date, lieu: lieu || null,
      montant: montant ? parseFloat(montant) : null, notes: notes || null
    };
    try {
      if (idEnEdition) {
        await updateDoc(doc(db, 'dates_attentions', idEnEdition), payload);
      } else {
        await addDoc(collection(db, 'dates_attentions'), {
          ...payload, uid: utilisateur.uid, createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const handleDelete = async (entree) => {
    if (!window.confirm('Supprimer cette entrée ?')) return;
    try {
      await deleteDoc(doc(db, 'dates_attentions', entree.id));
      if (idEnEdition === entree.id) resetForm();
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const infoType = (id) => TYPES_ATTENTIONS.find((t) => t.id === id) || TYPES_ATTENTIONS[TYPES_ATTENTIONS.length - 1];

  // Derniers repères, par type, pour répondre tout de suite à
  // "c'était quand les dernières fleurs ?"
  const derniersParType = useMemo(() => {
    const map = {};
    entrees.forEach((e) => {
      if (!map[e.type]) map[e.type] = e;
    });
    return map;
  }, [entrees]);

  const totalDepense = useMemo(() => entrees.reduce((s, e) => s + (e.montant || 0), 0), [entrees]);

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div>
      {Object.keys(derniersParType).length > 0 && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
          {TYPES_ATTENTIONS.filter((t) => derniersParType[t.id]).map((t) => (
            <div key={t.id} style={{ flexShrink: 0, minWidth: '128px', backgroundColor: '#FFFFFF', border: '1px solid #F1D9DF', borderRadius: '14px', padding: '10px 12px' }}>
              <p style={{ margin: '0 0 3px 0', fontSize: '11px', fontWeight: '700', color: '#C2707D' }}>{t.emoji} Dernier {t.label.toLowerCase()}</p>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>{formatDate(derniersParType[t.id].date)}</p>
            </div>
          ))}
        </div>
      )}

      {totalDepense > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', borderRadius: '14px', backgroundColor: '#2B2420', marginBottom: '16px' }}>
          <span style={{ fontSize: '13px', color: '#D9CDB8', fontWeight: '700' }}>Total offert</span>
          <span style={{ fontSize: '16px', color: '#FFFFFF', fontWeight: '800' }}>{totalDepense.toFixed(2)} CHF</span>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '18px', border: '1px solid #E8DFCF', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>{idEnEdition ? 'Modifier' : 'Nouvelle attention'}</span>
            <button type="button" onClick={resetForm} style={{ border: 'none', background: 'none', color: '#8A7B68', cursor: 'pointer' }}><IconX size={18} /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px', marginBottom: '12px' }}>
            {TYPES_ATTENTIONS.map((t) => (
              <button key={t.id} type="button" onClick={() => setType(t.id)} style={{
                padding: '9px 6px', borderRadius: '11px', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer',
                border: type === t.id ? '1.5px solid #C2707D' : '1.5px solid #E8DFCF',
                backgroundColor: type === t.id ? '#F8EFF2' : '#F7F1E8', color: type === t.id ? '#C2707D' : '#8A7B68'
              }}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Date <span style={{ color: '#B3453A' }}>*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Lieu / occasion (optionnel)</label>
          <input type="text" placeholder="ex: Anniversaire, marché de Berne..." value={lieu} onChange={(e) => setLieu(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Montant (optionnel)</label>
          <input type="number" step="0.01" placeholder="CHF" value={montant} onChange={(e) => setMontant(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Notes</label>
          <input type="text" placeholder="ex: Bouquet de pivoines, elle a adoré" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, marginBottom: '14px' }} />

          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
            {idEnEdition ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '14px', backgroundColor: '#C2707D', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '14.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <IconPlus size={18} /> Nouvelle attention
        </button>
      )}

      {entrees.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          Aucune attention enregistrée pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {entrees.map((e) => {
            const info = infoType(e.type);
            return (
              <div key={e.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>{info.emoji} {info.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#8A7B68', display: 'flex', alignItems: 'center', gap: '3px' }}><IconCalendar size={12} /> {formatDate(e.date)}</span>
                      {e.montant && <span style={{ fontSize: '12px', color: '#8A7B68', fontWeight: '700' }}>{e.montant.toFixed(2)} CHF</span>}
                    </div>
                    {e.lieu && (
                      <span style={{ display: 'inline-block', marginTop: '6px', fontSize: '11px', fontWeight: '700', color: '#C2707D', backgroundColor: '#F8EFF2', padding: '2px 8px', borderRadius: '999px' }}>
                        📍 {e.lieu}
                      </span>
                    )}
                    {e.notes && <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#475569' }}>{e.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => commencerEdition(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={16} /></button>
                    <button onClick={() => handleDelete(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- PLANIFICATEUR DE RENDEZ-VOUS / SORTIES (avec timeline) ------------
function PlanificateurDates({ utilisateur }) {
  const [plans, setPlans] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState(null);
  const [planOuvert, setPlanOuvert] = useState(null);

  const [titre, setTitre] = useState('');
  const [date, setDate] = useState('');
  const [lieu, setLieu] = useState('');
  const [notes, setNotes] = useState('');
  const [etapes, setEtapes] = useState([]); // [{ heure, texte }]

  useEffect(() => {
    if (!utilisateur?.uid) return;
    const q = query(collection(db, 'planif_dates'), where('uid', '==', utilisateur.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => new Date(a.date) - new Date(b.date));
      setPlans(data);
    });
    return () => unsub();
  }, [utilisateur?.uid]);

  const resetForm = () => {
    setTitre(''); setDate(''); setLieu(''); setNotes(''); setEtapes([]);
    setIdEnEdition(null); setShowForm(false);
  };

  const commencerEdition = (p) => {
    setTitre(p.titre); setDate(p.date); setLieu(p.lieu || ''); setNotes(p.notes || '');
    setEtapes(p.etapes && p.etapes.length > 0 ? p.etapes : []);
    setIdEnEdition(p.id); setShowForm(true); setPlanOuvert(null);
  };

  const ajouterEtape = () => setEtapes((prev) => [...prev, { heure: '', texte: '' }]);
  const modifierEtape = (i, champ, valeur) => setEtapes((prev) => prev.map((et, idx) => idx === i ? { ...et, [champ]: valeur } : et));
  const supprimerEtape = (i) => setEtapes((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!titre.trim() || !date) return;
    const etapesTriees = [...etapes]
      .filter((et) => et.texte.trim())
      .sort((a, b) => (a.heure || '99:99').localeCompare(b.heure || '99:99'));
    const payload = { titre: titre.trim(), date, lieu: lieu || null, notes: notes || null, etapes: etapesTriees };
    try {
      if (idEnEdition) {
        await updateDoc(doc(db, 'planif_dates', idEnEdition), payload);
      } else {
        await addDoc(collection(db, 'planif_dates'), {
          ...payload, uid: utilisateur.uid, createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'enregistrement :", error);
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm('Supprimer cette date planifiée ?')) return;
    try {
      await deleteDoc(doc(db, 'planif_dates', p.id));
      if (idEnEdition === p.id) resetForm();
      if (planOuvert === p.id) setPlanOuvert(null);
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
  const aujourdHui = toISODate(new Date());

  return (
    <div>
      {showForm ? (
        <form onSubmit={handleSubmit} style={{ backgroundColor: '#FFFFFF', padding: '18px', borderRadius: '18px', border: '1px solid #E8DFCF', marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>{idEnEdition ? 'Modifier la fiche' : 'Nouvelle date'}</span>
            <button type="button" onClick={resetForm} style={{ border: 'none', background: 'none', color: '#8A7B68', cursor: 'pointer' }}><IconX size={18} /></button>
          </div>

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Titre <span style={{ color: '#B3453A' }}>*</span></label>
          <input type="text" placeholder="ex: Dimanche à Berne" value={titre} onChange={(e) => setTitre(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Date <span style={{ color: '#B3453A' }}>*</span></label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} required />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Lieu principal (optionnel)</label>
          <input type="text" placeholder="ex: Berne, marché de la place centrale" value={lieu} onChange={(e) => setLieu(e.target.value)} style={{ ...inputStyle, marginBottom: '14px' }} />

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '8px' }}>Déroulé de la journée</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
            {etapes.map((et, i) => (
              <div key={i} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
                <input
                  type="time"
                  value={et.heure}
                  onChange={(e) => modifierEtape(i, 'heure', e.target.value)}
                  style={{ width: '92px', flexShrink: 0, padding: '10px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13px', color: '#2B2420', backgroundColor: '#FFFFFF', outline: 'none' }}
                />
                <input
                  type="text"
                  placeholder="ex: Fleurs sur le marché"
                  value={et.texte}
                  onChange={(e) => modifierEtape(i, 'texte', e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => supprimerEtape(i)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px', flexShrink: 0 }}><IconX size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterEtape} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px dashed #D9CDB8', background: 'transparent', borderRadius: '11px', padding: '9px 12px', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer', marginBottom: '14px' }}>
            <IconClock size={15} /> Ajouter une étape
          </button>

          <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>Notes / idées (optionnel)</label>
          <textarea placeholder="ex: Ne pas oublier de réserver le resto" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ ...inputStyle, marginBottom: '14px', resize: 'vertical', fontFamily: 'inherit' }} />

          <button type="submit" style={{ width: '100%', padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', fontSize: '14px', cursor: 'pointer' }}>
            {idEnEdition ? 'Enregistrer' : 'Créer la fiche'}
          </button>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '14px', backgroundColor: '#C2707D', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '14.5px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
          <IconPlus size={18} /> Planifier une date
        </button>
      )}

      {plans.length === 0 ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF', color: '#B5A793', fontSize: '13.5px' }}>
          Aucune date planifiée pour l'instant.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {plans.map((p) => {
            const passe = p.date < aujourdHui;
            return (
              <div key={p.id} style={{ backgroundColor: '#FFFFFF', border: p.date === aujourdHui ? '1.5px solid #C2707D' : '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', opacity: passe ? 0.65 : 1 }}>
                <div onClick={() => setPlanOuvert(planOuvert === p.id ? null : p.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>💕 {p.titre}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', color: '#8A7B68', display: 'flex', alignItems: 'center', gap: '3px' }}><IconCalendar size={12} /> {formatDate(p.date)}</span>
                      {p.lieu && <span style={{ fontSize: '12px', color: '#8A7B68', display: 'flex', alignItems: 'center', gap: '3px' }}><IconMapPin size={12} /> {p.lieu}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={(e) => { e.stopPropagation(); commencerEdition(p); }} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                    <IconChevronDown size={16} color="#B5A793" style={{ transform: planOuvert === p.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', marginLeft: '2px' }} />
                  </div>
                </div>

                {planOuvert === p.id && (
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #F1E8D8' }}>
                    {p.etapes && p.etapes.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {p.etapes.map((et, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '44px', flexShrink: 0, fontSize: '12px', fontWeight: '800', color: '#C2707D' }}>{et.heure || '—'}</span>
                            <span style={{ flex: 1, fontSize: '13px', color: '#2B2420', backgroundColor: '#F8EFF2', padding: '7px 10px', borderRadius: '9px' }}>{et.texte}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '12.5px', color: '#B5A793' }}>Aucune étape détaillée.</p>
                    )}
                    {p.notes && (
                      <p style={{ margin: '10px 0 0 0', fontSize: '12.5px', color: '#475569', whiteSpace: 'pre-line' }}>{p.notes}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
