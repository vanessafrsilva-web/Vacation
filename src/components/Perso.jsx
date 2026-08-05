import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  IconArrowLeft, IconPlus, IconX, IconTrash, IconPencil, IconTool, IconChecklist,
  IconCalendar, IconGauge, IconCamera, IconAlertTriangle, IconCircle, IconCircleCheckFilled,
  IconNote, IconChevronDown
} from '@tabler/icons-react';

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

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function Perso({ utilisateur, onClose }) {
  const [ongletActif, setOngletActif] = useState('van'); // 'van' | 'taches'

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');`}</style>

      <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 15px 15px 15px', backgroundColor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid #E8DFCF' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '13px', color: '#2B2420', cursor: 'pointer' }}
          >
            <IconArrowLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: '21px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Perso</h2>
        </div>

        <div style={{ maxWidth: '500px', margin: '0 auto', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setOngletActif('van')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '13px',
              fontSize: '13.5px', fontWeight: '800', cursor: 'pointer',
              border: ongletActif === 'van' ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
              backgroundColor: ongletActif === 'van' ? '#F1E8D8' : '#FFFFFF',
              color: ongletActif === 'van' ? '#B8863C' : '#8A7B68'
            }}
          >
            <IconTool size={16} /> Mon Van
          </button>
          <button
            onClick={() => setOngletActif('taches')}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '13px',
              fontSize: '13.5px', fontWeight: '800', cursor: 'pointer',
              border: ongletActif === 'taches' ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
              backgroundColor: ongletActif === 'taches' ? '#F1E8D8' : '#FFFFFF',
              color: ongletActif === 'taches' ? '#B8863C' : '#8A7B68'
            }}
          >
            <IconChecklist size={16} /> Mes Tâches
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '18px 15px 40px 15px' }}>
        {ongletActif === 'van' ? <EntretienVan utilisateur={utilisateur} /> : <TachesPerso utilisateur={utilisateur} />}
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

  const [type, setType] = useState('vidange');
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

  const resetForm = () => {
    setType('vidange'); setDate(''); setKm(''); setNotes(''); setCout(''); setRappel('');
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
    setRappel(entree.rappel || ''); setPhotoPreview(entree.photoUrl || null);
    setPhotoStoragePath(entree.photoStoragePath || null);
    setIdEnEdition(entree.id); setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) return;
    const payload = {
      type, date, km: km ? parseInt(km, 10) : null, notes,
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

  const inputStyle = { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };

  return (
    <div>
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
          <input type="text" placeholder="ex: 4 pneus Michelin, garage Dupont" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, marginBottom: '10px' }} />

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', padding: '9px', backgroundColor: '#F7F1E8', borderRadius: '12px' }}>
              <img src={photoPreview} alt="Facture" style={{ width: '46px', height: '46px', objectFit: 'cover', borderRadius: '9px' }} />
              <span style={{ flex: 1, fontSize: '12px', color: '#8A7B68' }}>Photo attachée</span>
              <button type="button" onClick={() => { setPhotoPreview(null); setPhotoStoragePath(null); }} style={{ border: 'none', background: 'none', color: '#B3453A', cursor: 'pointer' }}><IconX size={16} /></button>
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
                    {e.notes && <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#475569' }}>{e.notes}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => commencerEdition(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconPencil size={16} /></button>
                    <button onClick={() => handleDelete(e)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '5px' }}><IconTrash size={16} /></button>
                  </div>
                </div>
                {e.photoUrl && (
                  <img src={e.photoUrl} alt="Facture" style={{ marginTop: '10px', width: '60px', height: '60px', objectFit: 'cover', borderRadius: '10px', border: '1px solid #E8DFCF' }} />
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
