import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import {
  IconTrash,
  IconCircleCheckFilled,
  IconCircle,
  IconPlus,
  IconClipboardList,
  IconChevronDown,
  IconCalendar,
  IconNote,
  IconSparkles
} from '@tabler/icons-react';

// --- Constantes de configuration -------------------------------------------------

const CATEGORIES = [
  { id: 'documents', label: 'Documents', color: '#6E8AA6', bg: '#EEF2F0' },
  { id: 'vetements', label: 'Vêtements', color: '#9A6B87', bg: '#F3ECF1' },
  { id: 'sante', label: 'Santé', color: '#B3453A', bg: '#FEF2F2' },
  { id: 'transport', label: 'Transport', color: '#F59E0B', bg: '#FBF3E3' },
  { id: 'logement', label: 'Logement', color: '#16C784', bg: '#F1E8D8' },
  { id: 'autre', label: 'Autre', color: '#8A7B68', bg: '#F1E8D8' }
];

const PRIORITES = [
  { id: 'urgent', label: 'Urgent', color: '#B3453A' },
  { id: 'normal', label: 'Normal', color: '#6E8AA6' },
  { id: 'optionnel', label: 'Optionnel', color: '#B5A793' }
];

// Modèles de checklist par type de voyage — sert à pré-remplir une checklist vide
const MODELES = {
  plage: {
    label: 'Plage',
    taches: [
      { nom: 'Passeport / carte d\'identité', categorie: 'documents', priorite: 'urgent' },
      { nom: 'Maillot de bain', categorie: 'vetements', priorite: 'normal' },
      { nom: 'Crème solaire', categorie: 'sante', priorite: 'normal' },
      { nom: 'Billets d\'avion', categorie: 'transport', priorite: 'urgent' },
      { nom: 'Réservation hôtel', categorie: 'logement', priorite: 'urgent' }
    ]
  },
  montagne: {
    label: 'Montagne / randonnée',
    taches: [
      { nom: 'Chaussures de randonnée', categorie: 'vetements', priorite: 'urgent' },
      { nom: 'Trousse de premiers secours', categorie: 'sante', priorite: 'normal' },
      { nom: 'Carte / GPS', categorie: 'documents', priorite: 'normal' },
      { nom: 'Vêtements chauds', categorie: 'vetements', priorite: 'urgent' }
    ]
  },
  citytrip: {
    label: 'City trip',
    taches: [
      { nom: 'Passeport / carte d\'identité', categorie: 'documents', priorite: 'urgent' },
      { nom: 'Visa (si nécessaire)', categorie: 'documents', priorite: 'urgent' },
      { nom: 'Réservation hôtel', categorie: 'logement', priorite: 'urgent' },
      { nom: 'Billets de transport', categorie: 'transport', priorite: 'urgent' },
      { nom: 'Adaptateur de prise', categorie: 'autre', priorite: 'normal' }
    ]
  },
  vanlife: {
    label: 'Vanlife',
    taches: [
      { nom: 'Carte grise / assurance du van', categorie: 'documents', priorite: 'urgent' },
      { nom: 'Permis de conduire', categorie: 'documents', priorite: 'urgent' },
      { nom: 'Bonbonne de gaz', categorie: 'logement', priorite: 'urgent' },
      { nom: 'Batterie externe / panneau solaire', categorie: 'logement', priorite: 'normal' },
      { nom: 'Réservoir d\'eau plein', categorie: 'logement', priorite: 'urgent' },
      { nom: 'Produits d\'entretien (eaux grises/noires)', categorie: 'logement', priorite: 'normal' },
      { nom: 'Lampe frontale / lampe torche', categorie: 'logement', priorite: 'normal' },
      { nom: 'Sacs poubelle & sacs congélation', categorie: 'logement', priorite: 'normal' },
      { nom: 'Pantalon de pluie / coupe-vent', categorie: 'vetements', priorite: 'urgent' },
      { nom: 'Veste imperméable et respirante', categorie: 'vetements', priorite: 'urgent' },
      { nom: 'Chaussures de randonnée imperméables', categorie: 'vetements', priorite: 'urgent' },
      { nom: 'Bonnet et gants chauds', categorie: 'vetements', priorite: 'normal' },
      { nom: 'Couches thermiques (sous-vêtements techniques)', categorie: 'vetements', priorite: 'normal' },
      { nom: 'Chaussettes chaudes de rechange', categorie: 'vetements', priorite: 'normal' },
      { nom: 'Guêtres (pour la boue et l\'herbe humide)', categorie: 'vetements', priorite: 'optionnel' },
      { nom: 'Trousse à outils', categorie: 'transport', priorite: 'normal' },
      { nom: 'Câbles de démarrage / booster de batterie', categorie: 'transport', priorite: 'urgent' },
      { nom: 'Triangle & gilet de sécurité', categorie: 'transport', priorite: 'urgent' },
      { nom: 'Applications d\'aires de camping (Park4Night...)', categorie: 'autre', priorite: 'normal' },
      { nom: 'Carte routière hors-ligne (zones sans réseau)', categorie: 'autre', priorite: 'normal' },
      { nom: 'Anti-moustiques (moucherons écossais !)', categorie: 'sante', priorite: 'normal' },
      { nom: 'Trousse de premiers secours', categorie: 'sante', priorite: 'normal' },
      { nom: 'Crème solaire (même sous la pluie)', categorie: 'sante', priorite: 'optionnel' }
    ]
  }
};

function initiales(nomOuEmail) {
  if (!nomOuEmail) return '?';
  const partie = nomOuEmail.split('@')[0];
  const mots = partie.split(/[.\s_-]+/).filter(Boolean);
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

/**
 * Checklist collaborative liée à un voyage.
 *
 * currentUser: { uid, nom ou email } — la personne connectée, utilisée pour
 *   tracer qui ajoute / coche une tâche.
 *
 * Comme la checklist est déjà stockée par voyageId dans Firestore, elle est
 * automatiquement partagée avec toute personne ayant accès au voyage : pas
 * besoin d'une checklist séparée pour les voyages communs. On affiche
 * simplement l'auteur de chaque tâche pour que ce soit visible.
 */
export function Checklist({ voyageId, voyage, currentUser }) {
  const [taches, setTaches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [nouvelleTache, setNouvelleTache] = useState('');
  const [detailsOuverts, setDetailsOuverts] = useState(false);
  const [categorie, setCategorie] = useState('autre');
  const [priorite, setPriorite] = useState('normal');
  const [echeance, setEcheance] = useState('');
  const [notes, setNotes] = useState('');
  const [assigneA, setAssigneA] = useState('');

  const [filtreCategorie, setFiltreCategorie] = useState('toutes');
  const [menuModeles, setMenuModeles] = useState(false);

  // Popup de prévisualisation d'un modèle : on choisit ce qu'on veut vraiment ajouter
  const [modaleModele, setModaleModele] = useState(null); // clé du modèle ouvert, ou null
  const [selectionModele, setSelectionModele] = useState({}); // index -> bool

  // Mode sélection multiple sur la liste, pour supprimer plusieurs tâches d'un coup
  const [modeSelection, setModeSelection] = useState(false);
  const [selectionnees, setSelectionnees] = useState(new Set());

  const auteurLabel = currentUser?.nom || currentUser?.email || 'Anonyme';

  // Voyageurs du voyage, pour pouvoir assigner une tâche à quelqu'un précis
  const voyageurs = voyage?.voyageurs || [];
  const nomAssigne = (id) => voyageurs.find((v) => v.id === id)?.nom || null;
  const avatarAssigne = (id) => voyageurs.find((v) => v.id === id)?.avatar || null;

  useEffect(() => {
    if (!voyageId) return;

    setLoading(true);

    const q = query(
      collection(db, 'checklist'),
      where('voyageId', '==', voyageId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];

      snapshot.forEach((document) => {
        data.push({
          id: document.id,
          ...document.data()
        });
      });

      data.sort((a, b) => {
        if (a.fait === b.fait) return 0;
        return a.fait ? 1 : -1;
      });

      setTaches(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [voyageId]);

  const ajouterTache = async (nom, extra = {}) => {
    if (!nom.trim() || !voyageId) return;

    try {
      await addDoc(collection(db, 'checklist'), {
        nom: nom.trim(),
        fait: false,
        voyageId,
        categorie: extra.categorie || 'autre',
        priorite: extra.priorite || 'normal',
        echeance: extra.echeance || null,
        notes: extra.notes || '',
        assigneA: extra.assigneA || null,
        auteurId: currentUser?.uid || null,
        auteurNom: auteurLabel,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    await ajouterTache(nouvelleTache, { categorie, priorite, echeance, notes, assigneA });
    setNouvelleTache('');
    setCategorie('autre');
    setPriorite('normal');
    setEcheance('');
    setNotes('');
    setAssigneA('');
    setDetailsOuverts(false);
  };

  // Noms déjà présents dans la checklist, pour éviter les doublons quand on
  // ouvre un modèle plusieurs fois
  const nomsExistants = useMemo(
    () => new Set(taches.map((t) => t.nom.trim().toLowerCase())),
    [taches]
  );

  const ouvrirModele = (cleModele) => {
    const modele = MODELES[cleModele];
    if (!modele) return;
    setMenuModeles(false);

    // Par défaut : coché seulement si la tâche n'existe pas déjà
    const selectionInitiale = {};
    modele.taches.forEach((t, i) => {
      selectionInitiale[i] = !nomsExistants.has(t.nom.trim().toLowerCase());
    });

    setSelectionModele(selectionInitiale);
    setModaleModele(cleModele);
  };

  const validerModele = async () => {
    const modele = MODELES[modaleModele];
    if (!modele) return;

    const aAjouter = modele.taches.filter((_, i) => selectionModele[i]);

    for (const t of aAjouter) {
      await ajouterTache(t.nom, { categorie: t.categorie, priorite: t.priorite });
    }

    setModaleModele(null);
    setSelectionModele({});
  };

  const toutCocherModele = (valeur) => {
    const modele = MODELES[modaleModele];
    if (!modele) return;
    const nouvelle = {};
    modele.taches.forEach((_, i) => { nouvelle[i] = valeur; });
    setSelectionModele(nouvelle);
  };

  // --- Sélection multiple pour suppression groupée ---

  const toggleModeSelection = () => {
    setModeSelection((v) => !v);
    setSelectionnees(new Set());
  };

  const toggleSelection = (id) => {
    setSelectionnees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toutSelectionner = () => {
    if (selectionnees.size === tachesFiltrees.length) {
      setSelectionnees(new Set());
    } else {
      setSelectionnees(new Set(tachesFiltrees.map((t) => t.id)));
    }
  };

  const supprimerSelection = async () => {
    const ids = Array.from(selectionnees);
    await Promise.all(ids.map((id) => deleteDoc(doc(db, 'checklist', id))));
    setSelectionnees(new Set());
    setModeSelection(false);
  };

  const toggleFait = async (tache) => {
    try {
      await updateDoc(doc(db, 'checklist', tache.id), {
        fait: !tache.fait,
        // On garde une trace de qui a coché la tâche en dernier
        coche_par: !tache.fait ? auteurLabel : null
      });
    } catch (error) {
      console.error('Erreur de mise à jour :', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'checklist', id));
    } catch (error) {
      console.error('Erreur de suppression :', error);
    }
  };

  const tachesFiltrees = useMemo(() => {
    if (filtreCategorie === 'toutes') return taches;
    return taches.filter((t) => (t.categorie || 'autre') === filtreCategorie);
  }, [taches, filtreCategorie]);

  const total = taches.length;
  const faites = taches.filter((tache) => tache.fait).length;
  const progression = total === 0 ? 0 : Math.round((faites / total) * 100);

  const getCategorie = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  const getPriorite = (id) => PRIORITES.find((p) => p.id === id) || PRIORITES[1];

  const styles = {
    container: {
      padding: '28px 0',
      maxWidth: '385px',
      margin: '0 auto',
      textAlign: 'left',
      color: '#2B2420'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '18px'
    },
    title: {
      fontSize: '25px',
      fontWeight: 700,
      margin: 0,
      letterSpacing: '0',
      color: '#2B2420',
      fontFamily: "'Playfair Display', Georgia, serif"
    },
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    selectionButton: (actif) => ({
      border: 'none',
      backgroundColor: actif ? '#2B2420' : '#F1E8D8',
      color: actif ? '#FFFFFF' : '#8A7B68',
      fontWeight: 700,
      fontSize: '13px',
      borderRadius: '12px',
      padding: '9px 12px',
      cursor: 'pointer'
    }),
    barreSelection: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#2B2420',
      borderRadius: '14px',
      padding: '10px 14px',
      marginBottom: '14px'
    },
    barreSelectionTexte: {
      color: '#FFFFFF',
      fontSize: '13px',
      fontWeight: 700
    },
    barreSelectionLien: {
      border: 'none',
      background: 'none',
      color: '#93C5FD',
      fontSize: '12.5px',
      fontWeight: 700,
      cursor: 'pointer'
    },
    barreSelectionSupprimer: {
      border: 'none',
      backgroundColor: '#B3453A',
      color: '#FFFFFF',
      fontSize: '12.5px',
      fontWeight: 700,
      cursor: 'pointer',
      borderRadius: '10px',
      padding: '6px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    overlay: {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(43, 36, 32, 0.45)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 2000
    },
    modaleCarte: {
      backgroundColor: '#FFFFFF',
      borderRadius: '20px 20px 0 0',
      padding: '20px',
      width: '100%',
      maxWidth: '420px',
      maxHeight: '80vh',
      overflowY: 'auto'
    },
    modaleHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '4px'
    },
    modaleTitre: {
      fontSize: '17px',
      fontWeight: 800,
      color: '#2B2420',
      margin: 0
    },
    modaleFermer: {
      border: 'none',
      background: '#F1E8D8',
      color: '#8A7B68',
      borderRadius: '10px',
      width: '30px',
      height: '30px',
      cursor: 'pointer',
      fontSize: '15px'
    },
    modaleSousTitre: {
      fontSize: '13px',
      color: '#8A7B68',
      margin: '2px 0 14px 0'
    },
    modaleLigne: {
      display: 'flex',
      alignItems: 'center',
      gap: '11px',
      padding: '10px 6px',
      borderBottom: '1px solid #F1E8D8',
      cursor: 'pointer'
    },
    modaleCheckbox: (coche) => ({
      width: '21px',
      height: '21px',
      borderRadius: '7px',
      border: coche ? 'none' : '2px solid #D9CDB8',
      backgroundColor: coche ? '#16C784' : '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color: '#FFFFFF',
      fontSize: '13px',
      fontWeight: 800
    }),
    modaleLigneTexte: {
      fontSize: '14.5px',
      fontWeight: 600,
      color: '#2B2420'
    },
    modaleDejaLa: {
      fontSize: '11px',
      color: '#B5A793',
      fontStyle: 'italic',
      marginLeft: 'auto'
    },
    modaleActions: {
      display: 'flex',
      gap: '10px',
      marginTop: '16px'
    },
    modaleActionSecondaire: {
      flex: 1,
      border: '1px solid #E8DFCF',
      backgroundColor: '#FFFFFF',
      color: '#8A7B68',
      fontWeight: 700,
      fontSize: '13.5px',
      borderRadius: '13px',
      padding: '12px',
      cursor: 'pointer'
    },
    modaleActionPrincipale: {
      flex: 2,
      border: 'none',
      backgroundColor: '#16C784',
      color: '#FFFFFF',
      fontWeight: 800,
      fontSize: '13.5px',
      borderRadius: '13px',
      padding: '12px',
      cursor: 'pointer'
    },
    modeleButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      border: 'none',
      backgroundColor: '#EEF2F0',
      color: '#6E8AA6',
      fontWeight: 700,
      fontSize: '13px',
      borderRadius: '12px',
      padding: '9px 12px',
      cursor: 'pointer'
    },
    modeleMenu: {
      position: 'relative'
    },
    modeleDropdown: {
      position: 'absolute',
      right: 0,
      top: '46px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8DFCF',
      borderRadius: '14px',
      boxShadow: '0 12px 28px rgba(43, 36, 32, 0.12)',
      overflow: 'hidden',
      zIndex: 10,
      minWidth: '190px'
    },
    modeleItem: {
      padding: '11px 14px',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
      color: '#2B2420',
      borderBottom: '1px solid #F1E8D8'
    },
    progressCard: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8DFCF',
      borderRadius: '18px',
      padding: '16px',
      marginBottom: '16px',
      boxShadow: '0 8px 24px rgba(43, 36, 32, 0.06)'
    },
    progressTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px'
    },
    progressLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontWeight: 800,
      color: '#2B2420',
      fontSize: '15px'
    },
    progressPercent: {
      fontWeight: 800,
      color: progression === 100 ? '#16C784' : '#6E8AA6'
    },
    progressTrack: {
      width: '100%',
      height: '8px',
      backgroundColor: '#EEF2F7',
      borderRadius: '999px',
      overflow: 'hidden'
    },
    progressFill: {
      width: `${progression}%`,
      height: '100%',
      backgroundColor: progression === 100 ? '#16C784' : '#6E8AA6',
      borderRadius: '999px',
      transition: 'width 0.35s ease'
    },
    progressText: {
      margin: '10px 0 0 0',
      fontSize: '13px',
      color: '#8A7B68'
    },
    filtres: {
      display: 'flex',
      gap: '8px',
      overflowX: 'auto',
      paddingBottom: '4px',
      marginBottom: '16px'
    },
    filtreChip: (actif, couleur, bg) => ({
      flexShrink: 0,
      padding: '7px 13px',
      borderRadius: '999px',
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      border: actif ? `1.5px solid ${couleur}` : '1.5px solid #E8DFCF',
      backgroundColor: actif ? bg : '#FFFFFF',
      color: actif ? couleur : '#8A7B68',
      whiteSpace: 'nowrap'
    }),
    form: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8DFCF',
      borderRadius: '16px',
      padding: '12px',
      marginBottom: '18px',
      boxShadow: '0 6px 18px rgba(43, 36, 32, 0.04)'
    },
    formRow: {
      display: 'flex',
      gap: '10px'
    },
    input: {
      flex: 1,
      padding: '13px 15px',
      borderRadius: '14px',
      border: '1px solid #E8DFCF',
      backgroundColor: '#FFFFFF',
      color: '#2B2420',
      fontSize: '15px',
      outline: 'none'
    },
    submitButton: {
      width: '46px',
      borderRadius: '14px',
      border: 'none',
      backgroundColor: '#16C784',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 10px 20px rgba(22, 199, 132, 0.18)',
      flexShrink: 0
    },
    toggleDetails: {
      background: 'none',
      border: 'none',
      color: '#6E8AA6',
      fontSize: '13px',
      fontWeight: 700,
      cursor: 'pointer',
      padding: '10px 2px 2px',
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    detailsPanel: {
      marginTop: '10px',
      paddingTop: '12px',
      borderTop: '1px solid #F1E8D8',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    selectRow: {
      display: 'flex',
      gap: '8px'
    },
    select: {
      flex: 1,
      padding: '10px 10px',
      borderRadius: '12px',
      border: '1px solid #E8DFCF',
      fontSize: '13px',
      fontWeight: 600,
      color: '#2B2420',
      backgroundColor: '#FFFFFF'
    },
    smallInput: {
      padding: '10px 12px',
      borderRadius: '12px',
      border: '1px solid #E8DFCF',
      fontSize: '13px',
      color: '#2B2420',
      backgroundColor: '#FFFFFF',
      outline: 'none'
    },
    list: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    emptyCard: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8DFCF',
      borderRadius: '18px',
      padding: '24px',
      textAlign: 'center',
      color: '#B5A793',
      fontStyle: 'italic',
      boxShadow: '0 8px 24px rgba(43, 36, 32, 0.05)'
    },
    item: {
      backgroundColor: '#FFFFFF',
      border: '1px solid #E8DFCF',
      borderRadius: '18px',
      padding: '15px',
      boxShadow: '0 8px 24px rgba(43, 36, 32, 0.06)'
    },
    itemTop: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    },
    itemLeft: {
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      flex: 1,
      minWidth: 0
    },
    iconBox: (bg) => ({
      width: '38px',
      height: '38px',
      borderRadius: '13px',
      backgroundColor: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '13px',
      flexShrink: 0
    }),
    itemNameWrap: {
      minWidth: 0
    },
    itemName: {
      fontSize: '15px',
      fontWeight: 700,
      color: '#2B2420',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      display: 'block'
    },
    itemNameDone: {
      color: '#B5A793',
      textDecoration: 'line-through'
    },
    itemMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginTop: '3px',
      flexWrap: 'wrap'
    },
    badge: (couleur, bg) => ({
      fontSize: '11px',
      fontWeight: 700,
      color: couleur,
      backgroundColor: bg,
      padding: '2px 7px',
      borderRadius: '999px'
    }),
    metaText: {
      fontSize: '11px',
      color: '#B5A793',
      display: 'flex',
      alignItems: 'center',
      gap: '3px'
    },
    deleteButton: {
      border: 'none',
      backgroundColor: 'transparent',
      cursor: 'pointer',
      padding: '6px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: 0.8,
      flexShrink: 0
    },
    avatar: {
      width: '22px',
      height: '22px',
      borderRadius: '999px',
      backgroundColor: '#2B2420',
      color: '#FFFFFF',
      fontSize: '9px',
      fontWeight: 800,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    },
    notesBox: {
      marginTop: '10px',
      padding: '9px 11px',
      backgroundColor: '#F7F1E8',
      borderRadius: '10px',
      fontSize: '12.5px',
      color: '#475569',
      display: 'flex',
      gap: '6px',
      alignItems: 'flex-start'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Checklist</h2>

        {/* Un seul point d'entrée pour créer une checklist : soit à la main,
            soit via un modèle. Le bouton "+" du formulaire suffit pour
            ajouter une tâche, donc plus de doublon ici. */}
        <div style={styles.headerActions}>
        <div style={styles.modeleMenu}>
          <button
            type="button"
            style={styles.modeleButton}
            onClick={() => setMenuModeles((v) => !v)}
          >
            <IconSparkles size={16} />
            Modèle
            <IconChevronDown size={14} />
          </button>

          {menuModeles && (
            <div style={styles.modeleDropdown}>
              {Object.entries(MODELES).map(([cle, modele]) => (
                <div
                  key={cle}
                  style={styles.modeleItem}
                  onClick={() => ouvrirModele(cle)}
                >
                  {modele.label}
                </div>
              ))}
            </div>
          )}
        </div>

        {total > 0 && (
          <button
            type="button"
            style={styles.selectionButton(modeSelection)}
            onClick={toggleModeSelection}
          >
            {modeSelection ? 'Annuler' : 'Sélectionner'}
          </button>
        )}
        </div>
      </div>

      {modeSelection && (
        <div style={styles.barreSelection}>
          <span style={styles.barreSelectionTexte}>
            {selectionnees.size} sélectionnée{selectionnees.size > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" style={styles.barreSelectionLien} onClick={toutSelectionner}>
              {selectionnees.size === tachesFiltrees.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <button
              type="button"
              style={styles.barreSelectionSupprimer}
              onClick={supprimerSelection}
              disabled={selectionnees.size === 0}
            >
              <IconTrash size={14} />
              Supprimer
            </button>
          </div>
        </div>
      )}

      <div style={styles.progressCard}>
        <div style={styles.progressTop}>
          <div style={styles.progressLabel}>
            <IconClipboardList size={18} color="#6E8AA6" />
            <span>Préparation</span>
          </div>

          <span style={styles.progressPercent}>{progression}%</span>
        </div>

        <div style={styles.progressTrack}>
          <div style={styles.progressFill}></div>
        </div>

        <p style={styles.progressText}>
          {faites} sur {total} élément{total > 1 ? 's' : ''} complété
          {faites > 1 ? 's' : ''}
        </p>
      </div>

      {total > 0 && (
        <div style={styles.filtres}>
          <div
            style={styles.filtreChip(filtreCategorie === 'toutes', '#2B2420', '#F1E8D8')}
            onClick={() => setFiltreCategorie('toutes')}
          >
            Toutes
          </div>
          {CATEGORIES.map((c) => (
            <div
              key={c.id}
              style={styles.filtreChip(filtreCategorie === c.id, c.color, c.bg)}
              onClick={() => setFiltreCategorie(c.id)}
            >
              {c.label}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} style={styles.form}>
        <div style={styles.formRow}>
          <input
            type="text"
            placeholder="Ajouter une tâche..."
            value={nouvelleTache}
            onChange={(e) => setNouvelleTache(e.target.value)}
            style={styles.input}
          />

          <button type="submit" style={styles.submitButton} aria-label="Ajouter">
            <IconPlus size={22} stroke={2.5} />
          </button>
        </div>

        <button
          type="button"
          style={styles.toggleDetails}
          onClick={() => setDetailsOuverts((v) => !v)}
        >
          {detailsOuverts ? 'Masquer les détails' : 'Ajouter catégorie, priorité, échéance...'}
          <IconChevronDown
            size={14}
            style={{ transform: detailsOuverts ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        {detailsOuverts && (
          <div style={styles.detailsPanel}>
            <div style={styles.selectRow}>
              <select
                style={styles.select}
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>

              <select
                style={styles.select}
                value={priorite}
                onChange={(e) => setPriorite(e.target.value)}
              >
                {PRIORITES.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <input
              type="date"
              style={styles.smallInput}
              value={echeance}
              onChange={(e) => setEcheance(e.target.value)}
            />

            <input
              type="text"
              placeholder="Note (ex : passeport dans le tiroir)"
              style={styles.smallInput}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {voyageurs.length > 0 && (
              <select
                style={styles.select}
                value={assigneA}
                onChange={(e) => setAssigneA(e.target.value)}
              >
                <option value="">Assigner à quelqu'un (optionnel)</option>
                {voyageurs.map((v) => (
                  <option key={v.id} value={v.id}>{v.nom}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </form>

      <div style={styles.list}>
        {loading && (
          <div style={styles.emptyCard}>
            Chargement de la checklist...
          </div>
        )}

        {!loading && total === 0 && (
          <div style={styles.emptyCard}>
            Votre checklist est vide.<br />
            Ajoutez une tâche ou choisissez un modèle ci-dessus.
          </div>
        )}

        {!loading && total > 0 && tachesFiltrees.length === 0 && (
          <div style={styles.emptyCard}>
            Aucune tâche dans cette catégorie.
          </div>
        )}

        {!loading &&
          tachesFiltrees.map((tache) => {
            const cat = getCategorie(tache.categorie);
            const prio = getPriorite(tache.priorite);
            const dateLabel = formatDate(tache.echeance);

            return (
              <div key={tache.id} style={styles.item}>
                <div style={styles.itemTop}>
                  <div
                    onClick={() => (modeSelection ? toggleSelection(tache.id) : toggleFait(tache))}
                    style={styles.itemLeft}
                  >
                    {modeSelection ? (
                      <div style={{ ...styles.iconBox(cat.bg), padding: 0 }}>
                        <div style={styles.modaleCheckbox(selectionnees.has(tache.id))}>
                          {selectionnees.has(tache.id) && '✓'}
                        </div>
                      </div>
                    ) : (
                      <div style={styles.iconBox(tache.fait ? '#F1E8D8' : cat.bg)}>
                        {tache.fait ? (
                          <IconCircleCheckFilled size={23} color="#16C784" />
                        ) : (
                          <IconCircle size={23} color={cat.color} />
                        )}
                      </div>
                    )}

                    <div style={styles.itemNameWrap}>
                      <span
                        style={{
                          ...styles.itemName,
                          ...(tache.fait ? styles.itemNameDone : {})
                        }}
                      >
                        {tache.nom}
                      </span>

                      <div style={styles.itemMeta}>
                        <span style={styles.badge(cat.color, cat.bg)}>{cat.label}</span>
                        {tache.priorite === 'urgent' && (
                          <span style={styles.badge(prio.color, '#FEF2F2')}>{prio.label}</span>
                        )}
                        {dateLabel && (
                          <span style={styles.metaText}>
                            <IconCalendar size={11} />
                            {dateLabel}
                          </span>
                        )}
                        {tache.assigneA && nomAssigne(tache.assigneA) && (
                          <span style={styles.badge('#6E8AA6', '#EEF2F0')}>
                            {avatarAssigne(tache.assigneA) || '👤'} {nomAssigne(tache.assigneA)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Auteur de la tâche — rend la checklist lisible à
                        plusieurs quand le voyage est partagé */}
                    <div
                      style={styles.avatar}
                      title={`Ajouté par ${tache.auteurNom || 'Anonyme'}`}
                    >
                      {initiales(tache.auteurNom)}
                    </div>

                    {!modeSelection && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tache.id)}
                        style={styles.deleteButton}
                        aria-label="Supprimer la tâche"
                      >
                        <IconTrash size={19} color="#B5A793" />
                      </button>
                    )}
                  </div>
                </div>

                {tache.notes && (
                  <div style={styles.notesBox}>
                    <IconNote size={14} color="#B5A793" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{tache.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {modaleModele && (
        <div style={styles.overlay} onClick={() => setModaleModele(null)}>
          <div style={styles.modaleCarte} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modaleHeader}>
              <h3 style={styles.modaleTitre}>Modèle « {MODELES[modaleModele].label} »</h3>
              <button
                type="button"
                style={styles.modaleFermer}
                onClick={() => setModaleModele(null)}
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <p style={styles.modaleSousTitre}>
              Coche ce que tu veux ajouter à ta checklist.
            </p>

            {MODELES[modaleModele].taches.map((t, i) => {
              const dejaLa = nomsExistants.has(t.nom.trim().toLowerCase());
              return (
                <div
                  key={i}
                  style={styles.modaleLigne}
                  onClick={() =>
                    setSelectionModele((prev) => ({ ...prev, [i]: !prev[i] }))
                  }
                >
                  <div style={styles.modaleCheckbox(!!selectionModele[i])}>
                    {selectionModele[i] && '✓'}
                  </div>
                  <span style={styles.modaleLigneTexte}>{t.nom}</span>
                  {dejaLa && <span style={styles.modaleDejaLa}>déjà ajoutée</span>}
                </div>
              );
            })}

            <div style={styles.modaleActions}>
              <button
                type="button"
                style={styles.modaleActionSecondaire}
                onClick={() => toutCocherModele(true)}
              >
                Tout cocher
              </button>
              <button
                type="button"
                style={styles.modaleActionPrincipale}
                onClick={validerModele}
              >
                Ajouter la sélection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
