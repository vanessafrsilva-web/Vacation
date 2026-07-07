import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Convertisseur } from './Convertisseur';
import {
  IconTrash, IconReceipt2, IconGasStation, IconBasket, IconCoffee, IconTicket,
  IconBuildingStore, IconPencil, IconCheck, IconX,
  IconArrowRight, IconWallet, IconTrophy, IconCamera, IconPhoto
} from '@tabler/icons-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// Couleurs assignées de façon stable à chaque voyageur (par index) —
// alignées sur la palette du reste de l'app
const COULEURS_VOYAGEURS = ['#6E8AA6', '#9A6B87', '#F59E0B', '#B8863C', '#B3453A', '#5E8A87', '#B97490'];

export function Budget({ voyage, voyageId }) {
  // Compat : si jamais seul voyageId est encore passé quelque part
  const idVoyage = voyage?.id || voyageId;

  // Liste des voyageurs. Depuis l'authentification, chaque voyage inclut déjà
  // l'admin réel (vous) dans voyage.voyageurs — plus besoin d'un "Vous"
  // synthétique en plus, ça créait un doublon avec votre vrai nom.
  const voyageurs = voyage?.voyageurs || [];

  const couleurVoyageur = (id) => {
    if (id === 'cagnotte') return '#5E8A87';
    const index = voyageurs.findIndex((v) => v.id === id);
    return COULEURS_VOYAGEURS[index >= 0 ? index % COULEURS_VOYAGEURS.length : 0];
  };
  const nomVoyageur = (id) => {
    if (id === 'cagnotte') return 'Cagnotte commune';
    return voyageurs.find((v) => v.id === id)?.nom || 'Quelqu\'un';
  };

  // --- ÉTATS ---
  const [depenses, setDepenses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showReglement, setShowReglement] = useState(false);
  const [editionBudget, setEditionBudget] = useState(false);

  const [titre, setTitre] = useState('');
  const [recuPreview, setRecuPreview] = useState(null); // dataURL compressée, ou null
  const [recuEnCours, setRecuEnCours] = useState(false);
  const [imageAgrandie, setImageAgrandie] = useState(null); // dataURL affichée en grand, ou null
  const [montant, setMontant] = useState('');
  const [categorie, setCategorie] = useState('Courses');
  const [payePar, setPayePar] = useState(voyageurs[0]?.id || 'moi');
  const [beneficiaires, setBeneficiaires] = useState(voyageurs.map((v) => v.id));

  const [regleQui, setRegleQui] = useState(voyageurs[0]?.id || 'moi');
  const [regleAQui, setRegleAQui] = useState(voyageurs[1]?.id || voyageurs[0]?.id || 'moi');
  const [regleMontant, setRegleMontant] = useState('');

  const [budgetCible, setBudgetCible] = useState(voyage?.budgetCible || 3000);
  const [budgetInput, setBudgetInput] = useState(voyage?.budgetCible || 3000);

  // --- CAGNOTTE COMMUNE (ex: chacun met 200.- au début du voyage) ---
  const [showApportForm, setShowApportForm] = useState(false);
  const [apportQui, setApportQui] = useState(voyageurs[0]?.id || 'moi');
  const [apportMontant, setApportMontant] = useState('');

  // --- THÈME --- toujours le même crème/clair que le reste de l'app,
  // jamais de mode sombre ici.
  const theme = {
    bg: '#F7F1E8',
    card: '#FFFFFF',
    text: '#2B2420',
    subText: '#8A7B68',
    border: '#E8DFCF',
    inputBg: '#F7F1E8',
  };

  // --- CHARGEMENT FIREBASE ---
  useEffect(() => {
    if (!idVoyage) return;
    const q = query(collection(db, 'budget'), where('voyageId', '==', idVoyage));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() }));
      data.sort((a, b) => b.timestamp - a.timestamp);
      setDepenses(data);
    });
    return () => unsubscribe();
  }, [idVoyage]);

  // Réduit une photo de reçu à une taille raisonnable avant de l'enregistrer
  // dans Firestore (les documents sont limités à ~1 Mo, donc pas question
  // d'y stocker une photo brute d'un téléphone moderne).
  const compresserImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const largeurMax = 1000;
        const ratio = Math.min(1, largeurMax / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFichierRecu = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecuEnCours(true);
    try {
      const dataUrl = await compresserImage(file);
      setRecuPreview(dataUrl);
    } catch (error) {
      console.warn("Impossible de traiter la photo du reçu.", error);
    } finally {
      setRecuEnCours(false);
    }
  };

  // --- AJOUT D'UNE DÉPENSE ---
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!titre || !montant || beneficiaires.length === 0) return;

    try {
      await addDoc(collection(db, 'budget'), {
        titre,
        montant: parseFloat(montant),
        payePar,
        beneficiaires,
        categorie,
        estRemboursement: false,
        recu: recuPreview || null,
        voyageId: idVoyage,
        timestamp: Date.now()
      });
      setTitre(''); setMontant(''); setShowForm(false); setRecuPreview(null);
      setBeneficiaires(voyageurs.map((v) => v.id));
    } catch (error) {
      console.error("Erreur d'ajout :", error);
    }
  };

  // --- ENREGISTRER UN REMBOURSEMENT (règle une dette) ---
  const enregistrerRemboursement = async (deQui, aQui, montantRegle) => {
    if (!montantRegle || parseFloat(montantRegle) <= 0) return;
    try {
      await addDoc(collection(db, 'budget'), {
        titre: `Remboursement · ${nomVoyageur(deQui)} → ${nomVoyageur(aQui)}`,
        montant: parseFloat(montantRegle),
        payePar: deQui,
        beneficiaires: [aQui],
        categorie: 'Remboursement',
        estRemboursement: true,
        voyageId: idVoyage,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Erreur d'enregistrement du remboursement :", error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Supprimer cette entrée ?")) {
      await deleteDoc(doc(db, 'budget', id));
    }
  };

  const enregistrerApport = async (e) => {
    e.preventDefault();
    if (!apportMontant || parseFloat(apportMontant) <= 0) return;
    try {
      await addDoc(collection(db, 'budget'), {
        titre: `Apport à la cagnotte · ${nomVoyageur(apportQui)}`,
        montant: parseFloat(apportMontant),
        payePar: apportQui,
        beneficiaires: [],
        categorie: 'Cagnotte',
        estRemboursement: false,
        estApportCagnotte: true,
        voyageId: idVoyage,
        timestamp: Date.now()
      });
      setApportMontant('');
      setShowApportForm(false);
    } catch (error) {
      console.error("Erreur d'enregistrement de l'apport :", error);
    }
  };

  const toggleBeneficiaire = (id) => {
    setBeneficiaires((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const enregistrerBudgetCible = async () => {
    const valeur = parseFloat(budgetInput) || 0;
    setBudgetCible(valeur);
    setEditionBudget(false);
    if (idVoyage) {
      try {
        await updateDoc(doc(db, 'voyages', idVoyage), { budgetCible: valeur });
      } catch (error) {
        console.warn("Impossible d'enregistrer le budget cible.", error);
      }
    }
  };

  // --- CALCULS : TOTAUX, CATÉGORIES, BALANCES ---
  // Une "vraie dépense" exclut les remboursements (transferts entre personnes)
  // ET les apports à la cagnotte (ce n'est pas une dépense, juste de l'argent
  // mis de côté) — mais inclut bien les dépenses payées depuis la cagnotte,
  // puisque c'est de la vraie dépense de voyage.
  const vraiesDepenses = depenses.filter((d) => !d.estRemboursement && !d.estApportCagnotte);
  const totalVoyage = vraiesDepenses.reduce((acc, d) => acc + d.montant, 0);

  // --- CAGNOTTE COMMUNE ---
  const apportsCagnotte = depenses.filter((d) => d.estApportCagnotte);
  const totalApporte = apportsCagnotte.reduce((acc, d) => acc + d.montant, 0);
  const depensesPayeesParCagnotte = vraiesDepenses.filter((d) => d.payePar === 'cagnotte');
  const totalDepenseCagnotte = depensesPayeesParCagnotte.reduce((acc, d) => acc + d.montant, 0);
  const soldeCagnotte = totalApporte - totalDepenseCagnotte;
  const apportParPersonne = useMemo(() => {
    const acc = {};
    voyageurs.forEach((v) => { acc[v.id] = 0; });
    apportsCagnotte.forEach((d) => { acc[d.payePar] = (acc[d.payePar] || 0) + d.montant; });
    return acc;
  }, [depenses, voyageurs]);
  const cagnotteActive = totalApporte > 0;

  const categoriesData = useMemo(() => {
    const acc = {};
    vraiesDepenses.forEach((dep) => {
      let color = '#8E8E93';
      if (dep.categorie === 'Essence') color = '#F59E0B';
      if (dep.categorie === 'Courses') color = '#B8863C';
      if (dep.categorie === 'Verres/Resto') color = '#9A6B87';
      if (dep.categorie === 'Activités') color = '#6E8AA6';
      if (!acc[dep.categorie]) acc[dep.categorie] = { name: dep.categorie, value: 0, fill: color };
      acc[dep.categorie].value += dep.montant;
    });
    return Object.values(acc);
  }, [depenses]);

  // Total payé par personne (utile pour le classement "qui a le plus avancé")
  // — on exclut ce qui a été payé par la cagnotte, ce n'est pas une personne.
  const totalParPersonne = useMemo(() => {
    const acc = {};
    voyageurs.forEach((v) => { acc[v.id] = 0; });
    vraiesDepenses.forEach((dep) => {
      if (dep.payePar === 'cagnotte') return;
      acc[dep.payePar] = (acc[dep.payePar] || 0) + dep.montant;
    });
    return acc;
  }, [depenses, voyageurs]);
  const maxPayePersonne = Math.max(1, ...voyageurs.map((v) => totalParPersonne[v.id] || 0));

  // Balance nette par personne : positif = on lui doit de l'argent,
  // négatif = elle doit de l'argent au groupe.
  // Inclut aussi les remboursements (qui rééquilibrent naturellement).
  const balances = useMemo(() => {
    const acc = {};
    voyageurs.forEach((v) => { acc[v.id] = 0; });
    depenses.forEach((dep) => {
      if (dep.estApportCagnotte) return; // pas une dépense partagée, juste un apport personnel
      if (dep.payePar === 'cagnotte') return; // payé par l'argent commun, personne ne doit rien à personne
      const parts = (dep.beneficiaires && dep.beneficiaires.length > 0) ? dep.beneficiaires : voyageurs.map(v => v.id);
      const part = dep.montant / parts.length;
      acc[dep.payePar] = (acc[dep.payePar] || 0) + dep.montant;
      parts.forEach((id) => { acc[id] = (acc[id] || 0) - part; });
    });
    return acc;
  }, [depenses, voyageurs]);

  // Simplification des dettes : qui doit payer qui, pour un minimum de virements
  const suggestionsReglement = useMemo(() => {
    const creanciers = [];
    const debiteurs = [];
    Object.entries(balances).forEach(([id, val]) => {
      if (val > 0.5) creanciers.push({ id, montant: val });
      else if (val < -0.5) debiteurs.push({ id, montant: -val });
    });
    creanciers.sort((a, b) => b.montant - a.montant);
    debiteurs.sort((a, b) => b.montant - a.montant);

    const transferts = [];
    let i = 0, j = 0;
    const c = creanciers.map((x) => ({ ...x }));
    const d = debiteurs.map((x) => ({ ...x }));
    while (i < c.length && j < d.length) {
      const montantTransfert = Math.min(c[i].montant, d[j].montant);
      transferts.push({ de: d[j].id, a: c[i].id, montant: montantTransfert });
      c[i].montant -= montantTransfert;
      d[j].montant -= montantTransfert;
      if (c[i].montant < 0.5) i++;
      if (d[j].montant < 0.5) j++;
    }
    return transferts;
  }, [balances]);

  // Top 3 des plus grosses dépenses (hors remboursements)
  const plusGrossesDepenses = [...vraiesDepenses].sort((a, b) => b.montant - a.montant).slice(0, 3);

  // Nombre réel de jours du voyage, pour la moyenne quotidienne
  const joursDeVoyage = useMemo(() => {
    if (!voyage?.dateDebut || !voyage?.dateFin) return 1;
    const debut = new Date(voyage.dateDebut);
    const fin = new Date(voyage.dateFin);
    const diff = Math.round((fin - debut) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [voyage]);

  const moyenneQuotidienne = totalVoyage / joursDeVoyage;
  const moyenneCible = budgetCible / joursDeVoyage;

  // --- ICÔNES DE CATÉGORIE ---
  const getIcon = (cat) => {
    switch (cat) {
      case 'Essence': return <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', padding: '10px', borderRadius: '12px' }}><IconGasStation size={24} color="#F59E0B" /></div>;
      case 'Courses': return <div style={{ backgroundColor: 'rgba(184, 134, 60, 0.2)', padding: '10px', borderRadius: '12px' }}><IconBasket size={24} color="#B8863C" /></div>;
      case 'Verres/Resto': return <div style={{ backgroundColor: 'rgba(154, 107, 135, 0.2)', padding: '10px', borderRadius: '12px' }}><IconCoffee size={24} color="#9A6B87" /></div>;
      case 'Activités': return <div style={{ backgroundColor: 'rgba(110, 138, 166, 0.2)', padding: '10px', borderRadius: '12px' }}><IconTicket size={24} color="#6E8AA6" /></div>;
      case 'Remboursement': return <div style={{ backgroundColor: 'rgba(94, 138, 135, 0.2)', padding: '10px', borderRadius: '12px' }}><IconWallet size={24} color="#5E8A87" /></div>;
      case 'Cagnotte': return <div style={{ backgroundColor: 'rgba(94, 138, 135, 0.2)', padding: '10px', borderRadius: '12px' }}><IconWallet size={24} color="#5E8A87" /></div>;
      default: return <div style={{ backgroundColor: 'rgba(142, 142, 147, 0.2)', padding: '10px', borderRadius: '12px' }}><IconBuildingStore size={24} color="#8E8E93" /></div>;
    }
  };

  // Résumé clair et immédiat, façon "Sarah vous doit 87 CHF" — beaucoup
  // plus lisible qu'une liste de balances quand on est seulement deux.
  const resumeBalance = useMemo(() => {
    if (voyageurs.length === 2) {
      const [a, b] = voyageurs;
      const balA = balances[a.id] || 0;
      if (Math.abs(balA) < 0.5) return { type: 'ok' };
      const creancier = balA > 0 ? a : b;
      const debiteur = balA > 0 ? b : a;
      return { type: 'duo', creancier, debiteur, montant: Math.abs(balA) };
    }

    // Plus de deux voyageurs : on met en avant le plus gros écart
    const tri = [...voyageurs].sort((x, y) => Math.abs(balances[y.id] || 0) - Math.abs(balances[x.id] || 0));
    const plusGros = tri[0];
    const balPlusGros = balances[plusGros.id] || 0;
    if (Math.abs(balPlusGros) < 0.5) return { type: 'ok' };
    return { type: 'multi', personne: plusGros, montant: Math.abs(balPlusGros), positif: balPlusGros > 0 };
  }, [balances, voyageurs]);

  const inputStyle = { width: '100%', padding: '14px', marginBottom: '12px', borderRadius: '12px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: '16px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

  const choiceBtnStyle = (isActive, color) => ({
    flex: '1 0 auto', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s',
    border: isActive ? `2px solid ${color}` : `2px solid transparent`,
    backgroundColor: isActive ? `${color}20` : theme.inputBg,
    color: isActive ? color : theme.subText, fontFamily: 'inherit'
  });

  return (
    <div style={{ padding: '5px', textAlign: 'left', backgroundColor: theme.bg, color: theme.text, minHeight: '100vh' }}>

      <div style={{ marginBottom: '25px' }}>
        <Convertisseur />
      </div>

      {/* RÉSUMÉ IMMÉDIAT — la première chose qu'on doit voir */}
      {voyageurs.length > 1 && (
        <div style={{
          padding: '20px', borderRadius: '20px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '14px',
          backgroundColor: !resumeBalance || resumeBalance.type === 'ok' ? 'rgba(184, 134, 60, 0.1)' : 'rgba(110, 138, 166, 0.08)',
          border: `1px solid ${!resumeBalance || resumeBalance.type === 'ok' ? 'rgba(184, 134, 60, 0.25)' : 'rgba(110, 138, 166, 0.2)'}`
        }}>
          <div style={{
            width: '46px', height: '46px', borderRadius: '14px', flexShrink: 0,
            backgroundColor: !resumeBalance || resumeBalance.type === 'ok' ? '#B8863C' : '#6E8AA6',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <IconWallet size={24} color="#FFFFFF" />
          </div>
          <div>
            {(!resumeBalance || resumeBalance.type === 'ok') && (
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>Les comptes sont équilibrés 🎉</p>
            )}
            {resumeBalance?.type === 'duo' && (
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>
                {resumeBalance.debiteur.nom} doit <span style={{ color: '#6E8AA6' }}>{resumeBalance.montant.toFixed(2)} CHF</span> à {resumeBalance.creancier.nom}
              </p>
            )}
            {resumeBalance?.type === 'multi' && (
              <p style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#2B2420' }}>
                {resumeBalance.personne.nom} {resumeBalance.positif ? 'doit recevoir' : 'doit'} <span style={{ color: '#6E8AA6' }}>{resumeBalance.montant.toFixed(2)} CHF</span>
              </p>
            )}
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#8A7B68' }}>Détail complet et suggestions ci-dessous</p>
          </div>
        </div>
      )}

      {/* TABLEAU DE BORD */}
      <div style={{ backgroundColor: theme.card, padding: '25px 20px', borderRadius: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>

        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
              <p style={{ margin: 0, color: theme.subText, fontSize: '12px', fontWeight: 'bold' }}>TOTAL</p>
              <button onClick={() => setEditionBudget(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.subText, padding: 0, display: 'flex' }}>
                <IconPencil size={12} />
              </button>
            </div>
            {editionBudget ? (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} style={{ width: '70px', padding: '6px 8px', borderRadius: '8px', border: `1px solid ${theme.border}`, backgroundColor: theme.inputBg, color: theme.text, fontSize: '14px', outline: 'none' }} />
                <button onClick={enregistrerBudgetCible} style={{ background: '#B8863C', border: 'none', borderRadius: '6px', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconCheck size={14} color="#000" /></button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: '20px', fontWeight: '800' }}>{totalVoyage.toFixed(0)} <span style={{ fontSize: '14px', color: theme.subText }}>/{budgetCible} CHF</span></div>
                <div style={{ height: '6px', backgroundColor: theme.border, borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: '#B3453A', width: `${Math.min((totalVoyage / budgetCible) * 100, 100)}%` }}></div>
                </div>
              </>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 5px 0', color: theme.subText, fontSize: '12px', fontWeight: 'bold' }}>MOYENNE / JOUR</p>
            <div style={{ fontSize: '20px', fontWeight: '800' }}>{moyenneQuotidienne.toFixed(0)} <span style={{ fontSize: '14px', color: theme.subText }}>/{moyenneCible.toFixed(0)} CHF</span></div>
            <div style={{ height: '6px', backgroundColor: theme.border, borderRadius: '3px', marginTop: '8px', overflow: 'hidden' }}>
              <div style={{ height: '100%', backgroundColor: '#6E8AA6', width: `${Math.min((moyenneQuotidienne / moyenneCible) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        {/* GRAPHIQUE DONUT PAR CATÉGORIE */}
        {categoriesData.length > 0 && (
          <div style={{ height: '190px', width: '100%', marginBottom: '10px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoriesData} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {categoriesData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                </Pie>
                <Tooltip formatter={(value) => `${value.toFixed(2)} CHF`} contentStyle={{ backgroundColor: theme.card, borderRadius: '10px', border: `1px solid ${theme.border}` }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* CAGNOTTE COMMUNE */}
        <div style={{ marginBottom: '20px', padding: '16px', borderRadius: '16px', backgroundColor: 'rgba(94, 138, 135, 0.08)', border: '1px solid rgba(94, 138, 135, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: cagnotteActive ? '12px' : 0 }}>
            <p style={{ margin: 0, color: '#5E8A87', fontSize: '12px', fontWeight: 'bold' }}>🏦 CAGNOTTE COMMUNE</p>
            <button type="button" onClick={() => setShowApportForm(!showApportForm)} style={{ border: 'none', background: 'none', color: '#5E8A87', fontSize: '12px', fontWeight: '800', cursor: 'pointer', fontFamily: 'inherit' }}>
              {showApportForm ? 'Fermer' : '+ Ajouter un apport'}
            </button>
          </div>

          {cagnotteActive && (
            <>
              <div style={{ display: 'flex', gap: '15px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: theme.subText }}>Apporté</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: theme.text }}>{totalApporte.toFixed(2)} CHF</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: theme.subText }}>Dépensé</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: theme.text }}>{totalDepenseCagnotte.toFixed(2)} CHF</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '11px', color: theme.subText }}>Reste</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: soldeCagnotte >= 0 ? '#5E8A87' : '#B3453A' }}>{soldeCagnotte.toFixed(2)} CHF</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {voyageurs.filter((v) => (apportParPersonne[v.id] || 0) > 0).map((v) => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                    <span style={{ color: theme.text, fontWeight: '600' }}>{v.nom}</span>
                    <span style={{ color: theme.subText }}>{(apportParPersonne[v.id] || 0).toFixed(2)} CHF apportés</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {showApportForm && (
            <form onSubmit={enregistrerApport} style={{ display: 'flex', gap: '8px', marginTop: cagnotteActive ? '14px' : '10px' }}>
              <select value={apportQui} onChange={(e) => setApportQui(e.target.value)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: '#FFFFFF', color: theme.text, fontSize: '13px', fontFamily: 'inherit' }}>
                {voyageurs.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Montant" value={apportMontant} onChange={(e) => setApportMontant(e.target.value)} style={{ width: '100px', padding: '10px', borderRadius: '10px', border: `1px solid ${theme.border}`, backgroundColor: '#FFFFFF', color: theme.text, fontSize: '13px', outline: 'none', fontFamily: 'inherit' }} />
              <button type="submit" style={{ border: 'none', backgroundColor: '#5E8A87', color: '#FFF', borderRadius: '10px', padding: '0 14px', cursor: 'pointer', fontWeight: '800', fontFamily: 'inherit' }}>OK</button>
            </form>
          )}

          {!cagnotteActive && !showApportForm && (
            <p style={{ margin: 0, fontSize: '12.5px', color: theme.subText }}>Chacun met une somme de côté au début du voyage (ex: 200.- sur Revolut), et les dépenses payées depuis cette cagnotte ne comptent plus dans les dettes individuelles.</p>
          )}
        </div>

        {/* QUI A LE PLUS AVANCÉ D'ARGENT */}
        {voyageurs.length > 1 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px 0', color: theme.subText, fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IconTrophy size={14} /> QUI A LE PLUS AVANCÉ
            </p>
            {voyageurs.map((v) => (
              <div key={v.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '3px' }}>
                  <span style={{ color: theme.text, fontWeight: '600' }}>{v.nom}</span>
                  <span style={{ color: theme.subText }}>{(totalParPersonne[v.id] || 0).toFixed(2)} CHF</span>
                </div>
                <div style={{ height: '6px', backgroundColor: theme.border, borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: couleurVoyageur(v.id), width: `${((totalParPersonne[v.id] || 0) / maxPayePersonne) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BALANCES + SUGGESTIONS DE REMBOURSEMENT */}
        {voyageurs.length > 1 ? (
          <div>
            <p style={{ margin: '0 0 10px 0', color: theme.subText, fontSize: '12px', fontWeight: 'bold' }}>QUI DOIT QUOI</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: suggestionsReglement.length > 0 ? '14px' : 0 }}>
              {voyageurs.map((v) => {
                const bal = balances[v.id] || 0;
                const neutre = Math.abs(bal) < 0.5;
                return (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '12px', backgroundColor: theme.inputBg }}>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: theme.text }}>{v.nom}</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: neutre ? theme.subText : (bal > 0 ? '#B8863C' : '#B3453A') }}>
                      {neutre ? 'à jour' : (bal > 0 ? `+${bal.toFixed(2)}` : bal.toFixed(2))}
                    </span>
                  </div>
                );
              })}
            </div>

            {suggestionsReglement.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {suggestionsReglement.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', border: `1px dashed ${theme.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: theme.text, minWidth: 0 }}>
                      <span style={{ fontWeight: '700' }}>{nomVoyageur(s.de)}</span>
                      <IconArrowRight size={14} color={theme.subText} />
                      <span style={{ fontWeight: '700' }}>{nomVoyageur(s.a)}</span>
                      <span style={{ color: theme.subText }}>· {s.montant.toFixed(2)} CHF</span>
                    </div>
                    <button
                      onClick={() => enregistrerRemboursement(s.de, s.a, s.montant.toFixed(2))}
                      style={{ border: 'none', backgroundColor: '#B8863C', color: '#000', fontSize: '11px', fontWeight: '800', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', flexShrink: 0, fontFamily: 'inherit' }}
                    >
                      Marquer réglé
                    </button>
                  </div>
                ))}
              </div>
            )}

            {suggestionsReglement.length === 0 && (
              <div style={{ padding: '12px', borderRadius: '12px', backgroundColor: 'rgba(184, 134, 60, 0.15)', color: '#B8863C', textAlign: 'center', fontSize: '13px', fontWeight: '700' }}>
                Les comptes sont à jour !
              </div>
            )}

            <button
              onClick={() => setShowReglement(!showReglement)}
              style={{ marginTop: '10px', width: '100%', background: 'none', border: 'none', color: theme.subText, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
            >
              {showReglement ? 'Fermer' : 'Enregistrer un remboursement manuel'}
            </button>

            {showReglement && (
              <div style={{ marginTop: '10px', padding: '14px', borderRadius: '12px', backgroundColor: theme.inputBg, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <select value={regleQui} onChange={(e) => setRegleQui(e.target.value)} style={{ ...inputStyle, margin: 0, flex: 1, padding: '10px' }}>
                    {voyageurs.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
                  </select>
                  <IconArrowRight size={16} color={theme.subText} />
                  <select value={regleAQui} onChange={(e) => setRegleAQui(e.target.value)} style={{ ...inputStyle, margin: 0, flex: 1, padding: '10px' }}>
                    {voyageurs.map((v) => <option key={v.id} value={v.id}>{v.nom}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" step="0.01" placeholder="Montant" value={regleMontant} onChange={(e) => setRegleMontant(e.target.value)} style={{ ...inputStyle, margin: 0, flex: 1 }} />
                  <button
                    onClick={async () => { await enregistrerRemboursement(regleQui, regleAQui, regleMontant); setRegleMontant(''); setShowReglement(false); }}
                    style={{ border: 'none', backgroundColor: '#6E8AA6', color: '#FFF', fontWeight: '800', borderRadius: '10px', padding: '0 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '15px', borderRadius: '15px', backgroundColor: theme.border, color: theme.subText, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', textAlign: 'center' }}>
            <IconReceipt2 size={20} />
            <span style={{ fontWeight: '600', fontSize: '13px' }}>Ajoute des voyageurs (en haut) pour partager les dépenses et calculer qui doit quoi.</span>
          </div>
        )}
      </div>

      {/* TOP 3 DES PLUS GROSSES DÉPENSES */}
      {plusGrossesDepenses.length > 0 && (
        <div style={{ backgroundColor: theme.card, padding: '18px 20px', borderRadius: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` }}>
          <p style={{ margin: '0 0 12px 0', color: theme.subText, fontSize: '12px', fontWeight: 'bold' }}>PLUS GROSSES DÉPENSES</p>
          {plusGrossesDepenses.map((d, i) => (
            <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < plusGrossesDepenses.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
              <span style={{ fontSize: '14px', color: theme.text, fontWeight: '600' }}>{i + 1}. {d.titre}</span>
              <span style={{ fontSize: '14px', color: theme.subText, fontWeight: '700' }}>{d.montant.toFixed(2)} CHF</span>
            </div>
          ))}
        </div>
      )}

      {/* FORMULAIRE NOUVELLE DÉPENSE */}
      <div style={{ marginBottom: '30px' }}>
        {showForm ? (
          <form onSubmit={handleAdd} style={{ backgroundColor: theme.card, padding: '20px', borderRadius: '20px', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="text" placeholder="Titre (ex: Tesco, Pub...)" value={titre} onChange={(e) => setTitre(e.target.value)} style={{ ...inputStyle, flex: 2 }} required />
              <input type="number" step="0.01" placeholder="Prix" value={montant} onChange={(e) => setMontant(e.target.value)} style={{ ...inputStyle, flex: 1 }} required />
            </div>

            <select value={categorie} onChange={(e) => setCategorie(e.target.value)} style={inputStyle}>
              <option value="Courses">🛒 Courses / Supermarché</option>
              <option value="Verres/Resto">🍻 Verres & Restos</option>
              <option value="Essence">⛽️ Essence & Transports</option>
              <option value="Activités">🎟️ Visites & Activités</option>
              <option value="Autre">🛍️ Autre</option>
            </select>

            <p style={{ margin: '5px 0 10px 5px', fontSize: '13px', color: theme.subText }}>Qui a avancé l'argent ?</p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {voyageurs.map((v) => (
                <button key={v.id} type="button" onClick={() => setPayePar(v.id)} style={choiceBtnStyle(payePar === v.id, couleurVoyageur(v.id))}>
                  {v.nom}
                </button>
              ))}
              {cagnotteActive && (
                <button type="button" onClick={() => setPayePar('cagnotte')} style={choiceBtnStyle(payePar === 'cagnotte', '#5E8A87')}>
                  🏦 Cagnotte
                </button>
              )}
            </div>

            {payePar !== 'cagnotte' && (
            <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 10px 5px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: theme.subText }}>C'était pour qui ?</p>
              <button type="button" onClick={() => setBeneficiaires(voyageurs.map((v) => v.id))} style={{ background: 'none', border: 'none', color: '#6E8AA6', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}>
                Tout le monde
              </button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', flexWrap: 'wrap' }}>
              {voyageurs.map((v) => (
                <button key={v.id} type="button" onClick={() => toggleBeneficiaire(v.id)} style={choiceBtnStyle(beneficiaires.includes(v.id), couleurVoyageur(v.id))}>
                  {v.nom}
                </button>
              ))}
            </div>
            </>
            )}

            <p style={{ margin: '0 0 8px 5px', fontSize: '13px', color: theme.subText }}>Photo du reçu (optionnel)</p>
            {recuPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', padding: '10px', backgroundColor: theme.inputBg, borderRadius: '12px' }}>
                <img
                  src={recuPreview}
                  alt="Reçu"
                  onClick={() => setImageAgrandie(recuPreview)}
                  style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '10px', cursor: 'pointer', flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: '12px', color: theme.subText }}>Reçu attaché</span>
                <button type="button" onClick={() => setRecuPreview(null)} style={{ border: 'none', background: 'none', color: '#B3453A', cursor: 'pointer', padding: '6px', display: 'flex' }}>
                  <IconX size={18} />
                </button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '13px', marginBottom: '20px', borderRadius: '12px', border: `1.5px dashed ${theme.border}`, color: theme.subText, fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                <IconCamera size={18} />
                {recuEnCours ? 'Traitement de la photo...' : 'Ajouter une photo de reçu'}
                <input type="file" accept="image/*" capture="environment" onChange={handleFichierRecu} style={{ display: 'none' }} disabled={recuEnCours} />
              </label>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => { setShowForm(false); setRecuPreview(null); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: theme.inputBg, color: theme.text, cursor: 'pointer', fontWeight: 'bold', fontFamily: 'inherit' }}>Annuler</button>
              <button type="submit" style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#B8863C', color: '#000', fontWeight: '900', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}>Sauvegarder</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setShowForm(true)} style={{ width: '100%', padding: '16px', backgroundColor: '#6E8AA6', color: '#FFF', border: 'none', borderRadius: '16px', fontWeight: '800', cursor: 'pointer', fontSize: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(110, 138, 166, 0.3)', fontFamily: 'inherit' }}>
            + Nouvelle dépense
          </button>
        )}
      </div>

      {/* HISTORIQUE */}
      <div>
        <h3 style={{ color: theme.text, fontSize: '20px', marginBottom: '15px', fontWeight: '700' }}>Transactions</h3>
        {depenses.length === 0 && <p style={{ color: theme.subText, fontSize: '15px', textAlign: 'center', padding: '20px' }}>Votre portefeuille est vide.</p>}

        {depenses.map((dep) => (
          <div key={dep.id} style={{ backgroundColor: theme.card, padding: '16px', borderRadius: '16px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${theme.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <div style={{ marginRight: '15px' }}>{getIcon(dep.categorie)}</div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: '0 0 4px 0', color: theme.text, fontWeight: '600', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dep.titre}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ color: theme.subText, fontSize: '12px' }}>
                    {dep.estApportCagnotte ? 'Apporté par' : (dep.estRemboursement ? 'De' : 'Payé par')} <strong style={{ color: couleurVoyageur(dep.payePar) }}>{nomVoyageur(dep.payePar)}</strong>
                  </span>
                  {!dep.estRemboursement && !dep.estApportCagnotte && (
                    <>
                      <span style={{ color: theme.subText, fontSize: '10px' }}>•</span>
                      <span style={{ color: theme.subText, fontSize: '12px' }}>
                        Pour {dep.payePar === 'cagnotte'
                          ? 'la cagnotte'
                          : ((dep.beneficiaires || []).length === voyageurs.length
                            ? 'tout le monde'
                            : (dep.beneficiaires || []).map((id) => nomVoyageur(id)).join(', '))}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexShrink: 0 }}>
              {dep.recu && (
                <img
                  src={dep.recu}
                  alt="Reçu"
                  onClick={() => setImageAgrandie(dep.recu)}
                  style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${theme.border}` }}
                />
              )}
              <span style={{ color: dep.estRemboursement ? '#5E8A87' : theme.text, fontWeight: '800', fontSize: '16px' }}>{dep.montant.toFixed(2)}</span>
              <button onClick={() => handleDelete(dep.id)} style={{ background: 'transparent', border: 'none', padding: '5px', cursor: 'pointer', display: 'flex' }}>
                <IconTrash size={20} color="#B3453A" style={{ opacity: 0.7 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Visionneuse plein écran pour les reçus */}
      {imageAgrandie && (
        <div
          onClick={() => setImageAgrandie(null)}
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(43, 36, 32, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: '20px' }}
        >
          <button
            onClick={() => setImageAgrandie(null)}
            style={{ position: 'absolute', top: '20px', right: '20px', border: 'none', backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <IconX size={20} />
          </button>
          <img src={imageAgrandie} alt="Reçu en grand" style={{ maxWidth: '100%', maxHeight: '85vh', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
