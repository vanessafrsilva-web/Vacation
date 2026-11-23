import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash, IconCheck, IconScale, IconEqual } from '@tabler/icons-react';

// =====================================================================
// BUDGET COMMUN — un budget par mois, partagé entre vous deux.
//
// Deux parties :
//   1) Les dépenses fixes (loyer, électricité…) : une ligne chacune, avec
//      fréquence, « payé par », et partage 50/50 ou prorata.
//   2) Le compte commun (Revolut) pour le variable (bouffe, maison…) :
//      chacun y verse un montant par mois, tout s'y dépense à 50/50 et le
//      détail se suit dans Revolut. Pas d'enveloppes à remplir.
//
// Données : budget_commun/{uidA}_{uidB}_{AAAA-MM}   (uidA/uidB triés)
//   membres      : [uidA, uidB]
//   mois         : 'AAAA-MM'
//   noms         : { uid: prénom }
//   revenus      : { uid: revenu net mensuel }
//   compte       : { uid: virement mensuel vers le compte commun }
//   repartition  : 'prorata' | 'egal' | 'manuel'   (répartition globale des dépenses fixes)
//   partA        : % payé par uidA quand repartition === 'manuel'
//   valide       : { uid: true|false } validation du mois par chacune
//   lignes       : { idLigne: { id, nom, cat: 'fixe', type, freq (jour|semaine|mois|trimestre|semestre|an), prevu, reel, paye, payePar, partage ('' | 'egal' | 'prorata'), ordre } }
//
// (Les anciennes lignes cat === 'env' d'avant sont ignorées à l'affichage.)
//
// La liaison des comptes se fait dans l'accord de cohabitation
// (on réutilise accord_prive/{uid}.partenaireUid).
// =====================================================================

const ACCENT = '#9A6B87';
const ACCENT_BG = '#F3ECF1';
const BLEU = '#6E8AA6';
const BLEU_BG = '#EEF2F0';
const VERT = '#16A06B';
const ROUGE = '#B3453A';
const SERIF = "'Playfair Display', Georgia, serif";

const inputStyle = {
  width: '100%', padding: '11px 12px', borderRadius: '12px', border: '1px solid #E8DFCF',
  backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit'
};
const labelStyle = { fontSize: '11.5px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px', lineHeight: '1.35' };
const petitBouton = { border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px', display: 'flex' };
const carte = { backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', marginBottom: '14px' };
const titreCarte = { margin: '0 0 10px 0', fontSize: '11.5px', fontWeight: '800', color: '#8A7B68', letterSpacing: '1.5px' };

const SUPPR = '__suppr__';

const nouvelId = (prefixe) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const propre = (o) => JSON.parse(JSON.stringify(o));

const num = (x) => {
  const n = parseFloat(String(x ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n) =>
  `${(Math.round(n * 100) / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
const pc = (n) => `${(Math.round(n * 10) / 10).toString().replace('.', ',')} %`;

// --- Fréquences : le montant saisi est celui payé à chaque fois ---------
const FREQS = [
  ['jour', 'Tous les jours', 365 / 12],
  ['semaine', 'Chaque semaine', 52 / 12],
  ['mois', 'Chaque mois', 1],
  ['trimestre', 'Tous les 3 mois', 1 / 3],
  ['semestre', 'Tous les 6 mois', 1 / 6],
  ['an', 'Chaque année', 1 / 12]
];
const infoFreq = (f) => FREQS.find((x) => x[0] === f) || FREQS[2];
// Montant prévu ramené à un mois (ce que vous mettez de côté chaque mois)
const prevuMois = (l) => num(l.prevu) * infoFreq(l.freq)[2];

// --- Mode de partage d'une ligne -----------------------------------------
const CYCLE_PARTAGE = ['', 'egal', 'prorata'];
const libelleMode = (m) => (m === 'egal' ? '50/50' : m === 'prorata' ? 'au prorata' : 'répartition choisie');

// --- Mois -------------------------------------------------------------
const moisCourant = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const decaler = (m, delta) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const libelleMois = (m) => {
  const [y, mo] = m.split('-').map(Number);
  const s = new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

// --- Modèle de départ (montants à remplir par vous) ---------------------
// La redevance radio/TV démarre en 50/50 (modifiable avec l'icône de la ligne).
const MODELE = [
  ['Loyer + charges', 'Obligatoire', 'mois', ''],
  ['Électricité', 'Obligatoire', 'trimestre', ''],
  ['Internet', 'Obligatoire', 'mois', ''],
  ['Assurance ménage (RC)', 'Obligatoire', 'an', ''],
  ['Redevance radio/TV', 'Obligatoire', 'an', 'egal'],
  ['Abonnements partagés (Netflix…)', 'Plaisir', 'mois', '']
];

// --- Gestion des modifications en attente (envoyées par petits morceaux) ---
const pendingVide = () => ({ scalars: {}, maps: {} });
const estVide = (p) => Object.keys(p.scalars).length === 0 && Object.keys(p.maps).length === 0;

function normaliser(d) {
  return {
    revenus: d?.revenus || {},
    noms: d?.noms || {},
    compte: d?.compte || {},
    repartition: d?.repartition || 'prorata',
    partA: d?.partA ?? 50,
    lignes: d?.lignes || {},
    valide: d?.valide || {}
  };
}

function appliquerPending(base, p) {
  const out = {
    ...base,
    revenus: { ...base.revenus },
    noms: { ...base.noms },
    compte: { ...base.compte },
    lignes: { ...base.lignes },
    valide: { ...base.valide }
  };
  Object.entries(p.scalars).forEach(([k, v]) => { out[k] = v; });
  Object.entries(p.maps).forEach(([champ, m]) => {
    Object.entries(m).forEach(([k, v]) => {
      if (v === SUPPR) delete out[champ][k];
      else out[champ][k] = v;
    });
  });
  return out;
}

function versFirestore(p) {
  const out = { ...p.scalars };
  Object.entries(p.maps).forEach(([champ, m]) => {
    out[champ] = {};
    Object.entries(m).forEach(([k, v]) => {
      out[champ][k] = v === SUPPR ? deleteField() : JSON.parse(JSON.stringify(v));
    });
  });
  return out;
}

function fusionner(a, b) {
  // b (plus récent) écrase a
  const out = { scalars: { ...a.scalars, ...b.scalars }, maps: {} };
  [...Object.keys(a.maps), ...Object.keys(b.maps)].forEach((champ) => {
    out.maps[champ] = { ...(a.maps[champ] || {}), ...(b.maps[champ] || {}) };
  });
  return out;
}

// =====================================================================
// UNE LIGNE DE DÉPENSE FIXE
// =====================================================================
function LigneBudget({ l, onChange, onDelete, pctMoi, pctElle, modeEff, modeGlobal, nomMoi, nomElle, uid, partenaireUid }) {
  const montant = num(l.prevu); // à chaque paiement
  const prevu = prevuMois(l); // ramené à un mois
  const reel = num(l.reel);
  const reste = l.paye ? 0 : Math.max(prevu - reel, 0);
  const depasse = prevu > 0 && reel > prevu ? reel - prevu : 0;
  const set = (patch) => onChange({ ...l, ...patch });

  const bascule = () => {
    const paye = !l.paye;
    set({ paye, reel: paye && !l.reel && prevu > 0 ? String(Math.round(prevu * 100) / 100) : l.reel });
  };

  // Mode de partage : '' (comme le global) → 50/50 → prorata → ''
  // On saute l'étape qui serait identique au mode global (inutile).
  const forcee = l.partage === 'egal' || l.partage === 'prorata';
  const partageSuivant = () => {
    let i = CYCLE_PARTAGE.indexOf(l.partage || '');
    for (let k = 0; k < CYCLE_PARTAGE.length; k++) {
      i = (i + 1) % CYCLE_PARTAGE.length;
      const c = CYCLE_PARTAGE[i];
      if (c === '' || c !== modeGlobal) return c;
    }
    return '';
  };
  const IconePartage = modeEff === 'egal' ? IconEqual : IconScale;
  const titrePartage = forcee
    ? `Cette ligne : ${libelleMode(modeEff)} (clique pour changer)`
    : 'Suit la répartition choisie en haut (clique pour forcer 50/50 ou prorata)';

  const petit = { ...inputStyle, padding: '8px 10px', fontSize: '14px' };
  const mini = (label, contenu) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ ...labelStyle, fontSize: '10.5px', marginBottom: '3px' }}>{label}</label>
      {contenu}
    </div>
  );

  // Virement mensuel : qui verse combien à qui (si quelqu'un a avancé la dépense)
  const payeurEstMoi = l.payePar && l.payePar === uid;
  const payeurEstElle = l.payePar && l.payePar === partenaireUid;
  const virementMontant = payeurEstMoi ? (prevu * pctElle) / 100 : payeurEstElle ? (prevu * pctMoi) / 100 : 0;

  return (
    <div style={{ backgroundColor: l.paye ? '#F6FBF8' : '#FFFFFF', border: `1px solid ${l.paye ? '#CFE8DB' : '#E8DFCF'}`, borderRadius: '14px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
        <button
          type="button"
          onClick={bascule}
          aria-label="Marquer comme payé"
          style={{
            flexShrink: 0, width: '24px', height: '24px', borderRadius: '7px', padding: 0, cursor: 'pointer',
            border: l.paye ? 'none' : '1.5px solid #D9CDB8', backgroundColor: l.paye ? VERT : '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          {l.paye && <IconCheck size={15} color="#FFFFFF" />}
        </button>
        <input
          type="text"
          value={l.nom || ''}
          placeholder="Nom de la dépense"
          onChange={(e) => set({ nom: e.target.value })}
          style={{ ...petit, fontWeight: '800', fontSize: '14.5px' }}
        />
        <button
          type="button"
          onClick={() => set({ partage: partageSuivant() })}
          title={titrePartage}
          aria-label={titrePartage}
          style={{
            flexShrink: 0, width: '32px', height: '32px', padding: 0, borderRadius: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: forcee ? `1.5px solid ${ACCENT}` : '1px solid #E8DFCF',
            backgroundColor: forcee ? ACCENT_BG : '#FFFFFF',
            color: forcee ? ACCENT : '#C9BDA9'
          }}
        >
          <IconePartage size={17} />
        </button>
        <button type="button" onClick={onDelete} style={{ ...petitBouton, color: ROUGE }}><IconTrash size={16} /></button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {mini('Montant', <input type="number" inputMode="decimal" step="any" value={l.prevu ?? ''} onChange={(e) => set({ prevu: e.target.value })} style={petit} />)}
        {mini('Réel (ce mois)', <input type="number" inputMode="decimal" step="any" value={l.reel ?? ''} onChange={(e) => set({ reel: e.target.value })} style={petit} />)}
        {mini('Reste', (
          <div style={{ padding: '8px 2px', fontSize: '14px', fontWeight: '800', color: depasse ? ROUGE : '#2B2420' }}>
            {depasse ? `+${fmt(depasse)}` : fmt(reste)}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => set({ type: l.type === 'Plaisir' ? 'Obligatoire' : 'Plaisir' })}
          style={{ padding: '6px 11px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: '800', color: l.type === 'Plaisir' ? BLEU : ACCENT, backgroundColor: l.type === 'Plaisir' ? BLEU_BG : ACCENT_BG }}
        >
          {l.type === 'Plaisir' ? 'Plaisir' : 'Obligatoire'}
        </button>
        <select
          value={l.freq || 'mois'}
          onChange={(e) => set({ freq: e.target.value })}
          style={{ ...petit, width: 'auto', minWidth: '125px', fontSize: '12.5px', padding: '6px 8px' }}
        >
          {FREQS.map(([id, lib]) => <option key={id} value={id}>{lib}</option>)}
        </select>
        <select
          value={l.payePar || ''}
          onChange={(e) => set({ payePar: e.target.value })}
          style={{ ...petit, width: 'auto', flex: 1, minWidth: '130px', fontSize: '12.5px', padding: '6px 8px' }}
        >
          <option value="">Payé par : non précisé</option>
          <option value={uid}>Payé par : {nomMoi}</option>
          <option value={partenaireUid}>Payé par : {nomElle}</option>
        </select>
      </div>

      {montant > 0 && (l.freq || 'mois') !== 'mois' && (
        <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: ACCENT, fontWeight: '700' }}>
          {fmt(montant)} {infoFreq(l.freq)[1].toLowerCase()} = {fmt(prevu)} à mettre de côté par mois
        </p>
      )}

      {prevu > 0 && (
        <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#8A7B68', fontWeight: '600', lineHeight: '1.45' }}>
          {nomMoi} {fmt((prevu * pctMoi) / 100)} · {nomElle} {fmt((prevu * pctElle) / 100)} par mois
          {' · '}
          <span style={{ color: forcee ? ACCENT : '#B5A793', fontWeight: forcee ? '800' : '600' }}>{libelleMode(modeEff)}</span>
        </p>
      )}

      {virementMontant > 0.004 && (
        <p style={{ margin: '8px 0 0 0', padding: '8px 10px', borderRadius: '10px', backgroundColor: ACCENT_BG, fontSize: '12px', color: ACCENT, fontWeight: '800', lineHeight: '1.4' }}>
          {payeurEstMoi
            ? `${nomElle} te verse ${fmt(virementMontant)} par mois`
            : `Tu verses ${fmt(virementMontant)} par mois à ${nomElle}`}
        </p>
      )}
    </div>
  );
}

// =====================================================================
// COMPOSANT PRINCIPAL
// =====================================================================
export function BudgetCommun({ utilisateur }) {
  const uid = utilisateur?.uid;

  const [partenaireUid, setPartenaireUid] = useState(null); // null = en chargement, '' = pas relié
  const [mois, setMois] = useState(moisCourant());
  const [data, setData] = useState(() => normaliser({}));
  const [charge, setCharge] = useState(false);
  const [statut, setStatut] = useState('');
  const [erreur, setErreur] = useState('');

  const pendingRef = useRef(pendingVide());
  const timerRef = useRef(null);
  const ctxRef = useRef({ docId: '', membres: [], mois });

  // Sans partenaire : mode solo (document à moi seule). L'autre personne est « autre ».
  const autreId = partenaireUid || 'autre';
  const membres = partenaireUid ? [uid, partenaireUid].sort() : [uid]; // pour Firestore
  const membresCalc = [uid, autreId].sort(); // pour les calculs
  const idMois = (m) => (partenaireUid ? `${membres.join('_')}_${m}` : `${uid}_solo_${m}`);
  const docId = partenaireUid === null ? '' : idMois(mois);
  ctxRef.current = { docId, membres, mois };
  const migreRef = useRef(new Set());

  // --- Qui est ma partenaire ? (défini dans l'accord de cohabitation) ---
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'accord_prive', uid),
      (snap) => setPartenaireUid(snap.exists() ? snap.data().partenaireUid || '' : ''),
      (e) => { console.error('Lecture accord_prive :', e); setPartenaireUid(''); }
    );
    return () => unsub();
  }, [uid]);

  // --- Envoi des modifications en attente ---
  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const p = pendingRef.current;
    if (estVide(p)) return;
    const ctx = ctxRef.current;
    if (!ctx.docId) return;
    pendingRef.current = pendingVide();
    try {
      await setDoc(
        doc(db, 'budget_commun', ctx.docId),
        { ...versFirestore(p), membres: ctx.membres, mois: ctx.mois, maj: serverTimestamp() },
        { merge: true }
      );
      setStatut('Enregistré ✓');
    } catch (e) {
      console.error("Erreur d'enregistrement du budget :", e);
      pendingRef.current = fusionner(p, pendingRef.current);
      setStatut("Erreur d'enregistrement");
    }
  }, []);

  // --- Écoute du budget du mois ---
  useEffect(() => {
    if (!uid || partenaireUid === null) return;
    setCharge(false);
    setData(normaliser({}));

    // Quand les comptes sont reliés : reprend le budget fait en solo pour ce mois
    const migrerDepuisSolo = async () => {
      try {
        const solo = await getDoc(doc(db, 'budget_commun', `${uid}_solo_${mois}`));
        if (!solo.exists()) return;
        const d = normaliser(solo.data());
        const remp = (u) => (u === 'autre' ? partenaireUid : u);
        const renommer = (o) => { const r = {}; Object.entries(o).forEach(([k, v]) => { r[remp(k)] = v; }); return r; };
        const lignes = {};
        Object.values(d.lignes).forEach((l) => { lignes[l.id] = { ...l, payePar: remp(l.payePar || '') }; });
        const soloA = [uid, 'autre'].sort()[0];
        const pctMoiSolo = soloA === uid ? num(d.partA) : 100 - num(d.partA);
        const mb = [uid, partenaireUid].sort();
        const partA = mb[0] === uid ? pctMoiSolo : 100 - pctMoiSolo;
        await setDoc(
          doc(db, 'budget_commun', docId),
          { ...propre({ membres: mb, mois, revenus: renommer(d.revenus), noms: renommer(d.noms), compte: renommer(d.compte), repartition: d.repartition, partA, lignes, valide: {} }), maj: serverTimestamp() },
          { merge: true }
        );
      } catch (e) {
        console.error('Reprise du budget solo :', e);
      }
    };

    const unsub = onSnapshot(
      doc(db, 'budget_commun', docId),
      (snap) => {
        if (!snap.exists() && partenaireUid && !migreRef.current.has(docId)) {
          migreRef.current.add(docId);
          migrerDepuisSolo();
        }
        const base = normaliser(snap.exists() ? snap.data() : {});
        setData(appliquerPending(base, pendingRef.current));
        setCharge(true);
      },
      (e) => {
        console.error('Lecture budget_commun :', e);
        setErreur('Impossible de lire le budget (règles Firestore à publier ?).');
        setCharge(true);
      }
    );
    return () => unsub();
  }, [uid, partenaireUid, docId]);

  // Quitter l'écran : on enregistre ce qui reste
  useEffect(() => () => { flush(); }, [flush]);

  // Applique une modification localement ET la met en file d'attente
  const modifier = (patch) => {
    const scalars = patch.scalars || {};
    let maps = patch.maps || {};
    // Toute modification annule les validations déjà données
    if (!patch.garderValide && partenaireUid && Object.values(data.valide || {}).some(Boolean)) {
      maps = { ...maps, valide: { [uid]: false, [partenaireUid]: false } };
    }
    const p = pendingRef.current;
    Object.assign(p.scalars, scalars);
    Object.entries(maps).forEach(([champ, m]) => { p.maps[champ] = { ...(p.maps[champ] || {}), ...m }; });
    setData((prev) => appliquerPending(prev, { scalars, maps }));
    setStatut('Enregistrement…');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 700);
  };

  const setScalar = (k, v) => modifier({ scalars: { [k]: v } });
  const setRevenu = (u, v) => modifier({ maps: { revenus: { [u]: v } } });
  const setNom = (u, v) => modifier({ maps: { noms: { [u]: v } } });
  const setCompte = (u, v) => modifier({ maps: { compte: { [u]: v } } });
  const setLigne = (l) => modifier({ maps: { lignes: { [l.id]: l } } });
  const supprLigne = (id) => modifier({ maps: { lignes: { [id]: SUPPR } } });
  const basculerValidation = () => modifier({ maps: { valide: { [uid]: !data.valide[uid] } }, garderValide: true });

  // Vide le mois affiché : lignes, revenus, virements du compte commun et validations.
  // (On garde les prénoms et le mode de répartition.)
  const viderMois = () => {
    const tout = (o) => Object.keys(o || {}).reduce((acc, k) => ({ ...acc, [k]: SUPPR }), {});
    const maps = {
      lignes: tout(data.lignes),
      revenus: tout(data.revenus),
      compte: tout(data.compte),
      valide: tout(data.valide)
    };
    modifier({ maps, garderValide: true });
  };

  const changerMois = async (delta) => {
    await flush();
    setMois((m) => decaler(m, delta));
  };

  const ajouterLigne = () => {
    const ordre = Math.max(-1, ...Object.values(data.lignes).map((x) => x.ordre ?? 0)) + 1;
    setLigne({ id: nouvelId('l'), nom: '', cat: 'fixe', type: 'Obligatoire', freq: 'mois', prevu: '', reel: '', paye: false, payePar: '', partage: '', ordre });
  };

  const demarrerModele = () => {
    const lignes = {};
    MODELE.forEach(([nom, type, freq, partage], i) => {
      const id = nouvelId('l');
      lignes[id] = { id, nom, cat: 'fixe', type, freq, prevu: '', reel: '', paye: false, payePar: '', partage, ordre: i };
    });
    modifier({ maps: { lignes } });
  };

  const reprendrePrecedent = async () => {
    try {
      const snap = await getDoc(doc(db, 'budget_commun', idMois(decaler(mois, -1))));
      if (!snap.exists()) { setErreur('Il n’y a pas de budget le mois précédent.'); return; }
      setErreur('');
      const d = normaliser(snap.data());
      const lignes = {};
      Object.values(d.lignes)
        .filter((l) => l.cat !== 'env')
        .forEach((l) => { lignes[l.id] = { ...l, reel: '', paye: false }; });
      modifier({
        scalars: { repartition: d.repartition, partA: d.partA },
        maps: { revenus: d.revenus, noms: d.noms, compte: d.compte, lignes }
      });
    } catch (e) {
      console.error('Erreur reprise du mois précédent :', e);
      setErreur('Impossible de reprendre le mois précédent.');
    }
  };

  // ------------------------------------------------------------------
  if (!uid) return null;
  if (partenaireUid === null) {
    return <p style={{ textAlign: 'center', color: '#B5A793', fontSize: '13.5px', padding: '40px 0' }}>Chargement…</p>;
  }
  if (!charge) {
    return <p style={{ textAlign: 'center', color: '#B5A793', fontSize: '13.5px', padding: '40px 0' }}>Chargement…</p>;
  }

  // --- Calculs ---
  const moisAContenu = ['lignes', 'revenus', 'compte', 'valide'].some((c) => Object.keys(data[c] || {}).length > 0);
  const A = membresCalc[0];
  const B = membresCalc[1];
  const iAmA = A === uid;
  const rev = (u) => num(data.revenus[u]);
  const totalRev = rev(A) + rev(B);

  let pctA;
  if (data.repartition === 'egal') pctA = 50;
  else if (data.repartition === 'manuel') pctA = Math.min(100, Math.max(0, num(data.partA)));
  else pctA = totalRev > 0 ? (rev(A) / totalRev) * 100 : 50;
  const pct = { [A]: pctA, [B]: 100 - pctA };
  const pctMoi = pct[uid];
  const pctElle = pct[autreId];

  // Part « au prorata des revenus » (50 / 50 tant que les revenus ne sont pas saisis)
  const prorataMoi = totalRev > 0 ? (rev(uid) / totalRev) * 100 : 50;

  // Mode et part de MA part pour une ligne donnée (la ligne peut déroger au global)
  const modeLigne = (l) => (l.partage === 'egal' ? 'egal' : l.partage === 'prorata' ? 'prorata' : data.repartition);
  const pctMoiLigne = (l) => (l.partage === 'egal' ? 50 : l.partage === 'prorata' ? prorataMoi : pctMoi);
  const propsPartage = (l) => {
    const pm = pctMoiLigne(l);
    return { pctMoi: pm, pctElle: 100 - pm, modeEff: modeLigne(l), modeGlobal: data.repartition };
  };

  const nomMoi = data.noms[uid] || 'Moi';
  const nomElle = data.noms[autreId] || 'Elle';

  // Dépenses fixes uniquement (les anciennes enveloppes sont ignorées)
  const lignes = Object.values(data.lignes)
    .filter((l) => l.cat !== 'env')
    .sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));

  const resteLigne = (l) => (l.paye ? 0 : Math.max(prevuMois(l) - num(l.reel), 0));
  const totPrevu = lignes.reduce((s, l) => s + prevuMois(l), 0);
  const totReel = lignes.reduce((s, l) => s + num(l.reel), 0);
  const totReste = lignes.reduce((s, l) => s + resteLigne(l), 0);
  const avancement = totPrevu > 0 ? Math.min((totReel / totPrevu) * 100, 100) : 0;

  // Totaux par personne (en tenant compte du mode de partage de chaque ligne)
  const sommeMoi = (fn) => lignes.reduce((s, l) => s + (fn(l) * pctMoiLigne(l)) / 100, 0);
  const prevuMoi = sommeMoi(prevuMois);
  const prevuElle = totPrevu - prevuMoi;
  const resteMoi = sommeMoi(resteLigne);
  const resteElle = totReste - resteMoi;
  const partEffMoi = totPrevu > 0 ? (prevuMoi / totPrevu) * 100 : pctMoi;
  const partEffElle = 100 - partEffMoi;

  // Compte commun (variable) : virement mensuel de chacun
  const compteMoi = num(data.compte[uid]);
  const compteElle = num(data.compte[autreId]);
  const totCompte = compteMoi + compteElle;

  // Total à prévoir chaque mois = dépenses fixes + virement compte commun
  const totalMoi = prevuMoi + compteMoi;
  const totalElle = prevuElle + compteElle;

  // Équilibre : qui a avancé de l'argent pour l'autre ? (positif = elle me doit)
  let equilibre = 0;
  let aDesPayeurs = false;
  lignes.forEach((l) => {
    const r = num(l.reel);
    if (!r || !l.payePar) return;
    aDesPayeurs = true;
    equilibre += (l.payePar === uid ? r : 0) - (r * pctMoiLigne(l)) / 100;
  });

  // Virement mensuel entre vous (sur le prévu ramené au mois, lignes avec « Payé par »)
  let elleMeDoit = 0; // ce que l'autre doit me verser (j'ai avancé)
  let jeLuiDois = 0; // ce que je dois lui verser (elle a avancé)
  let aDesVirements = false;
  lignes.forEach((l) => {
    const p = prevuMois(l);
    if (!p || !l.payePar) return;
    const pm = pctMoiLigne(l);
    if (l.payePar === uid) { elleMeDoit += (p * (100 - pm)) / 100; aDesVirements = true; }
    else if (l.payePar === autreId) { jeLuiDois += (p * pm) / 100; aDesVirements = true; }
  });
  const virementNet = elleMeDoit - jeLuiDois; // > 0 : elle me verse ; < 0 : je lui verse

  const partRevenu = (u) => {
    const part = u === uid ? totalMoi : totalElle;
    return rev(u) > 0 ? pc((part / rev(u)) * 100) : '—';
  };

  const ligneTab = (label, a, b, fort) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '6px', padding: '7px 0', borderTop: '1px solid #F1E8D8', fontWeight: fort ? '800' : '600', fontSize: '12.5px' }}>
      <span style={{ color: '#2B2420' }}>{label}</span>
      <span style={{ textAlign: 'right', color: '#2B2420' }}>{a}</span>
      <span style={{ textAlign: 'right', color: '#2B2420' }}>{b}</span>
    </div>
  );

  const colonnePersonne = (u, couleur, estMoi) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={labelStyle}>{estMoi ? 'Ton prénom' : 'Son prénom'}</label>
      <input type="text" value={data.noms[u] || ''} placeholder={estMoi ? 'Moi' : 'Elle'} onChange={(e) => setNom(u, e.target.value)} style={{ ...inputStyle, marginBottom: '9px' }} />
      <label style={labelStyle}>Revenu net / mois</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input type="number" inputMode="decimal" step="any" value={data.revenus[u] ?? ''} onChange={(e) => setRevenu(u, e.target.value)} style={inputStyle} />
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#B5A793', flexShrink: 0 }}>CHF</span>
      </div>
      <p style={{ margin: '12px 0 0 0', textAlign: 'center', fontSize: '30px', fontWeight: '800', color: couleur, fontFamily: SERIF }}>{pc(pct[u])}</p>
    </div>
  );

  const colonneCompte = (u, nom, couleur) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ ...labelStyle, color: couleur, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom} verse</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input type="number" inputMode="decimal" step="any" placeholder="0" value={data.compte[u] ?? ''} onChange={(e) => setCompte(u, e.target.value)} style={inputStyle} />
        <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#B5A793', flexShrink: 0 }}>CHF</span>
      </div>
    </div>
  );

  const modes = [['prorata', 'Au prorata des revenus'], ['egal', '50 / 50'], ['manuel', 'Je choisis']];

  return (
    <div>
      {erreur && (
        <div style={{ padding: '11px 14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #F3D2D0', color: ROUGE, fontSize: '12.5px', fontWeight: '700', marginBottom: '14px' }}>
          {erreur}
        </div>
      )}

      {!partenaireUid && (
        <div style={{ padding: '11px 14px', borderRadius: '12px', backgroundColor: ACCENT_BG, color: ACCENT, fontSize: '12.5px', fontWeight: '700', lineHeight: '1.45', marginBottom: '14px' }}>
          Mode solo : remplis tout de ton côté. Quand vous reliez vos comptes (dans « Notre accord »), ton budget est repris automatiquement et elle n’a plus qu’à valider.
        </div>
      )}

      {/* Mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button type="button" onClick={() => changerMois(-1)} style={petitBouton}><IconChevronLeft size={24} /></button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#2B2420', fontFamily: SERIF }}>{libelleMois(mois)}</p>
            {moisAContenu && (
              <button
                type="button"
                title="Vider ce mois"
                aria-label="Vider ce mois"
                onClick={() => {
                  if (window.confirm(`Vider tout le budget de ${libelleMois(mois)} ? Dépenses, revenus, compte commun et validations seront effacés.`)) viderMois();
                }}
                style={{ ...petitBouton, color: ROUGE }}
              >
                <IconTrash size={17} />
              </button>
            )}
          </div>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', fontWeight: '700', color: statut.startsWith('Erreur') ? ROUGE : '#B5A793', minHeight: '14px' }}>{statut}</p>
        </div>
        <button type="button" onClick={() => changerMois(1)} style={petitBouton}><IconChevronRight size={24} /></button>
      </div>

      {/* Répartition */}
      <div style={carte}>
        <p style={titreCarte}>QUI PAIE QUELLE PART ?</p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {colonnePersonne(uid, ACCENT, true)}
          {colonnePersonne(autreId, BLEU, false)}
        </div>

        <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', backgroundColor: '#F1E8D8', marginBottom: '14px' }}>
          <div style={{ width: `${pctMoi}%`, backgroundColor: ACCENT, transition: 'width .3s' }} />
          <div style={{ width: `${pctElle}%`, backgroundColor: BLEU, transition: 'width .3s' }} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
          {modes.map(([id, titre]) => (
            <button
              key={id}
              type="button"
              onClick={() => setScalar('repartition', id)}
              style={{
                padding: '8px 12px', borderRadius: '999px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit',
                border: data.repartition === id ? `1.5px solid ${ACCENT}` : '1.5px solid #E8DFCF',
                backgroundColor: data.repartition === id ? ACCENT_BG : '#FFFFFF',
                color: data.repartition === id ? ACCENT : '#8A7B68'
              }}
            >
              {titre}
            </button>
          ))}
        </div>

        {data.repartition === 'manuel' && (
          <div style={{ marginTop: '14px' }}>
            <label style={labelStyle}>Ta part : {pc(pctMoi)} — la sienne : {pc(pctElle)}</label>
            <input
              type="range" min="0" max="100" step="1"
              value={Math.round(pctMoi)}
              onChange={(e) => { const v = Number(e.target.value); setScalar('partA', iAmA ? v : 100 - v); }}
              style={{ width: '100%', accentColor: ACCENT }}
            />
          </div>
        )}
        {data.repartition === 'prorata' && totalRev <= 0 && (
          <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#B5A793', lineHeight: '1.45' }}>
            Entrez vos deux revenus pour calculer le prorata. En attendant, c’est 50 / 50.
          </p>
        )}

        <p style={{ margin: '12px 0 0 0', fontSize: '11.5px', color: '#B5A793', lineHeight: '1.45', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          Ce choix s’applique aux dépenses fixes. Sur chaque ligne, l’icône <IconScale size={13} /> / <IconEqual size={13} /> permet de forcer 50/50 ou prorata.
        </p>
      </div>

      {/* Compte commun (variable) */}
      <div style={carte}>
        <p style={titreCarte}>COMPTE COMMUN — LE VARIABLE</p>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#8A7B68', lineHeight: '1.5' }}>
          Bouffe, maison, sorties à deux… Chacun vire un montant chaque mois, tout se dépense à 50/50 depuis ce compte. Le détail se voit dans Revolut.
        </p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {colonneCompte(uid, nomMoi, ACCENT)}
          {colonneCompte(autreId, nomElle, BLEU)}
        </div>
        <div style={{ backgroundColor: '#F7F1E8', borderRadius: '12px', padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#8A7B68' }}>Total sur le compte chaque mois</span>
          <span style={{ fontSize: '16px', fontWeight: '800', color: '#2B2420', fontFamily: SERIF }}>{fmt(totCompte)}</span>
        </div>
      </div>

      {/* Récapitulatif */}
      <div style={{ ...carte, textAlign: 'center' }}>
        <p style={{ ...titreCarte, marginBottom: '4px' }}>RESTE À PAYER CE MOIS (DÉPENSES FIXES)</p>
        <p style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '800', color: '#2B2420', fontFamily: SERIF }}>{fmt(totReste)}</p>
        <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#F1E8D8', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ height: '100%', width: `${avancement}%`, backgroundColor: totReel > totPrevu && totPrevu > 0 ? ROUGE : VERT, transition: 'width .3s' }} />
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#8A7B68', fontWeight: '600' }}>
          prévu {fmt(totPrevu)} · payé {fmt(totReel)}
        </p>

        <div style={{ backgroundColor: '#F7F1E8', borderRadius: '14px', padding: '12px 14px', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '6px', fontWeight: '800', fontSize: '12.5px' }}>
            <span />
            <span style={{ textAlign: 'right', color: ACCENT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomMoi}</span>
            <span style={{ textAlign: 'right', color: BLEU, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomElle}</span>
          </div>
          {ligneTab('Part des fixes', pc(partEffMoi), pc(partEffElle))}
          {ligneTab('Dépenses fixes / mois', fmt(prevuMoi), fmt(prevuElle))}
          {ligneTab('Compte commun / mois', fmt(compteMoi), fmt(compteElle))}
          {ligneTab('Total à prévoir / mois', fmt(totalMoi), fmt(totalElle), true)}
          {ligneTab('Part du revenu net', partRevenu(uid), partRevenu(autreId))}
          {ligneTab('Fixes restant à payer', fmt(resteMoi), fmt(resteElle))}
        </div>

        {aDesPayeurs && (
          <p style={{ margin: '12px 0 0 0', fontSize: '13px', fontWeight: '800', color: Math.abs(equilibre) < 0.005 ? VERT : ACCENT }}>
            {Math.abs(equilibre) < 0.005
              ? 'Vous êtes à l’équilibre ✓'
              : equilibre > 0
                ? `${nomElle} te doit ${fmt(equilibre)}`
                : `Tu dois ${fmt(-equilibre)} à ${nomElle}`}
          </p>
        )}
      </div>

      {/* Virement mensuel entre vous */}
      {aDesVirements && (
        <div style={{ ...carte, textAlign: 'center' }}>
          <p style={{ ...titreCarte, marginBottom: '6px' }}>À SE VERSER CHAQUE MOIS</p>
          <p style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: '800', color: Math.abs(virementNet) < 0.005 ? VERT : ACCENT, lineHeight: '1.4' }}>
            {Math.abs(virementNet) < 0.005
              ? 'Rien à se verser : c’est équilibré ✓'
              : virementNet > 0
                ? `${nomElle} verse ${fmt(virementNet)} à ${nomMoi}`
                : `${nomMoi} verse ${fmt(-virementNet)} à ${nomElle}`}
          </p>
          <div style={{ backgroundColor: '#F7F1E8', borderRadius: '14px', padding: '10px 14px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', fontWeight: '600', color: '#2B2420', padding: '3px 0' }}>
              <span>{nomElle} → {nomMoi}</span>
              <span style={{ fontWeight: '800' }}>{fmt(elleMeDoit)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', fontWeight: '600', color: '#2B2420', padding: '3px 0' }}>
              <span>{nomMoi} → {nomElle}</span>
              <span style={{ fontWeight: '800' }}>{fmt(jeLuiDois)}</span>
            </div>
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#B5A793', lineHeight: '1.45' }}>
            Calculé sur le prévu ramené au mois, pour les dépenses fixes où « Payé par » est renseigné. Le compte commun n’est pas compté ici.
          </p>
        </div>
      )}

      {/* Validation */}
      {partenaireUid && (lignes.length > 0 || totCompte > 0) && (
        <div style={carte}>
          <p style={titreCarte}>VALIDATION DU MOIS</p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            {[[uid, nomMoi, ACCENT], [partenaireUid, nomElle, BLEU]].map(([u, nom, couleur]) => (
              <div key={u} style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '10px 6px', borderRadius: '12px', backgroundColor: data.valide[u] ? '#E6F9F1' : '#F7F1E8' }}>
                <p style={{ margin: '0 0 3px 0', fontSize: '12.5px', fontWeight: '800', color: couleur, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nom}</p>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: data.valide[u] ? VERT : '#B5A793' }}>{data.valide[u] ? '✓ validé' : 'en attente'}</p>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={basculerValidation}
            style={{ width: '100%', padding: '12px', borderRadius: '12px', border: data.valide[uid] ? '1px solid #E8DFCF' : 'none', backgroundColor: data.valide[uid] ? '#FFFFFF' : ACCENT, color: data.valide[uid] ? '#8A7B68' : '#FFFFFF', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}
          >
            {data.valide[uid] ? 'Retirer ma validation' : 'Valider ce budget'}
          </button>
          <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#B5A793', textAlign: 'center' }}>Si quelqu’un modifie un montant, les validations sont remises à zéro.</p>
        </div>
      )}

      {/* Démarrage */}
      {lignes.length === 0 && (
        <div style={{ ...carte, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>Aucune dépense fixe ce mois. Par où commencer ?</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={demarrerModele} style={{ flex: 1, minWidth: '150px', padding: '11px', borderRadius: '12px', border: 'none', backgroundColor: ACCENT, color: '#FFFFFF', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}>
              Partir d’un modèle
            </button>
            <button type="button" onClick={reprendrePrecedent} style={{ flex: 1, minWidth: '150px', padding: '11px', borderRadius: '12px', border: `1.5px solid ${ACCENT}`, backgroundColor: '#FFFFFF', color: ACCENT, fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}>
              Reprendre le mois précédent
            </button>
          </div>
        </div>
      )}

      {/* Dépenses fixes */}
      <div style={{ backgroundColor: ACCENT_BG, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '17px', fontWeight: '800', color: ACCENT, fontFamily: SERIF }}>Dépenses fixes</span>
        <span style={{ fontSize: '14px', fontWeight: '800', color: ACCENT }}>{fmt(totPrevu)} / mois</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
        {lignes.map((l) => (
          <LigneBudget
            key={l.id} l={l} onChange={setLigne}
            onDelete={() => { if (window.confirm('Supprimer cette ligne ?')) supprLigne(l.id); }}
            {...propsPartage(l)}
            nomMoi={nomMoi} nomElle={nomElle} uid={uid} partenaireUid={autreId}
          />
        ))}
      </div>
      <button
        type="button" onClick={ajouterLigne}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1.5px dashed ${ACCENT}`, background: 'transparent', borderRadius: '12px', padding: '11px', color: ACCENT, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
      >
        <IconPlus size={15} /> Ajouter une dépense fixe
      </button>
    </div>
  );
}
