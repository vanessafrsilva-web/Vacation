import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import jsPDF from 'jspdf';
import {
  IconPlus, IconMapPin, IconClock, IconCoffee, IconBed, IconMusic,
  IconCalendarEvent, IconX, IconTrash, IconPlaneDeparture, IconCar,
  IconInfoCircle, IconCalendarDue, IconPencil, IconPaperclip, IconFileText,
  IconExternalLink, IconDownload, IconChevronDown, IconGasStation, IconWalk
} from '@tabler/icons-react';
import { Carte } from './Carte';
import { Meteo } from './Meteo';
import { enregistrerHistorique } from '../historique';

// Chaque catégorie définit son icône/couleur ET, si besoin, un champ de
// détail spécifique (label + placeholder) affiché uniquement pour elle.
const CATEGORIES = [
  {
    id: 'vol', label: 'Vol', icon: <IconPlaneDeparture size={20} />, color: '#6E8AA6', bg: '#EEF2F0',
    detailLabel: 'Compagnie & n° de vol', detailPlaceholder: 'ex: EasyJet EZY1234', departArrivee: true,
    titrePlaceholder: 'Titre (ex: Vol Genève → Édimbourg)'
  },
  {
    id: 'hotel', label: 'Hébergement', icon: <IconBed size={20} />, color: '#9A6B87', bg: '#F3ECF1',
    dateDepart: true, rechercheAdresse: true,
    titrePlaceholder: 'Titre (ex: Hôtel Ibis Édimbourg)'
  },
  {
    id: 'taxi', label: 'Loisirs / Soirée', icon: <IconMusic size={20} />, color: '#8B5CB8', bg: '#F2ECF8',
    detailLabel: 'Détails', detailPlaceholder: 'ex: Concert, bar, spectacle, réservation...', rechercheAdresse: true, notable: true,
    titrePlaceholder: 'Titre (ex: Soirée au Whisky Bar)'
  },
  {
    id: 'transport', label: 'Transport', icon: <IconCar size={20} />, color: '#5E8A87', bg: '#EEF3F2',
    detailLabel: 'Compagnie / réf. réservation', detailPlaceholder: 'ex: Train ScotRail, résa #12345', rechercheAdresse: true,
    titrePlaceholder: 'Titre (ex: Train Genève → Zurich)'
  },
  {
    id: 'resto', label: 'Resto / Brunch', icon: <IconCoffee size={20} />, color: '#B8863C', bg: '#F1E8D8',
    detailLabel: 'Réservation au nom de', detailPlaceholder: 'ex: Réservé au nom de Vanessa', rechercheAdresse: true, notable: true,
    titrePlaceholder: 'Titre (ex: Brunch chez The Dogs)'
  },
  {
    id: 'visite', label: 'Visite / Activité', icon: <IconMapPin size={20} />, color: '#B97490', bg: '#F8EFF2',
    detailLabel: 'Détails', detailPlaceholder: 'ex: Billets déjà achetés en ligne', rechercheAdresse: true, notable: true,
    titrePlaceholder: 'Titre (ex: Château d\'Édimbourg)'
  },
  {
    id: 'technique', label: 'Ravito & Technique', icon: <IconGasStation size={20} />, color: '#4A7C59', bg: '#EAF2EC',
    detailLabel: 'Détail', detailPlaceholder: 'ex: Vidange eaux grises, plein diesel, recharge gaz', rechercheAdresse: true,
    titrePlaceholder: 'Titre (ex: Plein + vidange eaux à Fort William)'
  },
  {
    id: 'randonnee', label: 'Randonnée / Sport', icon: <IconWalk size={20} />, color: '#3B6EA5', bg: '#EAF1F8',
    detailLabel: 'Détail', detailPlaceholder: 'ex: 12 km, dénivelé 450m, boucle', rechercheAdresse: true, notable: true,
    titrePlaceholder: 'Titre (ex: Rando Ben Nevis)'
  }
];

// Catégorie Budget associée à chaque catégorie Planning, pour que le prix
// renseigné ici alimente automatiquement le total du Bilan / Budget.
const CATEGORIE_BUDGET = {
  vol: 'Essence', hotel: 'Autre', taxi: 'Verres/Resto',
  transport: 'Essence', resto: 'Verres/Resto', visite: 'Activités', technique: 'Essence', randonnee: 'Activités'
};

export const Planning = ({ voyage, currentUserId, currentUserNom }) => {
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
  const formRef = useRef(null);
  const [essaiSoumission, setEssaiSoumission] = useState(false); // devient vrai après une 1ère tentative d'envoi, pour afficher les champs manquants
  const [joursReplies, setJoursReplies] = useState({}); // { '2026-08-01': true } = replié

  // Jeton de session Google Places (New) — regroupe une recherche + sa
  // sélection finale pour que ce soit facturé/compté comme une seule session
  // (l'autocomplete devient gratuit si la session se termine par un choix).
  const [sessionToken, setSessionToken] = useState(() => crypto.randomUUID());

  // Document joint (PDF, image de billet/réservation...) stocké sur Firebase Storage
  const [documentUrl, setDocumentUrl] = useState('');
  const [documentNom, setDocumentNom] = useState('');
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const [erreurUpload, setErreurUpload] = useState('');

  // Recherche d'adresse (hôtel / resto / visite). Priorité à Google Places
  // (New) — bien plus fiable pour retrouver un établissement précis par son
  // nom — avec repli automatique sur OpenStreetMap Nominatim si la clé
  // n'est pas configurée ou si Google échoue.
  const [suggestionsLieu, setSuggestionsLieu] = useState([]);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [suggestionsOuvertes, setSuggestionsOuvertes] = useState(false);
  const [rechercheTerminee, setRechercheTerminee] = useState(false); // pour distinguer "pas encore cherché" de "0 résultat"
  const [erreurRecherche, setErreurRecherche] = useState(false);

  const catActive = CATEGORIES.find((c) => c.id === categorie);
  const cleGooglePlaces = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;

  const rechercherGooglePlaces = async (texte) => {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': cleGooglePlaces },
      body: JSON.stringify({ input: texte, sessionToken })
    });
    if (!res.ok) throw new Error(`Statut ${res.status}`);
    const data = await res.json();
    return (data.suggestions || [])
      .filter((s) => s.placePrediction)
      .map((s) => ({
        source: 'google',
        placeId: s.placePrediction.placeId,
        texte: s.placePrediction.text?.text || ''
      }));
  };

  const rechercherNominatim = async (texte) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(texte)}&addressdetails=1&limit=5`
    );
    if (!res.ok) throw new Error(`Statut ${res.status}`);
    const data = await res.json();
    return data.map((s) => ({
      source: 'nominatim',
      placeId: s.place_id,
      texte: s.display_name,
      lat: parseFloat(s.lat),
      lon: parseFloat(s.lon)
    }));
  };

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
        const resultats = cleGooglePlaces
          ? await rechercherGooglePlaces(lieu)
          : await rechercherNominatim(lieu);
        setSuggestionsLieu(resultats);
        setRechercheTerminee(true);
      } catch (error) {
        console.warn("Recherche d'adresse impossible, tentative de repli.", error);
        // Si Google a échoué (clé mal restreinte, quota, réseau...), on
        // retente une dernière fois avec Nominatim avant d'abandonner.
        try {
          const resultats = cleGooglePlaces ? await rechercherNominatim(lieu) : [];
          setSuggestionsLieu(resultats);
        } catch {
          setSuggestionsLieu([]);
          setErreurRecherche(true);
        }
        setRechercheTerminee(true);
      } finally {
        setRechercheEnCours(false);
      }
    }, 500);
    return () => clearTimeout(minuteur);
  }, [lieu, suggestionsOuvertes, catActive?.rechercheAdresse]);

  const choisirSuggestion = async (s) => {
    setSuggestionsOuvertes(false);
    setSuggestionsLieu([]);

    if (s.source === 'nominatim') {
      setLieu(s.texte);
      setLat(s.lat);
      setLon(s.lon);
      return;
    }

    // Google : il faut un second appel (Place Details) pour obtenir les
    // coordonnées GPS — c'est aussi ce qui termine la session (facturation).
    setLieu(s.texte);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${s.placeId}`, {
        headers: {
          'X-Goog-Api-Key': cleGooglePlaces,
          'X-Goog-FieldMask': 'formattedAddress,location'
        }
      });
      if (!res.ok) throw new Error(`Statut ${res.status}`);
      const data = await res.json();
      if (data.formattedAddress) setLieu(data.formattedAddress);
      if (data.location) {
        setLat(data.location.latitude);
        setLon(data.location.longitude);
      }
    } catch (error) {
      console.warn("Impossible de récupérer les détails du lieu.", error);
    } finally {
      // Nouvelle session pour la prochaine recherche
      setSessionToken(crypto.randomUUID());
    }
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

  const toggleJour = (jour) => {
    setJoursReplies((prev) => ({ ...prev, [jour]: !prev[jour] }));
  };

  // Génère un PDF avec une vraie mise en page (bandeau, cartes colorées,
  // pied de page) plutôt que du texte brut — téléchargé directement dans le
  // navigateur, aucune donnée envoyée à un serveur.
  const COULEUR_CATEGORIE_PDF = {
    vol: [110, 138, 166], hotel: [154, 107, 135], taxi: [245, 158, 11],
    transport: [94, 138, 135], resto: [184, 134, 60], visite: [185, 116, 144]
  };

  const exporterPDF = () => {
    const pdf = new jsPDF();
    const pageW = pdf.internal.pageSize.getWidth();
    const margeGauche = 16;
    const margeDroite = 16;
    const largeurUtile = pageW - margeGauche - margeDroite;
    let y = 0;

    const OR = [184, 134, 60];
    const BRUN = [43, 36, 32];
    const GRIS = [138, 123, 104];
    const CREME = [247, 241, 232];

    const nouvellePage = () => {
      pdf.addPage();
      y = 20;
    };

    // --- Bandeau d'en-tête (uniquement sur la première page) ---
    pdf.setFillColor(...BRUN);
    pdf.rect(0, 0, pageW, 34, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(21);
    pdf.text(voyage.nom || 'Mon itinéraire', margeGauche, 20);

    if (voyage.dateDebut && voyage.dateFin) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(230, 210, 180);
      const periode = `${new Date(voyage.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}  →  ${new Date(voyage.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      pdf.text(periode, margeGauche, 28);
    }

    pdf.setTextColor(0, 0, 0);
    y = 46;

    const joursTries = Object.keys(groups).sort();

    if (joursTries.length === 0) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(...GRIS);
      pdf.text("Aucune activité planifiée pour l'instant.", margeGauche, y);
    }

    joursTries.forEach((jour) => {
      if (y > 265) nouvellePage();

      // Bande dorée du jour
      pdf.setFillColor(...OR);
      pdf.roundedRect(margeGauche, y, largeurUtile, 9, 2, 2, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const titreJour = new Date(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      pdf.text((titreJour.charAt(0).toUpperCase() + titreJour.slice(1)), margeGauche + 4, y + 6.2);
      y += 15;

      const activitesJour = [...groups[jour]].sort((a, b) => (a.heure || '').localeCompare(b.heure || ''));

      activitesJour.forEach((act) => {
        // Calcul de la hauteur de la carte selon le contenu
        let lieuTexte = '';
        if (act.categorie === 'vol' && (act.depart || act.arrivee)) {
          lieuTexte = `${act.depart || '?'} → ${act.arrivee || '?'}`;
        } else if (act.lieu) {
          lieuTexte = act.lieu;
        }
        let hauteur = 12;
        if (lieuTexte) hauteur += 5;
        if (act.detail) hauteur += 5;

        if (y + hauteur > 280) nouvellePage();

        const couleurCat = COULEUR_CATEGORIE_PDF[act.categorie] || GRIS;

        // Fond de carte
        pdf.setFillColor(...CREME);
        pdf.roundedRect(margeGauche, y, largeurUtile, hauteur, 2, 2, 'F');
        // Accent de couleur à gauche
        pdf.setFillColor(...couleurCat);
        pdf.rect(margeGauche, y, 2.2, hauteur, 'F');

        let yTexte = y + 6;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        pdf.setTextColor(...BRUN);
        pdf.text(`${act.heure || '--:--'}`, margeGauche + 6, yTexte);
        pdf.text(act.titre, margeGauche + 24, yTexte);

        if (act.prix != null) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(...OR);
          pdf.text(`${act.prix.toFixed(2)} CHF`, pageW - margeDroite - 4, yTexte, { align: 'right' });
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(...GRIS);

        if (lieuTexte) { yTexte += 5; pdf.text(lieuTexte, margeGauche + 24, yTexte); }
        if (act.detail) { yTexte += 5; pdf.text(act.detail, margeGauche + 24, yTexte); }

        pdf.setTextColor(0, 0, 0);
        y += hauteur + 4;
      });

      y += 5;
    });

    // --- Pied de page sur toutes les pages ---
    const nbPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= nbPages; i++) {
      pdf.setPage(i);
      const pageH = pdf.internal.pageSize.getHeight();
      pdf.setDrawColor(...OR);
      pdf.setLineWidth(0.3);
      pdf.line(margeGauche, pageH - 14, pageW - margeDroite, pageH - 14);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...GRIS);
      pdf.text('Les Nomades by Vanessa', margeGauche, pageH - 9);
      pdf.text(`Page ${i} / ${nbPages}`, pageW - margeDroite, pageH - 9, { align: 'right' });
    }

    const nomFichier = `Itineraire_${(voyage.nom || 'voyage').replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
    pdf.save(nomFichier);
  };

  const resetForm = () => {
    setTitre(''); setDate(''); setHeure(''); setLieu(''); setDepart(''); setArrivee('');
    setCategorie('visite'); setDetail(''); setDateDepart(''); setPrix('');
    setLat(null); setLon(null);
    setDocumentUrl(''); setDocumentNom(''); setErreurUpload('');
    setIdEnEdition(null);
    setSuggestionsOuvertes(false); setSuggestionsLieu([]);
    setEssaiSoumission(false);
    setShowForm(false);
  };

  const commencerEdition = (act) => {
    setTitre(act.titre); setDate(act.date); setHeure(act.heure); setLieu(act.lieu || '');
    setDepart(act.depart || ''); setArrivee(act.arrivee || '');
    setCategorie(act.categorie); setDetail(act.detail || ''); setDateDepart(act.dateDepart || '');
    setPrix(act.prix ? String(act.prix) : '');
    setLat(act.lat ?? null); setLon(act.lon ?? null);
    setDocumentUrl(act.documentUrl || ''); setDocumentNom(act.documentNom || '');
    setIdEnEdition(act.id);
    setShowForm(true);
    // Le formulaire s'affiche en haut de la liste — sans ça, sur un planning
    // chargé, on ne voit pas qu'il y a quoi que ce soit à modifier et on
    // doit remonter la page à la main.
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Envoie un PDF/image (billet, réservation, visa...) sur Firebase Storage
  // et enregistre son lien de téléchargement sur l'activité.
  const handleUploadDocument = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    if (fichier.size > 10 * 1024 * 1024) {
      setErreurUpload('Fichier trop lourd (max 10 Mo).');
      return;
    }

    setUploadEnCours(true);
    setErreurUpload('');
    try {
      const chemin = `voyages/${voyage.id}/documents/${Date.now()}_${fichier.name}`;
      const storageRef = ref(storage, chemin);
      await uploadBytes(storageRef, fichier);
      const url = await getDownloadURL(storageRef);
      setDocumentUrl(url);
      setDocumentNom(fichier.name);
    } catch (error) {
      console.warn("Échec de l'envoi du document.", error);
      setErreurUpload("Échec de l'envoi. Réessaie, ou vérifie que Firebase Storage est bien activé.");
    } finally {
      setUploadEnCours(false);
    }
  };

  const retirerDocument = () => {
    setDocumentUrl('');
    setDocumentNom('');
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
    setEssaiSoumission(true);
    if (!titre.trim() || !date || !heure) return; // les champs manquants sont maintenant surlignés en rouge ci-dessus
    const payload = {
      titre, date, heure, categorie,
      lieu: catActive?.departArrivee ? '' : lieu,
      depart: catActive?.departArrivee ? depart : null,
      arrivee: catActive?.departArrivee ? arrivee : null,
      detail: detail || null,
      dateDepart: (catActive?.dateDepart && dateDepart) ? dateDepart : null,
      prix: prix ? parseFloat(prix) : null,
      lat: catActive?.departArrivee ? null : lat,
      lon: catActive?.departArrivee ? null : lon,
      documentUrl: documentUrl || null,
      documentNom: documentNom || null
    };

    let idActivite = idEnEdition;
    if (idEnEdition) {
      await updateDoc(doc(db, `voyages/${voyage.id}/activites`, idEnEdition), payload);
      enregistrerHistorique(voyage.id, `a modifié « ${titre} » dans le Planning`, currentUserNom);
    } else {
      const docRef = await addDoc(collection(db, `voyages/${voyage.id}/activites`), payload);
      idActivite = docRef.id;
      enregistrerHistorique(voyage.id, `a ajouté « ${titre} » au Planning`, currentUserNom);
    }

    await synchroniserBudget(idActivite, titre, prix, categorie);
    resetForm();
  };

  const handleDeleteActivite = async (act) => {
    if (window.confirm(`Supprimer « ${act.titre} » du planning ?`)) {
      await deleteDoc(doc(db, `voyages/${voyage.id}/activites`, act.id));
      enregistrerHistorique(voyage.id, `a supprimé « ${act.titre} » du Planning`, currentUserNom);
      // Retire aussi la dépense Budget liée, si elle existe
      const q = query(collection(db, 'budget'), where('voyageId', '==', voyage.id), where('activiteId', '==', act.id));
      const snapshot = await getDocs(q);
      snapshot.forEach((d) => deleteDoc(doc(db, 'budget', d.id)));
      // Retire aussi le document Storage lié, si il existe
      if (act.documentUrl) {
        try {
          await deleteObject(ref(storage, act.documentUrl));
        } catch (error) {
          console.warn("Impossible de supprimer le document associé.", error);
        }
      }
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: '700', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>Planning</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          {activites.length > 0 && (
            <button onClick={exporterPDF} title="Exporter en PDF" style={{ backgroundColor: '#FFFFFF', color: '#2B2420', border: '1px solid #E8DFCF', padding: '10px 12px', borderRadius: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <IconDownload size={18} />
            </button>
          )}
          <button
            onClick={() => {
              if (showForm) {
                resetForm();
              } else {
                setShowForm(true);
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
              }
            }}
            style={{ backgroundColor: '#B8863C', color: '#FFF', border: 'none', padding: '10px 16px', borderRadius: '16px', fontWeight: '700', cursor: 'pointer' }}
          >
            {showForm ? <IconX size={18} /> : <IconPlus size={18} />}
          </button>
        </div>
      </div>

      <Meteo voyage={voyage} />

      {/* Recherche rapide — pour trouver un point de vidange ou une laverie
          en route, sans qu'on ait à intégrer les données de sites tiers */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '20px' }}>
        {[
          { label: '🚿 Vidange', mot: 'camping car service point chemical toilet disposal' },
          { label: '🧺 Laverie', mot: 'laundrette launderette' }
        ].map((r) => {
          const zone = (voyage?.isMultiDest && voyage?.destinations?.[0]?.nom) || voyage?.nom || '';
          const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.mot + ' near ' + zone)}`;
          return (
            <a
              key={r.label}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '999px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', color: '#2B2420', fontSize: '12.5px', fontWeight: '700', textDecoration: 'none' }}
            >
              {r.label} <IconExternalLink size={12} color="#B5A793" />
            </a>
          );
        })}
        <a
          href="https://park4night.com/en/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '999px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', color: '#2B2420', fontSize: '12.5px', fontWeight: '700', textDecoration: 'none' }}
        >
          🅿️ Park4Night <IconExternalLink size={12} color="#B5A793" />
        </a>
      </div>

      {showForm && (
        <form ref={formRef} onSubmit={handleAddActivite} style={{ backgroundColor: '#F7F1E8', padding: '20px', borderRadius: '20px', marginBottom: '20px', border: '1px solid #E8DFCF' }}>

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

          <input placeholder={catActive?.titrePlaceholder || 'Titre'} value={titre} onChange={e => setTitre(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '12px', border: `1px solid ${essaiSoumission && !titre.trim() ? '#B3453A' : '#E8DFCF'}`, backgroundColor: '#FFFFFF', boxSizing: 'border-box', fontFamily: 'inherit' }} required />

          <div style={{ marginBottom: '4px' }}>
            <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>
              {catActive?.dateDepart ? 'Arrivée' : 'Date'} <span style={{ color: '#B3453A' }}>*</span>
            </label>
            <div style={{ position: 'relative', marginBottom: '10px' }}>
              <IconCalendarEvent size={16} color="#B5A793" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="date" value={date} min={voyage?.dateDebut} max={voyage?.dateFin} onChange={e => setDate(e.target.value)}
                style={{
                  width: '100%', padding: '12px 12px 12px 36px', borderRadius: '12px',
                  border: `1.5px solid ${essaiSoumission && !date ? '#B3453A' : '#E8DFCF'}`,
                  backgroundColor: '#FFFFFF', boxSizing: 'border-box', fontFamily: 'inherit',
                  colorScheme: 'light', accentColor: '#B8863C'
                }}
                required
              />
            </div>
            <label style={{ fontSize: '11px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px' }}>
              Heure <span style={{ color: '#B3453A' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <IconClock size={16} color="#B5A793" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input
                type="time" value={heure} onChange={e => setHeure(e.target.value)}
                style={{
                  width: '100%', padding: '12px 12px 12px 36px', borderRadius: '12px',
                  border: `1.5px solid ${essaiSoumission && !heure ? '#B3453A' : '#E8DFCF'}`,
                  backgroundColor: '#FFFFFF', boxSizing: 'border-box', fontFamily: 'inherit',
                  colorScheme: 'light', accentColor: '#B8863C'
                }}
                required
              />
            </div>
          </div>
          {essaiSoumission && (!date || !heure) && (
            <p style={{ margin: '6px 0 10px 2px', fontSize: '11.5px', color: '#B3453A', fontWeight: '600' }}>
              Merci d'indiquer une date et une heure.
            </p>
          )}
          {!(essaiSoumission && (!date || !heure)) && <div style={{ marginBottom: '14px' }} />}

          {/* Date de départ, uniquement pour un hébergement (séjour sur plusieurs jours) */}
          {catActive?.dateDepart && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Départ (checkout)</label>
              <input type="date" value={dateDepart} min={date || voyage?.dateDebut} max={voyage?.dateFin} onChange={e => setDateDepart(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          )}

          {catActive?.departArrivee ? (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input placeholder="Départ (Genève)" value={depart} onChange={(e) => setDepart(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              <input placeholder="Arrivée (Édimbourg)" value={arrivee} onChange={(e) => setArrivee(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', boxSizing: 'border-box', fontFamily: 'inherit' }} />
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
                      key={s.placeId}
                      onClick={() => choisirSuggestion(s)}
                      style={{ padding: '10px 12px', fontSize: '13px', color: '#2B2420', cursor: 'pointer', borderBottom: '1px solid #F1E8D8', display: 'flex', alignItems: 'flex-start', gap: '8px' }}
                    >
                      <IconMapPin size={14} color="#B5A793" style={{ flexShrink: 0, marginTop: '2px' }} />
                      <span>{s.texte}</span>
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

          <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', color: '#B5A793', display: 'block', marginBottom: '3px' }}>Document joint (optionnel — billet, réservation, visa...)</label>
            {documentNom ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#F7F1E8', borderRadius: '12px' }}>
                <IconFileText size={18} color="#6E8AA6" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '13px', color: '#2B2420', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{documentNom}</span>
                <button type="button" onClick={retirerDocument} style={{ border: 'none', background: 'none', color: '#B3453A', cursor: 'pointer', padding: '4px', display: 'flex' }}>
                  <IconX size={16} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '12px', border: '1.5px dashed #E8DFCF', color: '#8A7B68', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                <IconPaperclip size={16} />
                {uploadEnCours ? 'Envoi en cours...' : 'Joindre un PDF ou une image'}
                <input type="file" accept="application/pdf,image/*" onChange={handleUploadDocument} style={{ display: 'none' }} disabled={uploadEnCours} />
              </label>
            )}
            {erreurUpload && <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', color: '#B3453A' }}>{erreurUpload}</p>}
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

      {Object.keys(groups).length > 1 && !showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button
            type="button"
            onClick={() => {
              const tousReplies = Object.keys(groups).every((j) => joursReplies[j]);
              const nouvelEtat = {};
              Object.keys(groups).forEach((j) => { nouvelEtat[j] = !tousReplies; });
              setJoursReplies(nouvelEtat);
            }}
            style={{ border: 'none', background: 'none', color: '#B8863C', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', padding: '4px 0' }}
          >
            {Object.keys(groups).every((j) => joursReplies[j]) ? 'Tout déplier' : 'Tout replier'}
          </button>
        </div>
      )}

      {Object.keys(groups).sort().map((day) => {
        const replie = !!joursReplies[day];
        return (
        <div key={day} style={{ marginBottom: '30px' }}>
          <h3
            onClick={() => toggleJour(day)}
            style={{ fontSize: '14px', color: '#8A7B68', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
          >
            <IconCalendarEvent size={16} />
            {new Date(day).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#B5A793', backgroundColor: '#F1E8D8', padding: '1px 8px', borderRadius: '999px' }}>{groups[day].length}</span>
            <IconChevronDown size={16} style={{ marginLeft: 'auto', transform: replie ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease', color: '#B5A793' }} />
          </h3>
          {!replie && (
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
                        <button onClick={() => handleDeleteActivite(act)} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px' }}><IconTrash size={16} /></button>
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
                    {act.documentUrl && (
                      <a
                        href={act.documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '12px', color: '#6E8AA6', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', fontWeight: '700' }}
                      >
                        <IconFileText size={13} /> {act.documentNom || 'Voir le document'}
                      </a>
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
          )}
        </div>
        );
      })}

      {/* Vue d'ensemble du trajet — intégrée ici plutôt que dans un onglet séparé */}
      {activites.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <Carte voyage={voyage} integree />
        </div>
      )}
    </div>
  );
};
