import React, { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, setDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { IconChevronLeft, IconChevronRight, IconPlus, IconTrash, IconCheck } from '@tabler/icons-react';

// =====================================================================
// BUDGET COMMUN — un budget par mois, partagé entre vous deux.
//
// Données : budget_commun/{uidA}_{uidB}_{AAAA-MM}   (uidA/uidB triés)
//   membres      : [uidA, uidB]
//   mois         : 'AAAA-MM'
//   noms         : { uid: prénom }
//   revenus      : { uid: revenu net mensuel }
//   repartition  : 'prorata' | 'egal' | 'manuel'
//   partA        : % payé par uidA quand repartition === 'manuel'
//   lignes       : { idLigne: { id, nom, cat: 'fixe'|'env', type, prevu, reel, paye, payePar, ordre } }
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
const ORANGE = '#D98E2B';
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

const num = (x) => {
  const n = parseFloat(String(x ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n) =>
  `${(Math.round(n * 100) / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CHF`;
const pc = (n) => `${(Math.round(n * 10) / 10).toString().replace('.', ',')} %`;

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
const MODELE = [
  ['Loyer + charges', 'fixe', 'Obligatoire'],
  ['Électricité', 'fixe', 'Obligatoire'],
  ['Internet', 'fixe', 'Obligatoire'],
  ['Assurance ménage (RC)', 'fixe', 'Obligatoire'],
  ['Redevance radio/TV', 'fixe', 'Obligatoire'],
  ['Abonnements partagés (Netflix…)', 'fixe', 'Plaisir'],
  ['Courses', 'env', 'Obligatoire'],
  ['Produits ménagers & maison', 'env', 'Obligatoire'],
  ['Restaurants', 'env', 'Plaisir'],
  ['Loisirs', 'env', 'Plaisir'],
  ['Imprévus', 'env', 'Obligatoire']
];

// --- Gestion des modifications en attente (envoyées par petits morceaux) ---
const pendingVide = () => ({ scalars: {}, maps: {} });
const estVide = (p) => Object.keys(p.scalars).length === 0 && Object.keys(p.maps).length === 0;

function normaliser(d) {
  return {
    revenus: d?.revenus || {},
    noms: d?.noms || {},
    repartition: d?.repartition || 'prorata',
    partA: d?.partA ?? 50,
    lignes: d?.lignes || {}
  };
}

function appliquerPending(base, p) {
  const out = { ...base, revenus: { ...base.revenus }, noms: { ...base.noms }, lignes: { ...base.lignes } };
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
// UNE LIGNE DE DÉPENSE
// =====================================================================
function LigneBudget({ l, onChange, onDelete, pctMoi, pctElle, nomMoi, nomElle, uid, partenaireUid }) {
  const [ajout, setAjout] = useState('');
  const env = l.cat === 'env';
  const prevu = num(l.prevu);
  const reel = num(l.reel);
  const reste = env || !l.paye ? Math.max(prevu - reel, 0) : 0;
  const depasse = prevu > 0 && reel > prevu ? reel - prevu : 0;
  const pctUtilise = prevu > 0 ? (reel / prevu) * 100 : 0;
  const set = (patch) => onChange({ ...l, ...patch });

  const bascule = () => {
    const paye = !l.paye;
    set({ paye, reel: paye && !l.reel ? l.prevu : l.reel });
  };

  const petit = { ...inputStyle, padding: '8px 10px', fontSize: '14px' };
  const mini = (label, contenu) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ ...labelStyle, fontSize: '10.5px', marginBottom: '3px' }}>{label}</label>
      {contenu}
    </div>
  );

  return (
    <div style={{ backgroundColor: !env && l.paye ? '#F6FBF8' : '#FFFFFF', border: `1px solid ${!env && l.paye ? '#CFE8DB' : '#E8DFCF'}`, borderRadius: '14px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
        {!env && (
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
        )}
        <input
          type="text"
          value={l.nom || ''}
          placeholder="Nom de la dépense"
          onChange={(e) => set({ nom: e.target.value })}
          style={{ ...petit, fontWeight: '800', fontSize: '14.5px' }}
        />
        <button type="button" onClick={onDelete} style={{ ...petitBouton, color: ROUGE }}><IconTrash size={16} /></button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        {mini('Prévu', <input type="number" inputMode="decimal" step="any" value={l.prevu ?? ''} onChange={(e) => set({ prevu: e.target.value })} style={petit} />)}
        {mini(env ? 'Dépensé' : 'Réel', <input type="number" inputMode="decimal" step="any" value={l.reel ?? ''} onChange={(e) => set({ reel: e.target.value })} style={petit} />)}
        {mini('Reste', (
          <div style={{ padding: '8px 2px', fontSize: '14px', fontWeight: '800', color: depasse ? ROUGE : '#2B2420' }}>
            {depasse ? `+${fmt(depasse)}` : fmt(reste)}
          </div>
        ))}
      </div>

      {env && prevu > 0 && (
        <div style={{ height: '6px', borderRadius: '999px', backgroundColor: '#F1E8D8', overflow: 'hidden', marginBottom: '9px' }}>
          <div style={{ height: '100%', width: `${Math.min(pctUtilise, 100)}%`, backgroundColor: pctUtilise > 100 ? ROUGE : pctUtilise >= 80 ? ORANGE : ACCENT }} />
        </div>
      )}

      {env ? (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input type="number" inputMode="decimal" step="any" placeholder="Ajouter une dépense…" value={ajout} onChange={(e) => setAjout(e.target.value)} style={petit} />
          <button
            type="button"
            disabled={!num(ajout)}
            onClick={() => { set({ reel: String(Math.round((reel + num(ajout)) * 100) / 100) }); setAjout(''); }}
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: '11px', border: 'none', backgroundColor: num(ajout) ? ACCENT : '#E8DFCF', color: '#FFFFFF', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
          >
            Ajouter
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => set({ type: l.type === 'Plaisir' ? 'Obligatoire' : 'Plaisir' })}
            style={{ padding: '6px 11px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontSize: '11.5px', fontWeight: '800', color: l.type === 'Plaisir' ? BLEU : ACCENT, backgroundColor: l.type === 'Plaisir' ? BLEU_BG : ACCENT_BG }}
          >
            {l.type === 'Plaisir' ? 'Plaisir' : 'Obligatoire'}
          </button>
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
      )}

      {prevu > 0 && (
        <p style={{ margin: '8px 0 0 0', fontSize: '11.5px', color: '#8A7B68', fontWeight: '600' }}>
          {nomMoi} {fmt((prevu * pctMoi) / 100)} · {nomElle} {fmt((prevu * pctElle) / 100)}
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

  const membres = partenaireUid ? [uid, partenaireUid].sort() : [];
  const docId = partenaireUid ? `${membres.join('_')}_${mois}` : '';
  ctxRef.current = { docId, membres, mois };

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
    if (!uid || !partenaireUid) return;
    setCharge(false);
    setData(normaliser({}));
    const unsub = onSnapshot(
      doc(db, 'budget_commun', docId),
      (snap) => {
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
    const maps = patch.maps || {};
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
  const setLigne = (l) => modifier({ maps: { lignes: { [l.id]: l } } });
  const supprLigne = (id) => modifier({ maps: { lignes: { [id]: SUPPR } } });

  const changerMois = async (delta) => {
    await flush();
    setMois((m) => decaler(m, delta));
  };

  const ajouterLigne = (cat) => {
    const ordre = Math.max(-1, ...Object.values(data.lignes).map((x) => x.ordre ?? 0)) + 1;
    setLigne({ id: nouvelId('l'), nom: '', cat, type: cat === 'fixe' ? 'Obligatoire' : 'Plaisir', prevu: '', reel: '', paye: false, payePar: '', ordre });
  };

  const demarrerModele = () => {
    const lignes = {};
    MODELE.forEach(([nom, cat, type], i) => {
      const id = nouvelId('l');
      lignes[id] = { id, nom, cat, type, prevu: '', reel: '', paye: false, payePar: '', ordre: i };
    });
    modifier({ maps: { lignes } });
  };

  const reprendrePrecedent = async () => {
    try {
      const snap = await getDoc(doc(db, 'budget_commun', `${membres.join('_')}_${decaler(mois, -1)}`));
      if (!snap.exists()) { setErreur('Il n’y a pas de budget le mois précédent.'); return; }
      setErreur('');
      const d = normaliser(snap.data());
      const lignes = {};
      Object.values(d.lignes).forEach((l) => { lignes[l.id] = { ...l, reel: '', paye: false }; });
      modifier({
        scalars: { repartition: d.repartition, partA: d.partA },
        maps: { revenus: d.revenus, noms: d.noms, lignes }
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
  if (!partenaireUid) {
    return (
      <div style={{ ...carte, textAlign: 'center', padding: '28px 18px' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '800', color: '#2B2420' }}>Relie d’abord vos deux comptes</p>
        <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.5' }}>
          Le budget est partagé à deux. Colle le code de ta partenaire dans l’accord de cohabitation (« Relier vos deux comptes »), puis reviens ici.
        </p>
      </div>
    );
  }
  if (!charge) {
    return <p style={{ textAlign: 'center', color: '#B5A793', fontSize: '13.5px', padding: '40px 0' }}>Chargement…</p>;
  }

  // --- Calculs ---
  const A = membres[0];
  const B = membres[1];
  const iAmA = A === uid;
  const rev = (u) => num(data.revenus[u]);
  const totalRev = rev(A) + rev(B);

  let pctA;
  if (data.repartition === 'egal') pctA = 50;
  else if (data.repartition === 'manuel') pctA = Math.min(100, Math.max(0, num(data.partA)));
  else pctA = totalRev > 0 ? (rev(A) / totalRev) * 100 : 50;
  const pct = { [A]: pctA, [B]: 100 - pctA };
  const pctMoi = pct[uid];
  const pctElle = pct[partenaireUid];

  const nomMoi = data.noms[uid] || 'Moi';
  const nomElle = data.noms[partenaireUid] || 'Elle';

  const lignes = Object.values(data.lignes).sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
  const fixes = lignes.filter((l) => l.cat !== 'env');
  const envs = lignes.filter((l) => l.cat === 'env');

  const resteLigne = (l) => (l.cat === 'env' || !l.paye ? Math.max(num(l.prevu) - num(l.reel), 0) : 0);
  const totPrevu = lignes.reduce((s, l) => s + num(l.prevu), 0);
  const totReel = lignes.reduce((s, l) => s + num(l.reel), 0);
  const totReste = lignes.reduce((s, l) => s + resteLigne(l), 0);
  const totPrevuFixes = fixes.reduce((s, l) => s + num(l.prevu), 0);
  const avancement = totPrevu > 0 ? Math.min((totReel / totPrevu) * 100, 100) : 0;

  // Équilibre : qui a avancé de l'argent pour l'autre ? (positif = elle me doit)
  let equilibre = 0;
  let aDesPayeurs = false;
  lignes.forEach((l) => {
    const r = num(l.reel);
    if (!r || !l.payePar) return;
    aDesPayeurs = true;
    equilibre += (l.payePar === uid ? r : 0) - (r * pctMoi) / 100;
  });

  const partRevenu = (u) => (rev(u) > 0 ? pc(((totPrevu * pct[u]) / 100 / rev(u)) * 100) : '—');

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

  const modes = [['prorata', 'Au prorata des revenus'], ['egal', '50 / 50'], ['manuel', 'Je choisis']];

  return (
    <div>
      {erreur && (
        <div style={{ padding: '11px 14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #F3D2D0', color: ROUGE, fontSize: '12.5px', fontWeight: '700', marginBottom: '14px' }}>
          {erreur}
        </div>
      )}

      {/* Mois */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button type="button" onClick={() => changerMois(-1)} style={petitBouton}><IconChevronLeft size={24} /></button>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#2B2420', fontFamily: SERIF }}>{libelleMois(mois)}</p>
          <p style={{ margin: '2px 0 0 0', fontSize: '11.5px', fontWeight: '700', color: statut.startsWith('Erreur') ? ROUGE : '#B5A793', minHeight: '14px' }}>{statut}</p>
        </div>
        <button type="button" onClick={() => changerMois(1)} style={petitBouton}><IconChevronRight size={24} /></button>
      </div>

      {/* Répartition */}
      <div style={carte}>
        <p style={titreCarte}>QUI PAIE QUELLE PART ?</p>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
          {colonnePersonne(uid, ACCENT, true)}
          {colonnePersonne(partenaireUid, BLEU, false)}
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
      </div>

      {/* Reste à payer */}
      <div style={{ ...carte, textAlign: 'center' }}>
        <p style={{ ...titreCarte, marginBottom: '4px' }}>RESTE À PAYER CE MOIS</p>
        <p style={{ margin: '0 0 10px 0', fontSize: '32px', fontWeight: '800', color: '#2B2420', fontFamily: SERIF }}>{fmt(totReste)}</p>
        <div style={{ height: '8px', borderRadius: '999px', backgroundColor: '#F1E8D8', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{ height: '100%', width: `${avancement}%`, backgroundColor: totReel > totPrevu && totPrevu > 0 ? ROUGE : VERT, transition: 'width .3s' }} />
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#8A7B68', fontWeight: '600' }}>
          prévu {fmt(totPrevu)} · dépensé {fmt(totReel)}
        </p>

        <div style={{ backgroundColor: '#F7F1E8', borderRadius: '14px', padding: '12px 14px', textAlign: 'left' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '6px', fontWeight: '800', fontSize: '12.5px' }}>
            <span />
            <span style={{ textAlign: 'right', color: ACCENT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomMoi}</span>
            <span style={{ textAlign: 'right', color: BLEU, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomElle}</span>
          </div>
          {ligneTab('Part', pc(pctMoi), pc(pctElle))}
          {ligneTab('Prévu', fmt((totPrevu * pctMoi) / 100), fmt((totPrevu * pctElle) / 100))}
          {ligneTab('Déjà dépensé', fmt((totReel * pctMoi) / 100), fmt((totReel * pctElle) / 100))}
          {ligneTab('Reste à payer', fmt((totReste * pctMoi) / 100), fmt((totReste * pctElle) / 100), true)}
          {ligneTab('Part du revenu net', partRevenu(uid), partRevenu(partenaireUid))}
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

      {/* Démarrage */}
      {lignes.length === 0 && (
        <div style={{ ...carte, textAlign: 'center' }}>
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>Ce mois est vide. Par où commencer ?</p>
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

      {/* Barres des enveloppes */}
      {envs.length > 0 && (
        <div style={carte}>
          <p style={titreCarte}>ENVELOPPES — % DÉPENSÉ</p>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '4px', justifyContent: envs.length <= 5 ? 'space-around' : 'flex-start' }}>
            {envs.map((e) => {
              const p = num(e.prevu) > 0 ? (num(e.reel) / num(e.prevu)) * 100 : 0;
              const couleur = p > 100 ? ROUGE : p >= 80 ? ORANGE : ACCENT;
              return (
                <div key={e.id} style={{ flex: '0 0 auto', width: '58px', textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: '800', color: couleur, marginBottom: '4px' }}>{Math.round(p)}%</div>
                  <div style={{ height: '90px', borderRadius: '10px', backgroundColor: '#F1E8D8', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: `${Math.min(p, 100)}%`, backgroundColor: couleur, transition: 'height .3s' }} />
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#8A7B68', fontWeight: '700', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nom || '—'}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dépenses fixes */}
      <div style={{ backgroundColor: ACCENT_BG, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '17px', fontWeight: '800', color: ACCENT, fontFamily: SERIF }}>Dépenses fixes</span>
        <span style={{ fontSize: '15px', fontWeight: '800', color: ACCENT }}>{fmt(totPrevuFixes)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
        {fixes.map((l) => (
          <LigneBudget
            key={l.id} l={l} onChange={setLigne}
            onDelete={() => { if (window.confirm('Supprimer cette ligne ?')) supprLigne(l.id); }}
            pctMoi={pctMoi} pctElle={pctElle} nomMoi={nomMoi} nomElle={nomElle} uid={uid} partenaireUid={partenaireUid}
          />
        ))}
      </div>
      <button
        type="button" onClick={() => ajouterLigne('fixe')}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1.5px dashed ${ACCENT}`, background: 'transparent', borderRadius: '12px', padding: '11px', color: ACCENT, fontSize: '13px', fontWeight: '800', cursor: 'pointer', marginBottom: '22px' }}
      >
        <IconPlus size={15} /> Ajouter une dépense fixe
      </button>

      {/* Enveloppes */}
      <div style={{ backgroundColor: BLEU_BG, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '17px', fontWeight: '800', color: BLEU, fontFamily: SERIF }}>Enveloppes</span>
        <span style={{ fontSize: '12px', fontWeight: '700', color: BLEU }}>courses, loisirs…</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
        {envs.map((l) => (
          <LigneBudget
            key={l.id} l={l} onChange={setLigne}
            onDelete={() => { if (window.confirm('Supprimer cette enveloppe ?')) supprLigne(l.id); }}
            pctMoi={pctMoi} pctElle={pctElle} nomMoi={nomMoi} nomElle={nomElle} uid={uid} partenaireUid={partenaireUid}
          />
        ))}
      </div>
      <button
        type="button" onClick={() => ajouterLigne('env')}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1.5px dashed #D9CDB8', background: 'transparent', borderRadius: '12px', padding: '11px', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
      >
        <IconPlus size={15} /> Ajouter une enveloppe
      </button>
    </div>
  );
}
