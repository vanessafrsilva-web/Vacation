import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './App.css';
import { BottomNav } from './components/BottomNav';
import { Gestion } from './components/Gestion'; 
import { Bilan } from './components/Bilan';
import { Planning } from './components/Planning';
import { Checklist } from './components/Checklist';
import { Budget } from './components/Budget';
import { db, auth } from './firebase';
import { collection, addDoc, onSnapshot, query, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, fetchSignInMethodsForEmail } from 'firebase/auth';
import emailjs from '@emailjs/browser';
import { Auth } from './components/Auth';
import { Profil } from './components/Profil';
import { IconChevronDown, IconPlus, IconPlaneDeparture, IconTrash, IconMapPin, IconCalendar, IconBriefcase, IconSun, IconHome, IconPhoto, IconArrowRight, IconArrowLeft, IconUsers, IconUserPlus, IconX, IconMail, IconLogout, IconUserCircle } from '@tabler/icons-react';

function App() {
  const [appDemarree, setAppDemarree] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // État de navigation
  const [activeTab, setActiveTab] = useState('gestion'); // On ouvre sur l'aperçu du voyage par défaut
  const [voyages, setVoyages] = useState([]);
  const [voyageActif, setVoyageActif] = useState(''); 
  const [showAddVoyage, setShowAddVoyage] = useState(false);
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // États du formulaire
  const [isMultiDest, setIsMultiDest] = useState(false);
  const [nouveauVoyageNom, setNouveauVoyageNom] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [typeVoyage, setTypeVoyage] = useState('Loisirs');
  const [destinations, setDestinations] = useState([
    { nom: '', dateDebut: '', dateFin: '' }
  ]);

  // Voyageurs / collaborateurs d'un voyage (ajoutés après coup, dans le détail)
  const [voyageursModaleOuverte, setVoyageursModaleOuverte] = useState(false);
  const [modeAjoutVoyageur, setModeAjoutVoyageur] = useState('nom'); // 'nom' | 'email'
  const [nomVoyageurInput, setNomVoyageurInput] = useState('');
  const [emailVoyageurInput, setEmailVoyageurInput] = useState('');
  const [creationEnCours, setCreationEnCours] = useState(false);

  // Session de la personne connectée (Firebase Auth). undefined = en cours de
  // vérification, null = pas connecté, objet = connecté.
  const [utilisateur, setUtilisateur] = useState(undefined);
  const [showProfil, setShowProfil] = useState(false);
  const monNom = utilisateur?.displayName || utilisateur?.email?.split('@')[0] || 'Vous';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUtilisateur(u));
    return () => unsubscribe();
  }, []);

  // Voyageurs ajoutés dès la création du voyage (en plus de vous, Admin par défaut)
  const [voyageursACreer, setVoyageursACreer] = useState([]);
  const [modeAjoutVoyageurCreation, setModeAjoutVoyageurCreation] = useState('nom');
  const [nomVoyageurCreationInput, setNomVoyageurCreationInput] = useState('');
  const [emailVoyageurCreationInput, setEmailVoyageurCreationInput] = useState('');

  // Envoie un vrai email d'invitation via EmailJS (gratuit, sans backend).
  // Si les clés ne sont pas configurées dans .env, on ne bloque rien —
  // la personne est quand même ajoutée, juste sans email.
  const envoyerEmailInvitation = async (emailDestinataire, nomDestinataire, nomVoyage) => {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const cleePublique = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

    if (!serviceId || !templateId || !cleePublique) {
      console.warn("EmailJS n'est pas configuré (.env) — invitation non envoyée par email.");
      return;
    }

    try {
      await emailjs.send(serviceId, templateId, {
        to_email: emailDestinataire,
        to_name: nomDestinataire || emailDestinataire.split('@')[0],
        from_name: monNom,
        trip_name: nomVoyage
      }, { publicKey: cleePublique });
    } catch (error) {
      console.warn("Échec de l'envoi de l'email d'invitation.", error);
    }
  };

  const ajouterVoyageurACreer = async () => {
    const parEmail = modeAjoutVoyageurCreation === 'email';
    const emailPropre = emailVoyageurCreationInput.trim();
    const nomPropre = nomVoyageurCreationInput.trim();
    if (parEmail && !emailPropre) return;
    if (!parEmail && !nomPropre) return;

    let aUnCompte = false;
    if (parEmail) {
      try {
        const methodes = await fetchSignInMethodsForEmail(auth, emailPropre);
        aUnCompte = methodes.length > 0;
      } catch (error) {
        console.warn("Vérification du compte impossible.", error);
      }
    }

    setVoyageursACreer((prev) => [...prev, {
      id: 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      nom: parEmail ? (emailPropre.split('@')[0] || 'Invité') : nomPropre,
      email: parEmail ? emailPropre : null,
      statut: parEmail ? 'invité' : 'ajouté',
      aUnCompte
    }]);
    setNomVoyageurCreationInput('');
    setEmailVoyageurCreationInput('');
  };

  const retirerVoyageurACreer = (id) => {
    setVoyageursACreer((prev) => prev.filter((v) => v.id !== id));
  };

  const handleCommencer = () => {
    setIsAnimating(true);
    setTimeout(() => {
      setAppDemarree(true);
    }, 750);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownRef]);

  // Chargement des VRAIS voyages depuis Firebase — uniquement une fois la
  // connexion confirmée (sinon Firestore refuse l'accès et l'écoute reste
  // bloquée pour le reste de la session, même après connexion).
  useEffect(() => {
    if (!utilisateur) {
      setVoyages([]);
      return;
    }
    const q = query(collection(db, 'voyages'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const voyagesData = [];
        snapshot.forEach((doc) => {
          voyagesData.push({ id: doc.id, ...doc.data() });
        });
        // Tri du plus proche au plus lointain
        voyagesData.sort((a, b) => new Date(a.dateDebut) - new Date(b.dateDebut));
        setVoyages(voyagesData);
      },
      (error) => {
        console.error("Erreur de chargement des voyages :", error);
      }
    );
    return () => unsubscribe();
  }, [utilisateur]);

  const handleAddDestinationField = () => {
    setDestinations([...destinations, { nom: '', dateDebut: '', dateFin: '' }]);
  };

  const handleDestinationChange = (index, field, value) => {
    const newDestinations = [...destinations];
    newDestinations[index][field] = value;
    setDestinations(newDestinations);
  };

  // Cherche une vraie photo (pas une armoirie, un drapeau ou une carte) sur Wikimedia
  // Commons pour un lieu donné. Renvoie null si rien de convaincant n'est trouvé —
  // dans ce cas la carte affichera un joli dégradé plutôt qu'une photo hors-sujet.
  const MOTS_EXCLUS = [
    'map', 'carte', 'plan', 'location', 'situation', 'coat of arms', 'armoiries',
    'blason', 'flag', 'drapeau', 'crest', 'logo', 'seal', 'emblem', 'emblème',
    'outline', 'silhouette', 'diagram', 'schéma', 'chart', 'graph'
  ];

  const titreSuspect = (titre) => {
    const t = titre.toLowerCase();
    return MOTS_EXCLUS.some((mot) => t.includes(mot));
  };

  const chercherPhotoDestination = async (lieu) => {
    if (!lieu || !lieu.trim()) return null;

    try {
      const requete = `${lieu} landscape OR cityscape OR skyline OR scenery -flag -coatofarms -map -carte -logo -blason filetype:bitmap`;
      const rechercheRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srnamespace=6&srsearch=${encodeURIComponent(requete)}&format=json&origin=*&srlimit=12`
      );
      const rechercheData = await rechercheRes.json();
      const resultats = (rechercheData?.query?.search || []).filter((r) => !titreSuspect(r.title));
      const titres = resultats.map((r) => r.title);
      if (titres.length === 0) return null;

      const infosRes = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titres.join('|'))}&prop=imageinfo&iiprop=url|mime|size&iiurlwidth=1200&format=json&origin=*`
      );
      const infosData = await infosRes.json();
      const pages = Object.values(infosData?.query?.pages || {})
        .filter((p) => !titreSuspect(p.title || ''));

      // On préfère une vraie photo (jpeg) au format paysage, de taille correcte
      // (les cartes/schémas générés sont souvent de petite taille ou très plats)
      const candidatIdeal = pages.find((p) => {
        const info = p.imageinfo?.[0];
        return info?.mime === 'image/jpeg' && info.width >= info.height && info.width >= 800;
      });
      if (candidatIdeal) return candidatIdeal.imageinfo[0].thumburl;

      // Sinon, on accepte une vraie photo même en format portrait
      const candidatPhoto = pages.find((p) => p.imageinfo?.[0]?.mime === 'image/jpeg' && p.imageinfo[0].width >= 800);
      if (candidatPhoto) return candidatPhoto.imageinfo[0].thumburl;

      return null;
    } catch (error) {
      console.warn("Recherche de photo impossible.", error);
      return null;
    }
  };

  const handleAddVoyage = async (e) => {
    e.preventDefault();
    if (!nouveauVoyageNom) return;

    let finalDateDebut = dateDebut;
    let finalDateFin = dateFin;

    if (isMultiDest && destinations.length > 0) {
      finalDateDebut = destinations[0].dateDebut || dateDebut;
      finalDateFin = destinations[destinations.length - 1].dateFin || dateFin;
    }

    if (finalDateDebut && finalDateFin && new Date(finalDateFin) < new Date(finalDateDebut)) {
      alert("La date de fin ne peut pas être avant le début !");
      return;
    }

    const MOTS_PARASITES = /\b(vanlife|van life|roadtrip|road trip|voyage|trip|vacances|weekend|week-end|pro|loisirs|séjour|sejour)\b/gi;
    const nettoyerNomLieu = (texte) => texte
      .replace(MOTS_PARASITES, ' ')
      .replace(/[-–—:|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lieuRecherche = nettoyerNomLieu(
      isMultiDest && destinations.length > 0 && destinations[0].nom
        ? destinations[0].nom
        : nouveauVoyageNom
    ) || nouveauVoyageNom;

    setCreationEnCours(true);
    const imageAEnregistrer = await chercherPhotoDestination(lieuRecherche);

    const voyageursInitiaux = [
      { id: utilisateur?.uid || 'admin', nom: monNom, email: utilisateur?.email || null, statut: 'ajouté', role: 'Admin' },
      ...voyageursACreer
    ];

    try {
      const docRef = await addDoc(collection(db, 'voyages'), { 
        nom: nouveauVoyageNom,
        dateDebut: finalDateDebut || '',
        dateFin: finalDateFin || '',
        type: typeVoyage,
        isMultiDest: isMultiDest,
        destinations: isMultiDest ? destinations : [],
        imageBg: imageAEnregistrer || null,
        voyageurs: voyageursInitiaux,
        proprietaireId: utilisateur?.uid || null
      });
      
      setVoyageActif(docRef.id);
      setActiveTab('gestion'); // Ouvre l'aperçu du voyage par défaut

      // Invitations par email pour les voyageurs ajoutés dès la création
      voyageursACreer
        .filter((v) => v.statut === 'invité' && v.email)
        .forEach((v) => envoyerEmailInvitation(v.email, v.nom, nouveauVoyageNom));

      setNouveauVoyageNom(''); setDateDebut(''); setDateFin('');
      setDestinations([{ nom: '', dateDebut: '', dateFin: '' }]);
      setVoyageursACreer([]);
      setShowAddVoyage(false);
    } catch (error) {
      console.error("Erreur lors de l'enregistrement :", error);
    } finally {
      setCreationEnCours(false);
    }
  };

  const handleDeleteVoyage = async (idASupprimer, nomVoyage, event) => {
    event.stopPropagation(); 
    if (window.confirm(`Voulez-vous vraiment supprimer définitivement le voyage "${nomVoyage}" ?`)) {
      try {
        await deleteDoc(doc(db, 'voyages', idASupprimer));
        if (voyageActif === idASupprimer) setVoyageActif('');
        setIsDropdownOpen(false);
      } catch (error) {
        console.error("Erreur de suppression :", error);
      }
    }
  };

  const initiales = (nom) => {
    if (!nom) return '?';
    const mots = nom.trim().split(/\s+/).filter(Boolean);
    if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
    return (mots[0][0] + mots[1][0]).toUpperCase();
  };

  const ajouterVoyageur = async (voyage) => {
    if (!voyage) return;

    const parEmail = modeAjoutVoyageur === 'email';
    const emailPropre = emailVoyageurInput.trim();
    const nomPropre = nomVoyageurInput.trim();

    if (parEmail && !emailPropre) return;
    if (!parEmail && !nomPropre) return;

    let aUnCompte = false;
    if (parEmail) {
      try {
        const methodes = await fetchSignInMethodsForEmail(auth, emailPropre);
        aUnCompte = methodes.length > 0;
      } catch (error) {
        console.warn("Vérification du compte impossible.", error);
      }
    }

    const nouveauVoyageur = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      nom: parEmail ? (emailPropre.split('@')[0] || 'Invité') : nomPropre,
      email: parEmail ? emailPropre : null,
      statut: parEmail ? 'invité' : 'ajouté',
      aUnCompte
    };

    const listeActuelle = voyage.voyageurs || [];

    try {
      await updateDoc(doc(db, 'voyages', voyage.id), {
        voyageurs: [...listeActuelle, nouveauVoyageur]
      });
      if (parEmail) {
        envoyerEmailInvitation(emailPropre, nouveauVoyageur.nom, voyage.nom);
      }
      setNomVoyageurInput('');
      setEmailVoyageurInput('');
    } catch (error) {
      console.error("Erreur lors de l'ajout du voyageur :", error);
    }
  };

  const supprimerVoyageur = async (voyage, idVoyageur) => {
    if (!voyage) return;
    const listeActuelle = voyage.voyageurs || [];
    try {
      await updateDoc(doc(db, 'voyages', voyage.id), {
        voyageurs: listeActuelle.filter((p) => p.id !== idVoyageur)
      });
    } catch (error) {
      console.error("Erreur lors de la suppression du voyageur :", error);
    }
  };

  const voyageActuelObj = voyages.find(v => v.id === voyageActif);

  // Dégradé déterministe (basé sur le nom) utilisé quand aucune photo fiable
  // n'a été trouvée — plus honnête qu'une photo hors-sujet.
  const PALETTES_SECOURS = [
    ['#F59E0B', '#B3453A'],
    ['#6E8AA6', '#9A6B87'],
    ['#B8863C', '#5E8A87'],
    ['#B97490', '#F59E0B'],
    ['#6366F1', '#06B6D4'],
    ['#14B8A6', '#6366F1']
  ];

  const degradeSecours = (nom) => {
    let h = 0;
    for (let i = 0; i < (nom || '').length; i++) {
      h = nom.charCodeAt(i) + ((h << 5) - h);
      h |= 0;
    }
    const [c1, c2] = PALETTES_SECOURS[Math.abs(h) % PALETTES_SECOURS.length];
    return `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  };

  // --- RENDU DU CONTENU CENTRAL ---
  const renderContent = () => {
    // 1. MAIN PAGE : Le Tableau de Bord
    if (!voyageActuelObj) {
      return (
        <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 15px 20px 15px', animation: 'fadeIn 0.3s ease' }}>
          
          {/* En-tête de l'accueil */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <h1 style={{ margin: 0, fontSize: '30px', color: '#2B2420', fontWeight: '700', fontFamily: "'Playfair Display', Georgia, serif" }}>Mes Voyages</h1>
            <button 
              onClick={() => setShowAddVoyage(!showAddVoyage)}
              style={{
                backgroundColor: '#B8863C', color: '#FFF', border: 'none', padding: '10px 18px',
                borderRadius: '25px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 4px 12px rgba(184, 134, 60, 0.25)',
                transition: 'transform 0.2s'
              }}
            >
              <IconPlus size={18} /> {showAddVoyage ? "Fermer" : "Nouveau"}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '19px' }}>
            <span style={{ fontSize: '13px', color: '#8A7B68' }}>{monNom}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button
                onClick={() => setShowProfil(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#8A7B68', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                <IconUserCircle size={14} /> Profil
              </button>
              <button
                onClick={() => signOut(auth)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', color: '#8A7B68', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                <IconLogout size={14} /> Déconnexion
              </button>
            </div>
          </div>

          {/* Formulaire de création (Style Light Premium) */}
          {showAddVoyage && (
            <form onSubmit={handleAddVoyage} style={{ marginBottom: '30px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '24px', border: '1px solid #E8DFCF', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', animation: 'slideDown 0.3s ease-out' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#2B2420', fontSize: '18px', fontWeight: '800' }}>Créer une aventure</h3>
                
                <div style={{ display: 'flex', backgroundColor: '#F7F1E8', padding: '4px', borderRadius: '20px', border: '1px solid #E8DFCF' }}>
                  <button type="button" onClick={() => setIsMultiDest(false)} style={{ border: 'none', background: !isMultiDest ? '#FFFFFF' : 'transparent', color: !isMultiDest ? '#B8863C' : '#8A7B68', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: !isMultiDest ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Simple</button>
                  <button type="button" onClick={() => setIsMultiDest(true)} style={{ border: 'none', background: isMultiDest ? '#FFFFFF' : 'transparent', color: isMultiDest ? '#B8863C' : '#8A7B68', padding: '6px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', boxShadow: isMultiDest ? '0 2px 5px rgba(0,0,0,0.05)' : 'none' }}>Étapes</button>
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Nom du voyage</label>
                <input type="text" placeholder="ex: Roadtrip Highlands" value={nouveauVoyageNom} onChange={e => setNouveauVoyageNom(e.target.value)} style={{ fontFamily: 'inherit', width: '100%', padding: '14px', borderRadius: '14px', border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '15px', outline: 'none', boxSizing: 'border-box', fontWeight: '500' }} required />
              </div>
              
              {!isMultiDest ? (
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Départ</label>
                    <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ fontFamily: 'inherit', width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Retour</label>
                    <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={{ fontFamily: 'inherit', width: '100%', padding: '12px', borderRadius: '14px', border: '1px solid #E8DFCF', backgroundColor: '#F7F1E8', color: '#2B2420', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} required />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#F7F1E8', padding: '16px', borderRadius: '16px', border: '1px solid #E8DFCF' }}>
                  <label style={{ fontSize: '13px', color: '#2B2420', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <IconMapPin size={16} color="#B8863C" /> Itinéraire étape par étape
                  </label>
                  {destinations.map((dest, index) => (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px', borderBottom: index < destinations.length - 1 ? '1px dashed #D9CDB8' : 'none' }}>
                      <input type="text" placeholder={`Étape ${index + 1} (ex: Inverness)`} value={dest.nom} onChange={e => handleDestinationChange(index, 'nom', e.target.value)} style={{ fontFamily: 'inherit', padding: '10px 12px', borderRadius: '10px', border: '1px solid #D9CDB8', fontSize: '14px', outline: 'none', backgroundColor: '#FFF' }} required />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input type="date" value={dest.dateDebut} onChange={e => handleDestinationChange(index, 'dateDebut', e.target.value)} style={{ fontFamily: 'inherit', flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #D9CDB8', fontSize: '12px', backgroundColor: '#FFF' }} required />
                        <input type="date" value={dest.dateFin} onChange={e => handleDestinationChange(index, 'dateFin', e.target.value)} style={{ fontFamily: 'inherit', flex: 1, padding: '8px', borderRadius: '8px', border: '1px solid #D9CDB8', fontSize: '12px', backgroundColor: '#FFF' }} required />
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddDestinationField} style={{ background: 'transparent', border: '1px dashed #B8863C', color: '#B8863C', padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '5px' }}>
                    <IconPlus size={16} /> Ajouter une étape
                  </button>
                </div>
              )}

              <div>
                <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Type de voyage</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" onClick={() => setTypeVoyage('Loisirs')} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: typeVoyage === 'Loisirs' ? '2px solid #B8863C' : '1px solid #E8DFCF', background: typeVoyage === 'Loisirs' ? '#F0FDF4' : '#FFF', color: '#2B2420', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                    <IconSun size={18} color={typeVoyage === 'Loisirs' ? '#B8863C' : '#8A7B68'} /> Loisirs
                  </button>
                  <button type="button" onClick={() => setTypeVoyage('Travail')} style={{ flex: 1, padding: '12px', borderRadius: '14px', border: typeVoyage === 'Travail' ? '2px solid #6E8AA6' : '1px solid #E8DFCF', background: typeVoyage === 'Travail' ? '#EEF2F0' : '#FFF', color: '#2B2420', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.2s' }}>
                    <IconBriefcase size={18} color={typeVoyage === 'Travail' ? '#6E8AA6' : '#8A7B68'} /> Travail
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '10px', marginBottom: '10px' }}>
                <label style={{ fontSize: '13px', color: '#475569', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Voyageurs</label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#FBF3E3', borderRadius: '12px', marginBottom: '10px' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#B8863C', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                    {monNom.slice(0, 2).toUpperCase()}
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420', flex: 1 }}>{monNom}</span>
                  <span style={{ fontSize: '11px', fontWeight: '800', color: '#B8863C', backgroundColor: '#F1E8D8', padding: '3px 9px', borderRadius: '999px' }}>ADMIN</span>
                </div>

                {voyageursACreer.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                    {voyageursACreer.map((v) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', backgroundColor: '#F7F1E8', borderRadius: '12px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: '#2B2420', flex: 1 }}>{v.nom}</span>
                        {v.statut === 'invité' && v.aUnCompte && (
                          <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#B8863C', backgroundColor: '#F1E8D8', padding: '2px 8px', borderRadius: '999px' }}>A déjà un compte</span>
                        )}
                        {v.statut === 'invité' && <IconMail size={13} color="#6E8AA6" />}
                        <button type="button" onClick={() => retirerVoyageurACreer(v.id)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                          <IconX size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', backgroundColor: '#F7F1E8', padding: '4px', borderRadius: '12px', marginBottom: '8px' }}>
                  <button type="button" onClick={() => setModeAjoutVoyageurCreation('nom')} style={{ flex: 1, border: 'none', background: modeAjoutVoyageurCreation === 'nom' ? '#FFFFFF' : 'transparent', color: '#2B2420', padding: '8px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Ajouter un nom
                  </button>
                  <button type="button" onClick={() => setModeAjoutVoyageurCreation('email')} style={{ flex: 1, border: 'none', background: modeAjoutVoyageurCreation === 'email' ? '#FFFFFF' : 'transparent', color: '#2B2420', padding: '8px', borderRadius: '9px', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Inviter par email
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {modeAjoutVoyageurCreation === 'nom' ? (
                    <input type="text" placeholder="ex: Marc" value={nomVoyageurCreationInput} onChange={(e) => setNomVoyageurCreationInput(e.target.value)} style={{ flex: 1, padding: '11px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  ) : (
                    <input type="email" placeholder="marc@exemple.com" value={emailVoyageurCreationInput} onChange={(e) => setEmailVoyageurCreationInput(e.target.value)} style={{ flex: 1, padding: '11px 12px', borderRadius: '10px', border: '1px solid #E8DFCF', fontSize: '14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
                  )}
                  <button type="button" onClick={ajouterVoyageurACreer} style={{ width: '42px', border: 'none', backgroundColor: '#B8863C', color: '#FFF', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <IconPlus size={18} />
                  </button>
                </div>
              </div>
              
              <button type="submit" disabled={creationEnCours} style={{ fontFamily: 'inherit', marginTop: '10px', padding: '16px', borderRadius: '14px', border: 'none', backgroundColor: '#2B2420', color: '#FFF', fontWeight: '800', cursor: creationEnCours ? 'default' : 'pointer', fontSize: '15px', boxShadow: '0 8px 20px rgba(43, 36, 32, 0.2)', transition: 'transform 0.2s', opacity: creationEnCours ? 0.75 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }} onMouseDown={(e) => { if (!creationEnCours) e.currentTarget.style.transform = 'scale(0.98)'; }} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                {creationEnCours && (
                  <span style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#FFFFFF', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                )}
                {creationEnCours ? 'Création de votre voyage...' : "Créer l'itinéraire"}
              </button>
            </form>
          )}

          {/* Liste des vrais voyages depuis la base de données, groupés par statut
              pour éviter qu'une page avec peu de voyages paraisse vide */}
          {voyages.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px dashed #D9CDB8', marginTop: '10px' }}>
              <div style={{ backgroundColor: '#F1E8D8', width: '80px', height: '80px', borderRadius: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <IconPlaneDeparture size={40} color="#B5A793" />
              </div>
              <h3 style={{ color: '#2B2420', margin: '0 0 8px 0', fontSize: '18px', fontWeight: '800' }}>Aucun voyage prévu</h3>
              <p style={{ color: '#8A7B68', margin: '0 0 20px 0', fontSize: '14px', lineHeight: '1.5' }}>Le monde vous attend.<br/>Créez votre première aventure !</p>
              <button onClick={() => setShowAddVoyage(true)} style={{ backgroundColor: '#B8863C', color: '#FFF', border: 'none', padding: '12px 24px', borderRadius: '20px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(16,185,129,0.2)' }}>
                Commencer
              </button>
            </div>
          ) : (
            <>
              {(() => {
                const aujourdHui = new Date().toISOString().slice(0, 10);
                const enCours = voyages.filter(v => v.dateDebut && v.dateFin && v.dateDebut <= aujourdHui && v.dateFin >= aujourdHui);
                const aVenir = voyages.filter(v => !v.dateDebut || v.dateDebut > aujourdHui);
                const passes = voyages.filter(v => v.dateFin && v.dateFin < aujourdHui);

                const carte = (v) => (
                  <div 
                    key={v.id}
                    onClick={() => { setVoyageActif(v.id); setActiveTab('gestion'); }}
                    style={{
                      position: 'relative', height: '200px', borderRadius: '24px', overflow: 'hidden',
                      cursor: 'pointer', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
                      ...(v.imageBg
                        ? { backgroundImage: `url('${v.imageBg}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { background: degradeSecours(v.nom) }),
                      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                      padding: '20px', transition: 'transform 0.2s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    {!v.imageBg && (
                      <IconPlaneDeparture size={100} color="rgba(255,255,255,0.18)" style={{ position: 'absolute', top: '20px', right: '10px', transform: 'rotate(25deg)' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(43, 36, 32, 0.9) 0%, rgba(43, 36, 32, 0.2) 60%, transparent 100%)' }}></div>

                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <span style={{ backgroundColor: '#FFFFFF', color: '#2B2420', padding: '6px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: '800', display: 'inline-block', marginBottom: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                          {v.type === 'Travail' ? '💼 Pro' : '🌴 Loisirs'} • {v.nom}
                        </span>
                        {v.dateDebut && (
                          <div style={{ color: '#F7F1E8', fontSize: '14px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <IconCalendar size={16} color="#B8863C" /> 
                            {new Date(v.dateDebut).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })} - {new Date(v.dateFin).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {(v.voyageurs || []).length > 0 && (
                          <div style={{ display: 'flex' }} title={(v.voyageurs || []).map(p => p.nom).join(', ')}>
                            {(v.voyageurs || []).slice(0, 3).map((p, i) => (
                              <div
                                key={p.id}
                                style={{
                                  width: '26px', height: '26px', borderRadius: '50%',
                                  backgroundColor: p.statut === 'invité' ? '#E4E9E3' : '#FFFFFF',
                                  color: p.statut === 'invité' ? '#5E7A94' : '#2B2420',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: '800',
                                  border: '2px solid rgba(255,255,255,0.9)',
                                  marginLeft: i === 0 ? 0 : '-9px',
                                  boxShadow: '0 2px 5px rgba(0,0,0,0.15)'
                                }}
                              >
                                {initiales(p.nom)}
                              </div>
                            ))}
                            {(v.voyageurs || []).length > 3 && (
                              <div style={{
                                width: '26px', height: '26px', borderRadius: '50%',
                                backgroundColor: 'rgba(15,23,42,0.6)', color: '#FFF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: '800', border: '2px solid rgba(255,255,255,0.9)',
                                marginLeft: '-9px'
                              }}>
                                +{(v.voyageurs || []).length - 3}
                              </div>
                            )}
                          </div>
                        )}

                        <button 
                          onClick={(e) => handleDeleteVoyage(v.id, v.nom, e)}
                          style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(5px)', border: 'none', color: '#FFF', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 0.2s' }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.8)'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'}
                          title="Supprimer ce voyage"
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );

                const section = (titre, emoji, liste) => liste.length > 0 && (
                  <div key={titre} style={{ marginBottom: '28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 4px' }}>
                      <span style={{ fontSize: '13px' }}>{emoji}</span>
                      <h4 style={{ margin: 0, fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#8A7B68' }}>{titre}</h4>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#B5A793', backgroundColor: '#F1E8D8', padding: '1px 8px', borderRadius: '999px' }}>{liste.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {liste.map(carte)}
                    </div>
                  </div>
                );

                return (
                  <>
                    {section('En cours', '🟢', enCours)}
                    {section('Prochains voyages', '🗓️', aVenir)}
                    {section('Voyages passés', '📦', passes)}
                  </>
                );
              })()}

              {voyages.length <= 2 && !showAddVoyage && (
                <div
                  onClick={() => setShowAddVoyage(true)}
                  style={{ padding: '28px 20px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px dashed #D9CDB8', cursor: 'pointer' }}
                >
                  <p style={{ margin: 0, color: '#8A7B68', fontSize: '14px', fontWeight: '600' }}>
                    Encore une idée de voyage en tête ?
                  </p>
                  <p style={{ margin: '4px 0 0 0', color: '#B8863C', fontSize: '14px', fontWeight: '800' }}>
                    + Ajoutez-la maintenant
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    // REDIRECTION VERS LES AUTRES MODULES
    switch (activeTab) {
      case 'planning': return <Planning voyage={voyageActuelObj} currentUserId={utilisateur?.uid} />;
      case 'gestion': return <Gestion voyage={voyageActuelObj} setActiveTab={setActiveTab} />;
      case 'checklist': return <Checklist voyageId={voyageActuelObj.id} voyage={voyageActuelObj} />;
      case 'facturation': return <Budget voyage={voyageActuelObj} />;
      case 'bilan': return <Bilan voyage={voyageActuelObj} setActiveTab={setActiveTab} />;
      default: return <div>Écran introuvable</div>;
    }
  };

  // --- SPLASH SCREEN — NOMADE by Vanessa ---
  if (!appDemarree) {
    return (
      <div
        style={{
          height: '100vh',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#171310',
          opacity: isAnimating ? 0 : 1,
          transition: 'opacity 0.7s ease'
        }}
      >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Caveat:wght@600&family=Inter:wght@400;500;600&display=swap');
        `}</style>

        {/* Photo plein cadre, légère respiration au clic (effet Ken Burns) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?ixlib=rb-4.0.3&auto=format&fit=crop&w=1400&q=80')",
            backgroundSize: 'cover',
            backgroundPosition: 'center 65%',
            filter: 'saturate(0.92) brightness(0.88)',
            transform: isAnimating ? 'scale(1.09)' : 'scale(1)',
            transition: 'transform 1.4s cubic-bezier(0.22, 1, 0.36, 1)'
          }}
        />

        {/* Voile duotone chaud pour unifier photo + typographie */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(23,19,16,0.88) 0%, rgba(37,26,20,0.55) 38%, rgba(23,19,16,0.35) 58%, rgba(20,16,13,0.92) 100%)'
          }}
        />

        {/* Contenu */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 32px',
            textAlign: 'center'
          }}
        >
          {/* Eyebrow avec filets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '26px' }}>
            <span style={{ width: '28px', height: '1px', backgroundColor: 'rgba(250,247,242,0.4)' }} />
            <span
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '4px',
                textTransform: 'uppercase',
                color: 'rgba(250,247,242,0.7)'
              }}
            >
              Carnet de route
            </span>
            <span style={{ width: '28px', height: '1px', backgroundColor: 'rgba(250,247,242,0.4)' }} />
          </div>

          {/* Wordmark */}
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(52px, 13vw, 76px)',
              fontWeight: 700,
              color: '#FAF7F2',
              margin: 0,
              lineHeight: 1,
              letterSpacing: '1px'
            }}
          >
            NOMADE
          </h1>

          {/* Signature */}
          <p
            style={{
              fontFamily: "'Caveat', cursive",
              fontSize: '30px',
              fontWeight: 600,
              color: '#D98E5B',
              margin: '2px 0 0 0',
              transform: 'rotate(-2deg)'
            }}
          >
            by Vanessa
          </p>

          {/* Tagline */}
          <p
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: '15px',
              fontWeight: 400,
              color: 'rgba(250,247,242,0.72)',
              letterSpacing: '0.2px',
              margin: '26px 0 42px 0',
              maxWidth: '280px'
            }}
          >
            Chaque voyage mérite son histoire.
          </p>

          {/* CTA */}
          <button
            onClick={handleCommencer}
            disabled={isAnimating}
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'transparent',
              color: '#FAF7F2',
              border: '1.5px solid rgba(250,247,242,0.5)',
              padding: '15px 34px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: isAnimating ? 'default' : 'pointer',
              transition: 'background-color 0.25s ease, color 0.25s ease, border-color 0.25s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#FAF7F2';
              e.currentTarget.style.color = '#171310';
              e.currentTarget.style.borderColor = '#FAF7F2';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#FAF7F2';
              e.currentTarget.style.borderColor = 'rgba(250,247,242,0.5)';
            }}
          >
            En route
            <IconArrowRight size={16} stroke={2} />
          </button>
        </div>
      </div>
    );
  }

  // --- GARDE D'AUTHENTIFICATION ---
  if (utilisateur === undefined) {
    // Vérification de la session en cours (quasi instantané, mais on évite un flash)
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F7F1E8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ width: '28px', height: '28px', border: '3px solid #E8DFCF', borderTopColor: '#B8863C', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!utilisateur) {
    return <Auth />;
  }

  // --- RENDU GLOBAL (STRUCTURE DE L'APP CLAIRE) ---
  return (
    <div style={{ paddingBottom: '80px', minHeight: '100vh', backgroundColor: '#F7F1E8', fontFamily: "system-ui, -apple-system, sans-serif" }}> 
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      
      {/* Barre de navigation du haut (visible uniquement si un voyage est ouvert) */}
      {voyageActuelObj && (
        <div style={{ padding: 'calc(15px + env(safe-area-inset-top)) 15px 15px 15px', backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, borderBottom: '1px solid #E8DFCF' }}>
          <div style={{ maxWidth: '500px', margin: '0 auto', position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => { setVoyageActif(''); setIsDropdownOpen(false); }}
              aria-label="Retour à Mes Voyages"
              title="Retour à Mes Voyages"
              style={{ flexShrink: 0, width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', color: '#2B2420', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}
            >
              <IconArrowLeft size={20} />
            </button>

            <div style={{ flex: 1, position: 'relative', minWidth: 0 }} ref={dropdownRef}>
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', padding: '12px 18px', borderRadius: '16px', color: '#2B2420', fontSize: '16px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', fontFamily: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <IconPlaneDeparture size={20} color="#B8863C" />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{voyageActuelObj.nom}</span>
              </div>
              <IconChevronDown size={20} color="#B5A793" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
            </button>

            {isDropdownOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E8DFCF', boxShadow: '0 15px 40px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 200, animation: 'slideDown 0.2s ease-out' }}>
                <div 
                  onClick={() => { setVoyageActif(''); setIsDropdownOpen(false); }}
                  style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid #F1E8D8', backgroundColor: '#F0FDF4', color: '#B8863C', fontWeight: '800', fontSize: '15px' }}
                >
                  <IconHome size={18} /> Retour aux voyages
                </div>
                {voyages.filter(v => v.id !== voyageActif).map(v => (
                  <div 
                    key={v.id}
                    onClick={() => { setVoyageActif(v.id); setActiveTab('gestion'); setIsDropdownOpen(false); }}
                    style={{ padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid #F1E8D8' }}
                  >
                    <div>
                      <div style={{ color: '#2B2420', fontWeight: '700', fontSize: '15px' }}>{v.nom}</div>
                      {v.dateDebut && <div style={{ color: '#8A7B68', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>{new Date(v.dateDebut).toLocaleDateString('fr-CH')} - {new Date(v.dateFin).toLocaleDateString('fr-CH')}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Voyageurs / collaborateurs du voyage ouvert */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
              {(voyageActuelObj.voyageurs || []).length > 0 && (
                <div style={{ display: 'flex' }}>
                  {(voyageActuelObj.voyageurs || []).slice(0, 4).map((p, i) => (
                    <div
                      key={p.id}
                      title={p.statut === 'invité' ? `${p.nom} (invité·e)` : p.nom}
                      style={{
                        width: '30px', height: '30px', borderRadius: '50%',
                        backgroundColor: p.statut === 'invité' ? '#EEF2F0' : '#2B2420',
                        color: p.statut === 'invité' ? '#6E8AA6' : '#FFFFFF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: '800',
                        border: '2px solid #FFFFFF',
                        marginLeft: i === 0 ? 0 : '-9px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}
                    >
                      {initiales(p.nom)}
                    </div>
                  ))}
                  {(voyageActuelObj.voyageurs || []).length > 4 && (
                    <div style={{
                      width: '30px', height: '30px', borderRadius: '50%',
                      backgroundColor: '#F1E8D8', color: '#8A7B68',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '800', border: '2px solid #FFFFFF',
                      marginLeft: '-9px'
                    }}>
                      +{(voyageActuelObj.voyageurs || []).length - 4}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setVoyageursModaleOuverte(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  border: '1px dashed #D9CDB8', backgroundColor: 'transparent',
                  color: '#8A7B68', fontSize: '12px', fontWeight: '700',
                  padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit'
                }}
              >
                <IconUserPlus size={14} />
                {(voyageActuelObj.voyageurs || []).length > 0 ? 'Gérer' : 'Ajouter des voyageurs'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup Profil (nom affiché + changement de mot de passe) */}
      {showProfil && utilisateur && (
        <Profil utilisateur={utilisateur} onClose={() => setShowProfil(false)} />
      )}

      {/* Popup de gestion des voyageurs / collaborateurs — rendue via portail
          directement dans <body> pour ne dépendre d'aucun conteneur parent */}
      {voyageursModaleOuverte && voyageActuelObj && createPortal(
        <div
          onClick={() => setVoyageursModaleOuverte(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(43, 36, 32, 0.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 2000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#FFFFFF', borderRadius: '24px 24px 0 0', padding: '22px',
              width: '100%', maxWidth: '460px', maxHeight: '82vh', overflowY: 'auto',
              fontFamily: 'inherit'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#2B2420' }}>
                Voyageurs
              </h3>
              <button
                type="button"
                onClick={() => setVoyageursModaleOuverte(false)}
                aria-label="Fermer"
                style={{ border: 'none', backgroundColor: '#F1E8D8', color: '#8A7B68', width: '32px', height: '32px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <IconX size={16} />
              </button>
            </div>
            <p style={{ margin: '2px 0 16px 0', fontSize: '13px', color: '#8A7B68' }}>
              Qui part avec vous sur « {voyageActuelObj.nom} » ?
            </p>

            {(voyageActuelObj.voyageurs || []).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                {voyageActuelObj.voyageurs.map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: '#F7F1E8', borderRadius: '14px', border: '1px solid #F1E8D8' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: p.statut === 'invité' ? '#EEF2F0' : '#2B2420',
                      color: p.statut === 'invité' ? '#6E8AA6' : '#FFFFFF',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', fontWeight: '800', flexShrink: 0
                    }}>
                      {initiales(p.nom)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#2B2420' }}>{p.nom}</div>
                      <div style={{ fontSize: '12px', color: p.statut === 'invité' ? '#6E8AA6' : '#B5A793', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {p.statut === 'invité' && <IconMail size={12} />}
                        {p.statut === 'invité' ? `Invité·e${p.email ? ' · ' + p.email : ''}` : 'Ajouté·e'}
                        {p.statut === 'invité' && p.aUnCompte && (
                          <span style={{ fontSize: '10px', fontWeight: '800', color: '#B8863C', backgroundColor: '#F1E8D8', padding: '1px 7px', borderRadius: '999px', marginLeft: '2px' }}>Compte existant</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => supprimerVoyageur(voyageActuelObj, p.id)}
                      aria-label={`Retirer ${p.nom}`}
                      style={{ border: 'none', backgroundColor: 'transparent', color: '#B5A793', cursor: 'pointer', padding: '6px' }}
                    >
                      <IconTrash size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', backgroundColor: '#F7F1E8', padding: '4px', borderRadius: '14px', border: '1px solid #E8DFCF', marginBottom: '12px' }}>
              <button type="button" onClick={() => setModeAjoutVoyageur('nom')} style={{ flex: 1, border: 'none', background: modeAjoutVoyageur === 'nom' ? '#FFFFFF' : 'transparent', color: modeAjoutVoyageur === 'nom' ? '#2B2420' : '#8A7B68', padding: '9px', borderRadius: '11px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: modeAjoutVoyageur === 'nom' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none' }}>
                Ajouter un nom
              </button>
              <button type="button" onClick={() => setModeAjoutVoyageur('email')} style={{ flex: 1, border: 'none', background: modeAjoutVoyageur === 'email' ? '#FFFFFF' : 'transparent', color: modeAjoutVoyageur === 'email' ? '#2B2420' : '#8A7B68', padding: '9px', borderRadius: '11px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', boxShadow: modeAjoutVoyageur === 'email' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none' }}>
                Inviter par email
              </button>
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); ajouterVoyageur(voyageActuelObj); }}
              style={{ display: 'flex', gap: '8px' }}
            >
              {modeAjoutVoyageur === 'nom' ? (
                <input
                  type="text"
                  placeholder="ex: Marc"
                  value={nomVoyageurInput}
                  onChange={(e) => setNomVoyageurInput(e.target.value)}
                  style={{ flex: 1, padding: '13px 14px', borderRadius: '13px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                />
              ) : (
                <input
                  type="email"
                  placeholder="marc@exemple.com"
                  value={emailVoyageurInput}
                  onChange={(e) => setEmailVoyageurInput(e.target.value)}
                  style={{ flex: 1, padding: '13px 14px', borderRadius: '13px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '14px', outline: 'none', fontFamily: 'inherit' }}
                />
              )}
              <button
                type="submit"
                style={{ width: '48px', border: 'none', backgroundColor: '#B8863C', color: '#FFFFFF', borderRadius: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                aria-label="Ajouter"
              >
                <IconPlus size={20} />
              </button>
            </form>

            {modeAjoutVoyageur === 'email' && (
              <p style={{ fontSize: '11.5px', color: '#B5A793', margin: '10px 0 0 0', lineHeight: '1.5' }}>
                Un email d'invitation est envoyé à cette adresse. Si la personne n'a pas encore de compte, elle devra en créer un avec ce même email pour que vous vous retrouviez sur le même voyage.
              </p>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Contenu central */}
      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {renderContent()}
      </div>
      
      {/* Barre de navigation du bas (visible uniquement si un voyage est ouvert) */}
      {voyageActuelObj && (
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
      
    </div>
  );
}

export default App;