import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import {
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc,
  arrayUnion, arrayRemove, setDoc, getDoc, serverTimestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  IconArrowLeft, IconPlus, IconTrash, IconToolsKitchen2, IconUsers, IconX,
  IconSearch, IconStar, IconAlertTriangle, IconShare, IconTrophy, IconHeart,
  IconCamera, IconCheck, IconMapPin
} from '@tabler/icons-react';

// Types de cuisine proposés (pour se souvenir "c'était quel genre ?" au partage)
const CUISINES = [
  { id: 'italienne', label: '🍝 Italienne' }, { id: 'francaise', label: '🥐 Française' },
  { id: 'japonaise', label: '🍣 Japonaise' }, { id: 'indienne', label: '🍛 Indienne' },
  { id: 'thailandaise', label: '🍜 Thaïlandaise' }, { id: 'chinoise', label: '🥢 Chinoise' },
  { id: 'mexicaine', label: '🌮 Mexicaine' }, { id: 'libanaise', label: '🧆 Libanaise / Moyen-Orient' },
  { id: 'espagnole', label: '🥘 Espagnole' }, { id: 'grecque', label: '🥙 Grecque' },
  { id: 'americaine', label: '🍔 Américaine / Burger' }, { id: 'fusion', label: '🍽️ Fusion' },
  { id: 'vegetarien', label: '🥗 Végétarien / Vegan' }, { id: 'fruitsdemer', label: '🦐 Fruits de mer' },
  { id: 'streetfood', label: '🌭 Street food' }, { id: 'autre', label: '🍴 Autre' }
];
const trouverCuisine = (id) => CUISINES.find((c) => c.id === id);

// Construit l'emoji drapeau à partir d'un code pays ISO (ex: "FR" -> 🇫🇷) —
// aucune image/dépendance nécessaire, juste deux caractères unicode spéciaux.
const drapeau = (code) => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

// Liste de pays proposée dans le formulaire (code ISO, nom, continent).
// Volontairement large sans être exhaustive — largement suffisant pour un
// carnet de voyage personnel. Triée par continent puis alphabétiquement.
const PAYS = [
  // Europe
  { code: 'FR', nom: 'France', continent: 'Europe' }, { code: 'PT', nom: 'Portugal', continent: 'Europe' },
  { code: 'ES', nom: 'Espagne', continent: 'Europe' }, { code: 'IT', nom: 'Italie', continent: 'Europe' },
  { code: 'GB', nom: 'Royaume-Uni', continent: 'Europe' }, { code: 'IE', nom: 'Irlande', continent: 'Europe' },
  { code: 'DE', nom: 'Allemagne', continent: 'Europe' }, { code: 'AT', nom: 'Autriche', continent: 'Europe' },
  { code: 'CH', nom: 'Suisse', continent: 'Europe' }, { code: 'BE', nom: 'Belgique', continent: 'Europe' },
  { code: 'NL', nom: 'Pays-Bas', continent: 'Europe' }, { code: 'LU', nom: 'Luxembourg', continent: 'Europe' },
  { code: 'DK', nom: 'Danemark', continent: 'Europe' }, { code: 'NO', nom: 'Norvège', continent: 'Europe' },
  { code: 'SE', nom: 'Suède', continent: 'Europe' }, { code: 'FI', nom: 'Finlande', continent: 'Europe' },
  { code: 'IS', nom: 'Islande', continent: 'Europe' }, { code: 'PL', nom: 'Pologne', continent: 'Europe' },
  { code: 'CZ', nom: 'Tchéquie', continent: 'Europe' }, { code: 'SK', nom: 'Slovaquie', continent: 'Europe' },
  { code: 'HU', nom: 'Hongrie', continent: 'Europe' }, { code: 'RO', nom: 'Roumanie', continent: 'Europe' },
  { code: 'BG', nom: 'Bulgarie', continent: 'Europe' }, { code: 'GR', nom: 'Grèce', continent: 'Europe' },
  { code: 'HR', nom: 'Croatie', continent: 'Europe' }, { code: 'SI', nom: 'Slovénie', continent: 'Europe' },
  { code: 'RS', nom: 'Serbie', continent: 'Europe' }, { code: 'BA', nom: 'Bosnie-Herzégovine', continent: 'Europe' },
  { code: 'ME', nom: 'Monténégro', continent: 'Europe' }, { code: 'MK', nom: 'Macédoine du Nord', continent: 'Europe' },
  { code: 'AL', nom: 'Albanie', continent: 'Europe' }, { code: 'UA', nom: 'Ukraine', continent: 'Europe' },
  { code: 'LT', nom: 'Lituanie', continent: 'Europe' }, { code: 'LV', nom: 'Lettonie', continent: 'Europe' },
  { code: 'EE', nom: 'Estonie', continent: 'Europe' }, { code: 'MT', nom: 'Malte', continent: 'Europe' },
  { code: 'CY', nom: 'Chypre', continent: 'Europe' }, { code: 'MC', nom: 'Monaco', continent: 'Europe' },
  { code: 'AD', nom: 'Andorre', continent: 'Europe' },
  // Amérique du Nord
  { code: 'US', nom: 'États-Unis', continent: 'Amérique du Nord' }, { code: 'CA', nom: 'Canada', continent: 'Amérique du Nord' },
  { code: 'MX', nom: 'Mexique', continent: 'Amérique du Nord' },
  // Amérique du Sud
  { code: 'BR', nom: 'Brésil', continent: 'Amérique du Sud' }, { code: 'AR', nom: 'Argentine', continent: 'Amérique du Sud' },
  { code: 'CL', nom: 'Chili', continent: 'Amérique du Sud' }, { code: 'PE', nom: 'Pérou', continent: 'Amérique du Sud' },
  { code: 'CO', nom: 'Colombie', continent: 'Amérique du Sud' }, { code: 'EC', nom: 'Équateur', continent: 'Amérique du Sud' },
  { code: 'BO', nom: 'Bolivie', continent: 'Amérique du Sud' }, { code: 'UY', nom: 'Uruguay', continent: 'Amérique du Sud' },
  // Afrique
  { code: 'MA', nom: 'Maroc', continent: 'Afrique' }, { code: 'TN', nom: 'Tunisie', continent: 'Afrique' },
  { code: 'DZ', nom: 'Algérie', continent: 'Afrique' }, { code: 'EG', nom: 'Égypte', continent: 'Afrique' },
  { code: 'SN', nom: 'Sénégal', continent: 'Afrique' }, { code: 'ZA', nom: 'Afrique du Sud', continent: 'Afrique' },
  { code: 'KE', nom: 'Kenya', continent: 'Afrique' }, { code: 'TZ', nom: 'Tanzanie', continent: 'Afrique' },
  { code: 'MU', nom: 'Île Maurice', continent: 'Afrique' }, { code: 'MG', nom: 'Madagascar', continent: 'Afrique' },
  { code: 'CV', nom: 'Cap-Vert', continent: 'Afrique' },
  // Asie
  { code: 'JP', nom: 'Japon', continent: 'Asie' }, { code: 'CN', nom: 'Chine', continent: 'Asie' },
  { code: 'TH', nom: 'Thaïlande', continent: 'Asie' }, { code: 'VN', nom: 'Vietnam', continent: 'Asie' },
  { code: 'KR', nom: 'Corée du Sud', continent: 'Asie' }, { code: 'ID', nom: 'Indonésie', continent: 'Asie' },
  { code: 'IN', nom: 'Inde', continent: 'Asie' }, { code: 'MY', nom: 'Malaisie', continent: 'Asie' },
  { code: 'SG', nom: 'Singapour', continent: 'Asie' }, { code: 'PH', nom: 'Philippines', continent: 'Asie' },
  { code: 'KH', nom: 'Cambodge', continent: 'Asie' }, { code: 'LA', nom: 'Laos', continent: 'Asie' },
  { code: 'NP', nom: 'Népal', continent: 'Asie' }, { code: 'LK', nom: 'Sri Lanka', continent: 'Asie' },
  { code: 'TW', nom: 'Taïwan', continent: 'Asie' }, { code: 'TR', nom: 'Turquie', continent: 'Asie' },
  { code: 'GE', nom: 'Géorgie', continent: 'Asie' },
  // Moyen-Orient
  { code: 'AE', nom: 'Émirats arabes unis', continent: 'Moyen-Orient' }, { code: 'IL', nom: 'Israël', continent: 'Moyen-Orient' },
  { code: 'JO', nom: 'Jordanie', continent: 'Moyen-Orient' }, { code: 'LB', nom: 'Liban', continent: 'Moyen-Orient' },
  { code: 'QA', nom: 'Qatar', continent: 'Moyen-Orient' },
  // Océanie
  { code: 'AU', nom: 'Australie', continent: 'Océanie' }, { code: 'NZ', nom: 'Nouvelle-Zélande', continent: 'Océanie' },
  { code: 'FJ', nom: 'Fidji', continent: 'Océanie' }
];

const trouverPays = (code) => PAYS.find((p) => p.code === code);

// Options pour l'occasion du repas
const OCCASIONS = [
  { id: 'romantique', label: '💕 Romantique' },
  { id: 'amis_famille', label: '👨‍👩‍👧 Amis / Famille' },
  { id: 'travail', label: '💼 Travail' }
];

// Petit composant réutilisable : 5 étoiles = une note sur 10 (par pas de 2)
function LigneEtoiles({ label, valeur, onChange }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#2B2420' }}>{label}</span>
        {valeur > 0 && <span style={{ fontSize: '12px', fontWeight: '800', color: '#B8863C' }}>{valeur}/10</span>}
      </div>
      <div style={{ display: 'flex', gap: '4px' }}>
        {[1, 2, 3, 4, 5].map((etoile) => (
          <span
            key={etoile}
            onClick={() => onChange(valeur === etoile * 2 ? 0 : etoile * 2)}
            style={{ cursor: 'pointer', fontSize: '22px', lineHeight: 1, color: etoile * 2 <= valeur ? '#B8863C' : '#E8DFCF' }}
          >
            ★
          </span>
        ))}
      </div>
    </div>
  );
}

export function MesRestos({ utilisateur, monNom, onClose }) {
  const [restos, setRestos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [recherche, setRecherche] = useState('');

  const [nom, setNom] = useState('');
  const [codePays, setCodePays] = useState('');
  const [ville, setVille] = useState('');
  const [occasion, setOccasion] = useState('');
  const [typeCuisine, setTypeCuisine] = useState('');
  const [statut, setStatut] = useState('teste'); // 'teste' ou 'envie'
  const [noteNourriture, setNoteNourriture] = useState(0);
  const [noteAmbiance, setNoteAmbiance] = useState(0);
  const [noteService, setNoteService] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [erreurEnregistrement, setErreurEnregistrement] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [idEnEdition, setIdEnEdition] = useState(null); // pour passer une "envie" en "testé"

  const [partages, setPartages] = useState([]);
  const [showPartage, setShowPartage] = useState(false);
  const [emailPartage, setEmailPartage] = useState('');

  const monEmail = utilisateur?.email;

  // Chargement du carnet resto : mes entrées + celles partagées avec moi
  useEffect(() => {
    if (!utilisateur?.uid) return;
    const propres = new Map();
    const partagees = new Map();

    const publier = () => {
      const fusion = new Map([...propres, ...partagees]);
      setRestos(Array.from(fusion.values()).sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0)));
    };

    const qProprio = query(collection(db, 'restos'), where('proprietaireId', '==', utilisateur.uid));
    const unsub1 = onSnapshot(qProprio, (snap) => {
      propres.clear();
      snap.forEach((d) => propres.set(d.id, { id: d.id, ...d.data() }));
      publier();
    });

    let unsub2 = () => {};
    if (monEmail) {
      const qPartage = query(collection(db, 'restos'), where('emailsAutorises', 'array-contains', monEmail));
      unsub2 = onSnapshot(qPartage, (snap) => {
        partagees.clear();
        snap.forEach((d) => partagees.set(d.id, { id: d.id, ...d.data() }));
        publier();
      });
    }

    return () => { unsub1(); unsub2(); };
  }, [utilisateur?.uid, monEmail]);

  // Chargement des personnes avec qui on partage automatiquement ce carnet
  useEffect(() => {
    if (!utilisateur?.uid) return;
    getDoc(doc(db, 'parametres', utilisateur.uid)).then((snap) => {
      if (snap.exists()) setPartages(snap.data().partageRestosAvec || []);
    });
  }, [utilisateur?.uid]);

  const ajouterPartage = async () => {
    const email = emailPartage.trim().toLowerCase();
    if (!email) return;
    await setDoc(doc(db, 'parametres', utilisateur.uid), { partageRestosAvec: arrayUnion(email) }, { merge: true });
    setPartages((prev) => [...new Set([...prev, email])]);
    setEmailPartage('');
  };

  const retirerPartage = async (email) => {
    await setDoc(doc(db, 'parametres', utilisateur.uid), { partageRestosAvec: arrayRemove(email) }, { merge: true });
    setPartages((prev) => prev.filter((e) => e !== email));
  };

  const resetForm = () => {
    setNom(''); setCodePays(''); setVille(''); setOccasion(''); setTypeCuisine(''); setStatut('teste');
    setNoteNourriture(0); setNoteAmbiance(0); setNoteService(0); setCommentaire('');
    setErreurEnregistrement(''); setPhotoUrl(''); setIdEnEdition(null);
    setShowForm(false);
  };

  const commencerConversionEnvie = (r) => {
    setNom(r.nom); setCodePays(PAYS.find((p) => p.nom === r.pays)?.code || ''); setVille(r.ville || '');
    setOccasion(r.occasion || ''); setTypeCuisine(r.typeCuisine || ''); setStatut('teste');
    setNoteNourriture(0); setNoteAmbiance(0); setNoteService(0); setCommentaire(r.commentaire || '');
    setPhotoUrl(r.photoUrl || ''); setIdEnEdition(r.id);
    setShowForm(true);
  };

  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);
  const moyenneEnCours = (() => {
    const notes = [noteNourriture, noteAmbiance, noteService].filter((n) => n > 0);
    return notes.length > 0 ? notes.reduce((a, b) => a + b, 0) / notes.length : 0;
  })();

  // Photo du plat — envoyée sur Firebase Storage (même principe que les
  // documents PDF dans Planning)
  const handleUploadPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (fichier.size > 8 * 1024 * 1024) {
      setErreurEnregistrement('Photo trop lourde (max 8 Mo).');
      return;
    }
    setUploadEnCours(true);
    try {
      const chemin = `restos/${utilisateur.uid}/${Date.now()}_${fichier.name}`;
      const storageRef = ref(storage, chemin);
      await uploadBytes(storageRef, fichier);
      const url = await getDownloadURL(storageRef);
      setPhotoUrl(url);
    } catch (error) {
      console.warn("Échec de l'envoi de la photo.", error);
      setErreurEnregistrement("Échec de l'envoi de la photo. Réessaie.");
    } finally {
      setUploadEnCours(false);
    }
  };

  // Géolocalise ville+pays (gratuit, sans clé) pour pouvoir l'afficher sur
  // la Carte du monde du carnet. Best-effort : si ça échoue, le resto est
  // simplement absent de la carte, tout le reste continue de fonctionner.
  const chercherCoordonnees = async (villeTexte, paysNom) => {
    if (!villeTexte && !paysNom) return { lat: null, lon: null };
    try {
      const requete = [villeTexte, paysNom].filter(Boolean).join(', ');
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(requete)}&limit=1`);
      if (!res.ok) throw new Error(`Statut ${res.status}`);
      const data = await res.json();
      if (data?.[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
      return { lat: null, lon: null };
    } catch (error) {
      console.warn('Coordonnées introuvables.', error);
      return { lat: null, lon: null };
    }
  };

  const ajouterResto = async (e) => {
    e.preventDefault();
    if (!nom.trim()) return;

    const paysChoisi = trouverPays(codePays);
    const estEnvie = statut === 'envie';

    setEnregistrementEnCours(true);
    setErreurEnregistrement('');
    try {
      const { lat, lon } = estEnvie ? { lat: null, lon: null } : await chercherCoordonnees(ville, paysChoisi?.nom);

      const payload = {
        nom: nom.trim(),
        ville: ville.trim() || null,
        pays: paysChoisi?.nom || null,
        continent: paysChoisi?.continent || null,
        occasion: occasion || null,
        typeCuisine: typeCuisine || null,
        statut,
        photoUrl: photoUrl || null,
        lat, lon,
        noteNourriture: estEnvie ? 0 : noteNourriture,
        noteAmbiance: estEnvie ? 0 : noteAmbiance,
        noteService: estEnvie ? 0 : noteService,
        moyenne: estEnvie ? 0 : moyenneEnCours,
        commentaire: commentaire.trim() || null,
        ajouteParNom: monNom
      };

      if (idEnEdition) {
        await updateDoc(doc(db, 'restos', idEnEdition), payload);
      } else {
        await addDoc(collection(db, 'restos'), {
          ...payload,
          proprietaireId: utilisateur.uid,
          emailsAutorises: [monEmail, ...partages].filter(Boolean),
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error) {
      console.error("Erreur d'ajout :", error);
      setErreurEnregistrement(
        error.code === 'permission-denied'
          ? "Accès refusé par Firestore — vérifie que les règles de sécurité autorisent la collection 'restos'."
          : "Échec de l'enregistrement. Réessaie."
      );
    } finally {
      setEnregistrementEnCours(false);
    }
  };

  const supprimerResto = async (r) => {
    if (window.confirm('Supprimer ce resto de ton carnet ?')) {
      await deleteDoc(doc(db, 'restos', r.id));
      if (r.photoUrl) {
        try { await deleteObject(ref(storage, r.photoUrl)); } catch (error) { /* pas grave */ }
      }
    }
  };

  const restosFiltres = restos.filter((r) => {
    const texte = `${r.nom} ${r.ville || ''} ${r.pays || ''}`.toLowerCase();
    return texte.includes(recherche.toLowerCase()) && (r.statut || 'teste') === 'teste';
  });

  const envies = restos.filter((r) => r.statut === 'envie').filter((r) => {
    const texte = `${r.nom} ${r.ville || ''} ${r.pays || ''}`.toLowerCase();
    return texte.includes(recherche.toLowerCase());
  });

  // Regroupement Continent → Pays, chaque groupe trié par note décroissante.
  // Les entrées sans pays détecté (ancien resto, géolocalisation ratée...)
  // atterrissent dans "Non classé" plutôt que de disparaître.
  const groupes = {};
  restosFiltres.forEach((r) => {
    const continent = r.continent || 'Non classé';
    const pays = r.pays || 'Non classé';
    if (!groupes[continent]) groupes[continent] = {};
    if (!groupes[continent][pays]) groupes[continent][pays] = [];
    groupes[continent][pays].push(r);
  });
  const continentsTries = Object.keys(groupes).sort((a, b) => {
    if (a === 'Non classé') return 1;
    if (b === 'Non classé') return -1;
    return a.localeCompare(b);
  });

  // --- Classement (vue "top to bottom", filtrable par continent) ---
  const [vueMode, setVueMode] = useState('regions'); // 'regions' | 'classement' | 'envies' | 'carte'
  const [filtreContinent, setFiltreContinent] = useState('');
  const continentsDisponibles = [...new Set(restosFiltres.map((r) => r.continent).filter(Boolean))].sort();

  const classement = [...restosFiltres]
    .filter((r) => !filtreContinent || r.continent === filtreContinent)
    .sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0));

  const MEDAILLES = ['🥇', '🥈', '🥉'];

  const restosAvecCoordonnees = restosFiltres.filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number');

  // --- Carte du monde (Leaflet, même principe que la Carte des voyages) ---
  const carteConteneurRef = useRef(null);
  const carteInstanceRef = useRef(null);

  useEffect(() => {
    if (vueMode !== 'carte' || !carteConteneurRef.current) return;

    if (!carteInstanceRef.current) {
      carteInstanceRef.current = L.map(carteConteneurRef.current, { zoomControl: true });
    }
    const carte = carteInstanceRef.current;
    carte.eachLayer((layer) => carte.removeLayer(layer));

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19
    }).addTo(carte);

    if (restosAvecCoordonnees.length > 0) {
      restosAvecCoordonnees.forEach((r) => {
        const icone = L.divIcon({
          html: `<div style="background:#B8863C;color:#FFF;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🍽️</div>`,
          className: '', iconSize: [30, 30], iconAnchor: [15, 15]
        });
        L.marker([r.lat, r.lon], { icon: icone }).addTo(carte)
          .bindPopup(`<strong>${r.nom}</strong><br/>${[r.ville, r.pays].filter(Boolean).join(', ')}<br/>⭐ ${r.moyenne?.toFixed(1) || '—'}/10`);
      });
      const latlngs = restosAvecCoordonnees.map((r) => [r.lat, r.lon]);
      if (latlngs.length === 1) carte.setView(latlngs[0], 11);
      else carte.fitBounds(latlngs, { padding: [30, 30] });
    } else {
      carte.setView([20, 0], 2);
    }
  }, [vueMode, restosAvecCoordonnees.length, JSON.stringify(restosAvecCoordonnees.map((r) => r.id))]);

  useEffect(() => {
    return () => {
      if (carteInstanceRef.current) { carteInstanceRef.current.remove(); carteInstanceRef.current = null; }
    };
  }, []);

  // --- Partage en texte simple (copiable/collable dans Notes iOS, WhatsApp...) ---
  const [messagePartage, setMessagePartage] = useState('');

  const genererTexteClassement = () => {
    const liste = filtreContinent
      ? classement
      : [...restosFiltres].sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0));

    let texte = `🍽️ PAPILLES NOMADES${filtreContinent ? ` — ${filtreContinent}` : ''}\n\n`;
    liste.forEach((r, i) => {
      const lieuTexte = [r.ville, r.pays].filter(Boolean).join(', ');
      const cuisineTexte = trouverCuisine(r.typeCuisine)?.label || '';
      texte += `${i + 1}. ${r.nom}${lieuTexte ? ` (${lieuTexte})` : ''}${cuisineTexte ? ` · ${cuisineTexte}` : ''} — ${r.moyenne?.toFixed(1) || '—'}/10\n`;
    });
    return texte;
  };

  const partagerClassement = async () => {
    const texte = genererTexteClassement();
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Papilles Nomades', text: texte });
        return;
      } catch (error) {
        // L'utilisateur a peut-être juste annulé le partage — pas une vraie erreur
      }
    }
    try {
      await navigator.clipboard.writeText(texte);
      setMessagePartage('Copié ! Colle-le où tu veux (Notes, WhatsApp...)');
      setTimeout(() => setMessagePartage(''), 2500);
    } catch (error) {
      console.warn('Copie impossible.', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: 'inherit', paddingBottom: '30px' }}>
      <div style={{ padding: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <button onClick={onClose} style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconArrowLeft size={18} color="#2B2420" />
          </button>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif", flex: 1 }}>Mes Restos</h2>
          <button
            onClick={partagerClassement}
            title="Partager le classement"
            style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconShare size={17} color="#2B2420" />
          </button>
          <button
            onClick={() => setShowPartage(!showPartage)}
            title="Partager mon carnet"
            style={{ border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', borderRadius: '12px', width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconUsers size={18} color="#2B2420" />
          </button>
        </div>

        {messagePartage && (
          <div style={{ backgroundColor: '#ECFDF5', color: '#047857', padding: '10px 14px', borderRadius: '12px', fontSize: '12.5px', fontWeight: '600', marginBottom: '14px', textAlign: 'center' }}>
            {messagePartage}
          </div>
        )}

        {showPartage && (
          <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E8DFCF', padding: '16px', marginBottom: '18px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: '#2B2420' }}>Partagé automatiquement avec</p>
            {partages.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {partages.map((email) => (
                  <div key={email} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', backgroundColor: '#F7F1E8', borderRadius: '10px' }}>
                    <span style={{ flex: 1, fontSize: '13px', color: '#2B2420' }}>{email}</span>
                    <button onClick={() => retirerPartage(email)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '2px' }}><IconX size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="email"
                placeholder="email@exemple.com"
                value={emailPartage}
                onChange={(e) => setEmailPartage(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '13px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <button onClick={ajouterPartage} style={{ flexShrink: 0, width: '38px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <IconPlus size={16} />
              </button>
            </div>
            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#8A7B68' }}>
              S'applique aux nouveaux restos ajoutés à partir de maintenant.
            </p>
          </div>
        )}

        {!showForm && (
          <>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', backgroundColor: '#F1E8D8', borderRadius: '14px', padding: '4px', overflowX: 'auto' }}>
              {[
                { id: 'regions', label: '🌍 Régions' },
                { id: 'classement', label: '🏆 Classement' },
                { id: 'envies', label: '💭 Envies' },
                { id: 'carte', label: '🗺️ Carte' }
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVueMode(v.id)}
                  style={{ flex: '1 0 auto', padding: '9px 12px', borderRadius: '11px', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: '700', fontFamily: 'inherit', whiteSpace: 'nowrap', backgroundColor: vueMode === v.id ? '#FFFFFF' : 'transparent', color: vueMode === v.id ? '#2B2420' : '#8A7B68' }}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {vueMode !== 'carte' && (
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <IconSearch size={16} color="#B5A793" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Chercher un resto ou une ville..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  style={{ width: '100%', padding: '12px 12px 12px 38px', borderRadius: '14px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            )}
            <button
              onClick={() => { setStatut(vueMode === 'envies' ? 'envie' : 'teste'); setShowForm(true); }}
              style={{ width: '100%', padding: '14px', backgroundColor: '#B8863C', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '18px' }}
            >
              <IconPlus size={18} /> {vueMode === 'envies' ? 'Ajouter une envie' : 'Ajouter un resto'}
            </button>
          </>
        )}

        {showForm && (
          <form onSubmit={ajouterResto} style={{ backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px solid #E8DFCF', padding: '18px', marginBottom: '18px' }}>
            {/* Statut : déjà testé, ou juste une envie */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', backgroundColor: '#F7F1E8', borderRadius: '12px', padding: '4px' }}>
              <button
                type="button"
                onClick={() => setStatut('teste')}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit', backgroundColor: statut === 'teste' ? '#FFFFFF' : 'transparent', color: statut === 'teste' ? '#2B2420' : '#8A7B68' }}
              >
                ✅ Déjà testé
              </button>
              <button
                type="button"
                onClick={() => setStatut('envie')}
                style={{ flex: 1, padding: '9px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit', backgroundColor: statut === 'envie' ? '#FFFFFF' : 'transparent', color: statut === 'envie' ? '#2B2420' : '#8A7B68' }}
              >
                💭 Envie d'y aller
              </button>
            </div>

            <input
              type="text" placeholder="Nom du resto" value={nom} onChange={(e) => setNom(e.target.value)}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '10px' }}
              required autoFocus
            />

            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <select
                value={codePays}
                onChange={(e) => setCodePays(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: codePays ? '#2B2420' : '#B5A793' }}
              >
                <option value="">Pays...</option>
                {PAYS.map((p) => (
                  <option key={p.code} value={p.code}>{drapeau(p.code)} {p.nom}</option>
                ))}
              </select>
              <input
                type="text" placeholder="Ville" value={ville} onChange={(e) => setVille(e.target.value)}
                style={{ flex: 1, minWidth: 0, padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            <select
              value={typeCuisine}
              onChange={(e) => setTypeCuisine(e.target.value)}
              style={{ width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', backgroundColor: '#FFFFFF', color: typeCuisine ? '#2B2420' : '#B5A793', marginBottom: '16px' }}
            >
              <option value="">Type de cuisine...</option>
              {CUISINES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#8A7B68', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Occasion</p>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
              {OCCASIONS.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOccasion(occasion === o.id ? '' : o.id)}
                  style={{
                    padding: '8px 13px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                    border: occasion === o.id ? '2px solid #B8863C' : '1px solid #E8DFCF',
                    backgroundColor: occasion === o.id ? '#FBF3E3' : '#FFFFFF',
                    color: occasion === o.id ? '#B8863C' : '#64748B'
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {statut === 'teste' && (
              <>
                <LigneEtoiles label="🍽️ Nourriture" valeur={noteNourriture} onChange={setNoteNourriture} />
                <LigneEtoiles label="✨ Ambiance" valeur={noteAmbiance} onChange={setNoteAmbiance} />
                <LigneEtoiles label="🙋 Service" valeur={noteService} onChange={setNoteService} />

                {moyenneEnCours > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#FBF3E3', borderRadius: '12px', marginBottom: '16px', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#8A7B68' }}>Moyenne générale</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '16px', fontWeight: '800', color: '#B8863C' }}>
                      <IconStar size={15} fill="#B8863C" /> {moyenneEnCours.toFixed(1)}/10
                      {moyenneEnCours === 10 && <span title="Coup de cœur">❤️</span>}
                    </span>
                  </div>
                )}

                {/* Photo du plat */}
                <p style={{ margin: '0 0 8px 0', fontSize: '11px', color: '#8A7B68', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Photo (optionnel)</p>
                {photoUrl ? (
                  <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden' }}>
                    <img src={photoUrl} alt="Photo du plat" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                    <button type="button" onClick={() => setPhotoUrl('')} style={{ position: 'absolute', top: '8px', right: '8px', border: 'none', backgroundColor: 'rgba(43,36,32,0.6)', color: '#FFF', width: '28px', height: '28px', borderRadius: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <IconX size={14} />
                    </button>
                  </div>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: '1.5px dashed #E8DFCF', color: '#8A7B68', fontSize: '13px', fontWeight: '600', cursor: 'pointer', marginBottom: '16px' }}>
                    <IconCamera size={16} />
                    {uploadEnCours ? 'Envoi en cours...' : 'Ajouter une photo du plat'}
                    <input type="file" accept="image/*" onChange={handleUploadPhoto} style={{ display: 'none' }} disabled={uploadEnCours} />
                  </label>
                )}
              </>
            )}

            <textarea
              placeholder="Petit mot (le plat à refaire, une anecdote...)"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '16px', resize: 'vertical' }}
            />

            {erreurEnregistrement && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '11px 13px', backgroundColor: '#F8EFF2', borderRadius: '12px', marginBottom: '14px' }}>
                <IconAlertTriangle size={15} color="#B3453A" style={{ flexShrink: 0, marginTop: '2px' }} />
                <p style={{ margin: 0, fontSize: '12.5px', color: '#B3453A', lineHeight: '1.4' }}>{erreurEnregistrement}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={resetForm} style={{ flex: 1, padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#F7F1E8', color: '#2B2420', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button type="submit" disabled={enregistrementEnCours} style={{ flex: 2, padding: '13px', borderRadius: '12px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', cursor: enregistrementEnCours ? 'default' : 'pointer', opacity: enregistrementEnCours ? 0.7 : 1, fontFamily: 'inherit' }}>
                {enregistrementEnCours ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}

        {!showForm && vueMode === 'regions' && restosFiltres.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
            <IconToolsKitchen2 size={28} color="#B5A793" style={{ marginBottom: '10px' }} />
            <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>
              {restos.length === 0 ? 'Ton carnet resto est vide — ajoute votre premier restaurant testé !' : 'Aucun résultat pour cette recherche.'}
            </p>
          </div>
        )}

        {!showForm && vueMode === 'regions' && restosFiltres.length > 0 && (
          <div>
            {continentsTries.map((continent) => (
              <div key={continent} style={{ marginBottom: '22px' }}>
                <p style={{ margin: '0 0 10px 2px', fontSize: '13px', fontWeight: '800', color: '#B8863C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  🌍 {continent}
                </p>
                {Object.keys(groupes[continent]).sort((a, b) => {
                  if (a === 'Non classé') return 1;
                  if (b === 'Non classé') return -1;
                  return a.localeCompare(b);
                }).map((pays) => (
                  <div key={pays} style={{ marginBottom: '16px' }}>
                    <p style={{ margin: '0 0 8px 6px', fontSize: '12.5px', fontWeight: '700', color: '#8A7B68' }}>{pays}</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {groupes[continent][pays]
                        .sort((a, b) => (b.moyenne || 0) - (a.moyenne || 0))
                        .map((r) => (
                        <div key={r.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: r.moyenne === 10 ? '1.5px solid #E8A0B0' : '1px solid #E8DFCF', padding: '14px 16px', overflow: 'hidden' }}>
                          {r.photoUrl && (
                            <img src={r.photoUrl} alt={r.nom} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '12px', marginBottom: '12px' }} />
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#2B2420', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                {r.nom} {r.moyenne === 10 && <span title="Coup de cœur">❤️</span>}
                              </p>
                              {(r.ville || r.pays) && (
                                <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#8A7B68' }}>
                                  {[r.ville, r.pays].filter(Boolean).join(', ')}
                                </p>
                              )}
                              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                                {r.typeCuisine && (
                                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#6E8AA6', backgroundColor: '#EEF2F0', padding: '3px 9px', borderRadius: '999px' }}>
                                    {trouverCuisine(r.typeCuisine)?.label || r.typeCuisine}
                                  </span>
                                )}
                                {r.occasion && (
                                  <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#8A7B68', backgroundColor: '#F7F1E8', padding: '3px 9px', borderRadius: '999px' }}>
                                    {OCCASIONS.find((o) => o.id === r.occasion)?.label || r.occasion}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#FBF3E3', padding: '4px 10px', borderRadius: '999px' }}>
                                <IconStar size={13} color="#B8863C" fill="#B8863C" />
                                <span style={{ fontSize: '13px', fontWeight: '800', color: '#B8863C' }}>{r.moyenne?.toFixed(1) || '—'}</span>
                              </div>
                              <button onClick={() => supprimerResto(r)} style={{ border: 'none', background: 'none', color: '#D9CDB8', cursor: 'pointer', padding: '2px' }}>
                                <IconTrash size={15} />
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '14px', marginTop: '10px' }}>
                            <span style={{ fontSize: '11px', color: '#8A7B68' }}>🍽️ {r.noteNourriture || 0}/10</span>
                            <span style={{ fontSize: '11px', color: '#8A7B68' }}>✨ {r.noteAmbiance || 0}/10</span>
                            <span style={{ fontSize: '11px', color: '#8A7B68' }}>🙋 {r.noteService || 0}/10</span>
                          </div>

                          {r.commentaire && (
                            <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#2B2420', backgroundColor: '#F7F1E8', padding: '8px 10px', borderRadius: '10px', lineHeight: '1.5' }}>
                              {r.commentaire}
                            </p>
                          )}
                          <p style={{ margin: '8px 0 0 0', fontSize: '10.5px', color: '#D9CDB8' }}>Ajouté par {r.ajouteParNom}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!showForm && vueMode === 'classement' && (
          <div>
            {continentsDisponibles.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '14px', paddingBottom: '2px' }}>
                <button
                  onClick={() => setFiltreContinent('')}
                  style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', border: !filtreContinent ? '2px solid #B8863C' : '1px solid #E8DFCF', backgroundColor: !filtreContinent ? '#FBF3E3' : '#FFFFFF', color: !filtreContinent ? '#B8863C' : '#64748B' }}
                >
                  Tout le monde
                </button>
                {continentsDisponibles.map((c) => (
                  <button
                    key={c}
                    onClick={() => setFiltreContinent(filtreContinent === c ? '' : c)}
                    style={{ flexShrink: 0, padding: '7px 13px', borderRadius: '999px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', border: filtreContinent === c ? '2px solid #B8863C' : '1px solid #E8DFCF', backgroundColor: filtreContinent === c ? '#FBF3E3' : '#FFFFFF', color: filtreContinent === c ? '#B8863C' : '#64748B' }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}

            {classement.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
                <IconTrophy size={28} color="#B5A793" style={{ marginBottom: '10px' }} />
                <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>Rien à classer ici pour l'instant.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {classement.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 15px',
                      backgroundColor: i < 3 ? '#FBF3E3' : '#FFFFFF',
                      border: i < 3 ? '1.5px solid #E8CBA0' : '1px solid #E8DFCF',
                      borderRadius: '16px'
                    }}
                  >
                    <div style={{ width: '30px', textAlign: 'center', fontSize: i < 3 ? '20px' : '14px', fontWeight: '800', color: i < 3 ? undefined : '#B5A793', flexShrink: 0 }}>
                      {MEDAILLES[i] || `#${i + 1}`}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#2B2420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nom}</p>
                      {(r.ville || r.pays) && (
                        <p style={{ margin: '1px 0 0 0', fontSize: '11.5px', color: '#8A7B68' }}>{[r.ville, r.pays].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#FFFFFF', padding: '5px 11px', borderRadius: '999px', flexShrink: 0, border: '1px solid #E8DFCF' }}>
                      <IconStar size={12} color="#B8863C" fill="#B8863C" />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#B8863C' }}>{r.moyenne?.toFixed(1) || '—'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!showForm && vueMode === 'envies' && (
          envies.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px dashed #E8DFCF' }}>
              <p style={{ color: '#8A7B68', fontSize: '13.5px', margin: 0 }}>Aucune envie notée — ajoute une adresse recommandée avant même d'y être allée !</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {envies.map((r) => (
                <div key={r.id} style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #E8DFCF', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '800', color: '#2B2420' }}>{r.nom}</p>
                    {(r.ville || r.pays) && (
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#8A7B68' }}>{[r.ville, r.pays].filter(Boolean).join(', ')}</p>
                    )}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '5px' }}>
                      {r.typeCuisine && (
                        <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#6E8AA6', backgroundColor: '#EEF2F0', padding: '3px 9px', borderRadius: '999px' }}>
                          {trouverCuisine(r.typeCuisine)?.label || r.typeCuisine}
                        </span>
                      )}
                    </div>
                    {r.commentaire && <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#8A7B68' }}>{r.commentaire}</p>}
                  </div>
                  <button
                    onClick={() => commencerConversionEnvie(r)}
                    title="Marquer comme testé"
                    style={{ border: 'none', backgroundColor: '#10B981', color: '#FFF', width: '34px', height: '34px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <IconCheck size={17} />
                  </button>
                  <button onClick={() => supprimerResto(r)} style={{ border: 'none', background: 'none', color: '#D9CDB8', cursor: 'pointer', padding: '4px', flexShrink: 0 }}>
                    <IconTrash size={15} />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {!showForm && vueMode === 'carte' && (
          <div>
            {restosAvecCoordonnees.length === 0 && (
              <div style={{ padding: '16px 18px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #E8DFCF', marginBottom: '12px' }}>
                <IconMapPin size={22} color="#B5A793" style={{ marginBottom: '6px' }} />
                <p style={{ color: '#8A7B68', fontSize: '13px', margin: 0 }}>Aucun resto géolocalisé pour l'instant — ajoutes-en avec une ville renseignée.</p>
              </div>
            )}
            <div ref={carteConteneurRef} style={{ height: '55vh', borderRadius: '18px', overflow: 'hidden', border: '1px solid #E8DFCF' }}></div>
            {restosAvecCoordonnees.length > 0 && (
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#8A7B68', textAlign: 'center' }}>
                {restosAvecCoordonnees.length} resto{restosAvecCoordonnees.length > 1 ? 's' : ''} sur la carte
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
