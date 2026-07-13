import React, { useState, useEffect, useMemo } from 'react';
import { db, storage } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import {
  IconArrowLeft, IconPlus, IconX, IconTrash, IconPhoto, IconReceipt2,
  IconFileText, IconExternalLink, IconCamera, IconMoodEmpty
} from '@tabler/icons-react';

/**
 * Galerie centralisée du voyage : regroupe en un seul endroit les photos
 * souvenirs (ajoutées ici), les reçus du Budget, et les documents joints
 * du Planning (billets, réservations, visas...). Chaque source garde son
 * propre système de stockage — la Galerie ne fait que les rassembler et
 * les afficher triés, avec un filtre par type.
 */
export function Galerie({ voyage, setActiveTab, currentUserNom }) {
  const [photos, setPhotos] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [activites, setActivites] = useState([]);
  const [filtre, setFiltre] = useState('tout'); // 'tout' | 'photos' | 'recus' | 'documents'
  const [imageAgrandie, setImageAgrandie] = useState(null);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [erreurUpload, setErreurUpload] = useState('');

  useEffect(() => {
    if (!voyage?.id) return;
    const unsubPhotos = onSnapshot(
      query(collection(db, 'photos'), where('voyageId', '==', voyage.id)),
      (snap) => setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubBudget = onSnapshot(
      query(collection(db, 'budget'), where('voyageId', '==', voyage.id)),
      (snap) => setDepenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubActivites = onSnapshot(
      collection(db, `voyages/${voyage.id}/activites`),
      (snap) => setActivites(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubPhotos(); unsubBudget(); unsubActivites(); };
  }, [voyage?.id]);

  // On fusionne les 3 sources en une seule liste homogène, triée du plus
  // récent au plus ancien.
  const items = useMemo(() => {
    const depuisPhotos = photos.map((p) => ({
      id: `photo_${p.id}`, docId: p.id, type: 'photo', image: p.url, storagePath: p.storagePath,
      titre: p.nom || 'Photo souvenir', sousTitre: p.uploadeParNom || '', date: p.timestamp || 0
    }));
    const depuisRecus = depenses.filter((d) => d.recu).map((d) => ({
      id: `recu_${d.id}`, type: 'recu', image: d.recu,
      titre: d.titre, sousTitre: `${(d.montant || 0).toFixed(2)} CHF · ${d.categorie || ''}`, date: d.timestamp || 0
    }));
    const depuisDocuments = activites.filter((a) => a.documentUrl).map((a) => ({
      id: `doc_${a.id}`, type: 'document', fichierUrl: a.documentUrl,
      titre: a.titre, sousTitre: a.documentNom || 'Document', date: new Date(a.date || 0).getTime()
    }));
    const tout = [...depuisPhotos, ...depuisRecus, ...depuisDocuments];
    tout.sort((a, b) => b.date - a.date);
    return tout;
  }, [photos, depenses, activites]);

  const itemsFiltres = items.filter((it) => {
    if (filtre === 'tout') return true;
    if (filtre === 'photos') return it.type === 'photo';
    if (filtre === 'recus') return it.type === 'recu';
    if (filtre === 'documents') return it.type === 'document';
    return true;
  });

  const compte = (type) => items.filter((it) => type === 'tout' ? true : it.type === type).length;

  // Réduit une photo avant l'envoi sur Firebase Storage — pratique en van,
  // souvent avec une connexion limitée.
  const compresserPourUpload = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const largeurMax = 1600;
        const ratio = Math.min(1, largeurMax / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleAjouterPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    setUploadEnCours(true);
    setErreurUpload('');
    try {
      const blob = await compresserPourUpload(fichier);
      const chemin = `voyages/${voyage.id}/photos/${Date.now()}_${fichier.name}`;
      const storageRef = ref(storage, chemin);
      await uploadBytes(storageRef, blob);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, 'photos'), {
        voyageId: voyage.id,
        url,
        storagePath: chemin,
        nom: fichier.name,
        uploadeParNom: currentUserNom || null,
        timestamp: Date.now()
      });
    } catch (error) {
      console.warn("Échec de l'envoi de la photo.", error);
      setErreurUpload("Échec de l'envoi. Réessaie, ou vérifie ta connexion.");
    } finally {
      setUploadEnCours(false);
      e.target.value = '';
    }
  };

  const handleSupprimerPhoto = async (item) => {
    if (!window.confirm('Supprimer cette photo ?')) return;
    try {
      if (item.storagePath) await deleteObject(ref(storage, item.storagePath));
      await deleteDoc(doc(db, 'photos', item.docId));
      if (imageAgrandie?.id === item.id) setImageAgrandie(null);
    } catch (error) {
      console.warn('Erreur de suppression de la photo.', error);
    }
  };

  const ouvrirItem = (item) => {
    if (item.type === 'document') {
      window.open(item.fichierUrl, '_blank', 'noopener,noreferrer');
    } else {
      setImageAgrandie(item);
    }
  };

  const chip = (id, label) => (
    <button
      type="button"
      onClick={() => setFiltre(id)}
      style={{
        flexShrink: 0, padding: '8px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
        border: filtre === id ? '1.5px solid #B8863C' : '1.5px solid #E8DFCF',
        backgroundColor: filtre === id ? '#F1E8D8' : '#FFFFFF',
        color: filtre === id ? '#B8863C' : '#8A7B68', whiteSpace: 'nowrap'
      }}
    >
      {label} <span style={{ opacity: 0.7 }}>· {compte(id)}</span>
    </button>
  );

  return (
    <div style={{ padding: '15px', fontFamily: 'inherit', minHeight: '100vh', backgroundColor: '#F7F1E8', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab && setActiveTab('gestion')}
          style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >
          <IconArrowLeft size={18} color="#2B2420" />
        </button>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Photos & Documents</h2>
      </div>

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px' }}>
        {chip('tout', 'Tout')}
        {chip('photos', '📸 Souvenirs')}
        {chip('recus', '🧾 Reçus')}
        {chip('documents', '📄 Documents')}
      </div>

      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px',
        marginBottom: '18px', borderRadius: '14px', border: '1.5px dashed #D9CDB8', color: '#8A7B68',
        fontSize: '13.5px', fontWeight: '700', cursor: uploadEnCours ? 'default' : 'pointer', backgroundColor: '#FFFFFF'
      }}>
        <IconCamera size={18} />
        {uploadEnCours ? 'Envoi en cours...' : 'Ajouter une photo souvenir'}
        <input type="file" accept="image/*" onChange={handleAjouterPhoto} style={{ display: 'none' }} disabled={uploadEnCours} />
      </label>
      {erreurUpload && <p style={{ color: '#B3453A', fontSize: '12.5px', margin: '-12px 0 16px 4px' }}>{erreurUpload}</p>}

      {itemsFiltres.length === 0 ? (
        <div style={{ padding: '50px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
          <IconMoodEmpty size={32} color="#B5A793" style={{ marginBottom: '10px' }} />
          <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0, lineHeight: '1.6' }}>
            Rien ici pour l'instant.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {itemsFiltres.map((item) => (
            <div
              key={item.id}
              onClick={() => ouvrirItem(item)}
              style={{
                position: 'relative', aspectRatio: '1', borderRadius: '14px', overflow: 'hidden',
                cursor: 'pointer', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF'
              }}
            >
              {item.type === 'document' ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', textAlign: 'center' }}>
                  <IconFileText size={26} color="#6E8AA6" />
                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#2B2420', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {item.titre}
                  </span>
                </div>
              ) : (
                <img src={item.image} alt={item.titre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}

              <div style={{ position: 'absolute', top: '6px', left: '6px', padding: '2px 7px', borderRadius: '999px', backgroundColor: 'rgba(43,36,32,0.65)', color: '#FFFFFF', fontSize: '9.5px', fontWeight: '800' }}>
                {item.type === 'photo' && '📸'}
                {item.type === 'recu' && '🧾'}
                {item.type === 'document' && '📄'}
              </div>

              {item.type === 'photo' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleSupprimerPhoto(item); }}
                  style={{ position: 'absolute', top: '6px', right: '6px', border: 'none', backgroundColor: 'rgba(43,36,32,0.55)', color: '#FFFFFF', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <IconTrash size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Visionneuse plein écran (photos et reçus) */}
      {imageAgrandie && imageAgrandie.type !== 'document' && (
        <div
          onClick={() => setImageAgrandie(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43, 36, 32, 0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}
        >
          <button
            onClick={() => setImageAgrandie(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconX size={20} />
          </button>
          <img src={imageAgrandie.image} alt={imageAgrandie.titre} style={{ maxWidth: '100%', maxHeight: '78vh', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()} />
          <div style={{ marginTop: '14px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ margin: 0, color: '#FFFFFF', fontWeight: '700', fontSize: '14px' }}>{imageAgrandie.titre}</p>
            {imageAgrandie.sousTitre && <p style={{ margin: '4px 0 0 0', color: '#D9CDB8', fontSize: '12.5px' }}>{imageAgrandie.sousTitre}</p>}
            {imageAgrandie.type === 'photo' && (
              <button
                onClick={() => handleSupprimerPhoto(imageAgrandie)}
                style={{ marginTop: '12px', border: 'none', backgroundColor: '#B3453A', color: '#FFFFFF', fontWeight: '700', fontSize: '12.5px', padding: '9px 16px', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <IconTrash size={14} /> Supprimer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
