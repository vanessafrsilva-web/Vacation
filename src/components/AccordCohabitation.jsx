import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck, IconLock, IconLockOpen,
  IconChevronRight, IconCopy, IconUsers, IconRefresh
} from '@tabler/icons-react';
import { SECTIONS, LOYER_NET, PARKING_P1, PARKING_P2, chf, calcParts } from './accordSchema';

// =====================================================================
// ACCORD DE COHABITATION — formulaire privé, partage par section
//
// Données :
//  - accord_prive/{uid}            → tes réponses (personne d'autre ne peut les lire)
//  - accord_partages/{uid}_{sec}   → une copie d'UNE section, créée quand TU
//                                    décides de la partager avec ta partenaire
// =====================================================================

const ACCENT = '#9A6B87';
const ACCENT_BG = '#F3ECF1';

const inputStyle = {
  width: '100%', padding: '11px 12px', borderRadius: '12px', border: '1px solid #E8DFCF',
  backgroundColor: '#FFFFFF', color: '#2B2420', fontSize: '15px', outline: 'none',
  boxSizing: 'border-box', fontFamily: 'inherit'
};
const labelStyle = { fontSize: '11.5px', color: '#8A7B68', fontWeight: '700', display: 'block', marginBottom: '5px', lineHeight: '1.35' };

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Comparaison stable (l'ordre des clés ne compte pas)
function stable(o) {
  if (Array.isArray(o)) return `[${o.map(stable).join(',')}]`;
  if (o && typeof o === 'object') {
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stable(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(o === undefined ? null : o);
}

// ---------------------------------------------------------------------
// Aplatir une section en "feuilles" (une feuille = une réponse possible)
// Sert à compter les réponses et à comparer.
// ---------------------------------------------------------------------
function aplatir(section) {
  const out = [];
  section.blocs.forEach((b) => {
    b.champs.forEach((c) => {
      if (c.type === 'info' || c.type === 'loyerCalc') return;
      if (c.type === 'grille') {
        c.lignes.forEach((lg) => {
          c.colonnes.forEach((col) => {
            out.push({
              bloc: b.titre || '', label: `${lg.label} — ${col.label}`, type: col.type, unite: col.unite,
              get: (d) => d?.[c.id]?.[lg.id]?.[col.id]
            });
          });
        });
      } else if (c.type === 'tableau') {
        out.push({ bloc: b.titre || '', label: c.label, type: 'tableau', champ: c, get: (d) => d?.[c.id] });
      } else {
        out.push({ bloc: b.titre || '', label: c.label, type: c.type, unite: c.unite, get: (d) => d?.[c.id] });
      }
    });
  });
  return out;
}

function valeurEnTexte(feuille, v, nomme) {
  if (v === undefined || v === null || v === '') return '';
  if (feuille.type === 'cases') return Array.isArray(v) && v.length ? v.map(nomme).join(' · ') : '';
  if (feuille.type === 'date') return formatDate(v);
  if (feuille.type === 'nombre') return `${v}${feuille.unite ? ` ${feuille.unite}` : ''}`;
  if (feuille.type === 'choix') return nomme(String(v));
  if (feuille.type === 'tableau') {
    if (!Array.isArray(v)) return '';
    return v
      .map((row, i) => {
        const morceaux = feuille.champ.colonnes
          .filter((col) => col.type !== 'calc')
          .map((col) => {
            const x = row?.[col.id];
            if (x === undefined || x === '') return '';
            return col.type === 'date' ? formatDate(x) : `${x}${col.type === 'nombre' && col.unite ? ` ${col.unite}` : ''}`;
          })
          .filter(Boolean);
        return morceaux.length ? `${i + 1}. ${morceaux.join(' | ')}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(v);
}

function compterReponses(section, donnees) {
  const feuilles = aplatir(section);
  const faites = feuilles.filter((f) => valeurEnTexte(f, f.get(donnees), (s) => s) !== '').length;
  return { faites, total: feuilles.length };
}

// =====================================================================
// CHAMPS DE SAISIE
// =====================================================================
function Chips({ options, valeur, multiple, onChange, nomme }) {
  const choisi = (o) => (multiple ? (valeur || []).includes(o) : valeur === o);
  const clic = (o) => {
    if (multiple) {
      const actuel = Array.isArray(valeur) ? valeur : [];
      onChange(actuel.includes(o) ? actuel.filter((x) => x !== o) : [...actuel, o]);
    } else {
      onChange(valeur === o ? '' : o);
    }
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => clic(o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '5px', textAlign: 'left',
            padding: '8px 12px', borderRadius: multiple ? '11px' : '999px', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', fontFamily: 'inherit', lineHeight: '1.3',
            border: choisi(o) ? `1.5px solid ${ACCENT}` : '1.5px solid #E8DFCF',
            backgroundColor: choisi(o) ? ACCENT_BG : '#FFFFFF',
            color: choisi(o) ? ACCENT : '#8A7B68'
          }}
        >
          {multiple && choisi(o) && <IconCheck size={14} />}
          {nomme(o)}
        </button>
      ))}
    </div>
  );
}

function LoyerCalc({ donnees }) {
  const parts = calcParts(donnees?.revenuP1, donnees?.revenuP2);
  const ligne = (a, b, c, fort) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '6px', padding: '7px 0', borderTop: '1px solid #F1E8D8', fontWeight: fort ? '800' : '600' }}>
      <span style={{ color: '#2B2420' }}>{a}</span>
      <span style={{ textAlign: 'right', color: '#2B2420' }}>{b}</span>
      <span style={{ textAlign: 'right', color: '#2B2420' }}>{c}</span>
    </div>
  );
  const loyer1 = parts ? (LOYER_NET * parts.p1) / 100 : null;
  const loyer2 = parts ? (LOYER_NET * parts.p2) / 100 : null;
  const tot1 = loyer1 !== null ? loyer1 + PARKING_P1 : null;
  const tot2 = loyer2 !== null ? loyer2 + PARKING_P2 : null;
  const pct = (tot, rev) => (tot !== null && parseFloat(rev) > 0 ? `${((tot / parseFloat(rev)) * 100).toFixed(1)} %` : '—');
  return (
    <div style={{ backgroundColor: '#F7F1E8', borderRadius: '14px', padding: '12px 14px', fontSize: '12.5px' }}>
      <p style={{ margin: '0 0 6px 0', fontSize: '11.5px', fontWeight: '800', color: '#8A7B68' }}>CALCUL AUTOMATIQUE</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: '6px', fontWeight: '800', color: ACCENT }}>
        <span />
        <span style={{ textAlign: 'right' }}>P1</span>
        <span style={{ textAlign: 'right' }}>P2</span>
      </div>
      {ligne('Part de chacune', parts ? `${parts.p1.toFixed(1)} %` : '—', parts ? `${parts.p2.toFixed(1)} %` : '—')}
      {ligne(`Loyer sans parking (${chf(LOYER_NET)})`, loyer1 !== null ? chf(loyer1) : '—', loyer2 !== null ? chf(loyer2) : '—')}
      {ligne('Place de parc', chf(PARKING_P1), chf(PARKING_P2))}
      {ligne('Total par mois, hors charges', tot1 !== null ? chf(tot1) : '—', tot2 !== null ? chf(tot2) : '—', true)}
      {ligne('Part du revenu net payée en loyer', pct(tot1, donnees?.revenuP1), pct(tot2, donnees?.revenuP2))}
    </div>
  );
}

function Champ({ champ, valeur, onChange, nomme, donnees }) {
  const t = champ.type;

  if (t === 'info') {
    return <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.5', backgroundColor: '#F7F1E8', padding: '10px 12px', borderRadius: '11px' }}>{nomme(champ.texte)}</p>;
  }
  if (t === 'loyerCalc') return <LoyerCalc donnees={donnees} />;

  const label = champ.label ? <label style={labelStyle}>{nomme(champ.label)}</label> : null;

  if (t === 'texte') {
    return <div>{label}<input type="text" value={valeur || ''} placeholder={champ.placeholder || ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} /></div>;
  }
  if (t === 'long') {
    return <div>{label}<textarea rows={3} value={valeur || ''} placeholder={champ.placeholder || ''} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, resize: 'vertical' }} /></div>;
  }
  if (t === 'nombre') {
    return (
      <div>
        {label}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="number" inputMode="decimal" step="any" value={valeur ?? ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
          {champ.unite && <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#B5A793', flexShrink: 0 }}>{champ.unite}</span>}
        </div>
      </div>
    );
  }
  if (t === 'date') {
    return <div>{label}<input type="date" value={valeur || ''} onChange={(e) => onChange(e.target.value)} style={inputStyle} /></div>;
  }
  if (t === 'choix') {
    if (!champ.options || champ.options.length === 0) return null;
    return <div>{label}<Chips options={champ.options} valeur={valeur} onChange={onChange} nomme={nomme} /></div>;
  }
  if (t === 'cases') {
    return <div>{label}<Chips options={champ.options} valeur={valeur} multiple onChange={onChange} nomme={nomme} /></div>;
  }

  if (t === 'grille') {
    const dataGrille = valeur || {};
    const changerCellule = (idLigne, idCol, v) => {
      onChange({ ...dataGrille, [idLigne]: { ...(dataGrille[idLigne] || {}), [idCol]: v } });
    };
    return (
      <div>
        {label}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {champ.lignes.map((lg) => (
            <div key={lg.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', padding: '12px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '800', color: '#2B2420' }}>{nomme(lg.label)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {champ.colonnes.map((col) => (
                  <Champ
                    key={col.id}
                    champ={{ ...col, options: lg.over?.[col.id] ?? col.options }}
                    valeur={dataGrille[lg.id]?.[col.id]}
                    onChange={(v) => changerCellule(lg.id, col.id, v)}
                    nomme={nomme}
                    donnees={donnees}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (t === 'tableau') {
    const lignes = Array.isArray(valeur) ? valeur : [];
    const changer = (i, idCol, v) => onChange(lignes.map((r, idx) => (idx === i ? { ...r, [idCol]: v } : r)));
    return (
      <div>
        {label}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {lignes.map((row, i) => (
            <div key={i} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: ACCENT }}>Ligne {i + 1}</span>
                <button type="button" onClick={() => onChange(lignes.filter((_, idx) => idx !== i))} style={{ border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '3px' }}>
                  <IconTrash size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {champ.colonnes.map((col) =>
                  col.type === 'calc' ? (
                    <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '4px 2px' }}>
                      <span style={{ color: '#8A7B68', fontWeight: '700' }}>{col.label}</span>
                      <span style={{ color: '#2B2420', fontWeight: '800' }}>{col.calc(row) || '—'}</span>
                    </div>
                  ) : (
                    <Champ key={col.id} champ={col} valeur={row?.[col.id]} onChange={(v) => changer(i, col.id, v)} nomme={nomme} donnees={donnees} />
                  )
                )}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange([...lignes, {}])}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1.5px dashed #D9CDB8', background: 'transparent', borderRadius: '12px', padding: '11px', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
          >
            <IconPlus size={15} /> Ajouter une ligne
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// =====================================================================
// VUE "COMPARER" — mes réponses partagées / les siennes partagées
// =====================================================================
function VueComparer({ section, miennes, siennes, nomme, prenomElle }) {
  const feuilles = useMemo(() => aplatir(section), [section]);
  const groupes = useMemo(() => {
    const map = [];
    feuilles.forEach((f) => {
      const moi = valeurEnTexte(f, f.get(miennes), nomme);
      const elle = valeurEnTexte(f, f.get(siennes), nomme);
      if (!moi && !elle) return;
      let g = map.find((x) => x.titre === f.bloc);
      if (!g) { g = { titre: f.bloc, lignes: [] }; map.push(g); }
      g.lignes.push({ label: f.label, moi, elle });
    });
    return map;
  }, [feuilles, miennes, siennes, nomme]);

  if (groupes.length === 0) {
    return <p style={{ fontSize: '13px', color: '#B5A793', textAlign: 'center', padding: '24px 10px' }}>Aucune réponse à comparer pour l’instant.</p>;
  }

  const bloc = (titre, texte, couleur) => (
    <div style={{ borderLeft: `3px solid ${couleur}`, paddingLeft: '10px' }}>
      <p style={{ margin: '0 0 2px 0', fontSize: '10.5px', fontWeight: '800', color: couleur }}>{titre}</p>
      <p style={{ margin: 0, fontSize: '13.5px', color: texte ? '#2B2420' : '#B5A793', whiteSpace: 'pre-line', lineHeight: '1.45' }}>{texte || 'pas de réponse'}</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {groupes.map((g, gi) => (
        <div key={gi}>
          {g.titre && <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>{g.titre}</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {g.lignes.map((ln, i) => {
              const identique = ln.moi === ln.elle;
              return (
                <div key={i} style={{ backgroundColor: '#FFFFFF', border: identique ? '1px solid #CFE8DB' : '1px solid #E8DFCF', borderRadius: '14px', padding: '11px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                    <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: '#8A7B68', lineHeight: '1.35' }}>{nomme(ln.label)}</p>
                    {identique && <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: '800', color: '#16A06B' }}>✓ pareil</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {bloc('MOI', ln.moi, ACCENT)}
                    {bloc(prenomElle.toUpperCase(), ln.elle, '#6E8AA6')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// =====================================================================
// COMPOSANT PRINCIPAL
// =====================================================================
export function AccordCohabitation({ utilisateur }) {
  const uid = utilisateur?.uid;

  const [prive, setPrive] = useState({ partenaireUid: '', dateDebut: '', dateFin: '', sections: {} });
  const [charge, setCharge] = useState(false);
  const [mesPartages, setMesPartages] = useState({});   // sectionId -> doc partagé par moi
  const [sesPartages, setSesPartages] = useState({});   // sectionId -> doc partagé par elle
  const [sectionOuverte, setSectionOuverte] = useState(null);
  const [vue, setVue] = useState('saisie'); // 'saisie' | 'comparer'
  const [statutSauvegarde, setStatutSauvegarde] = useState('');
  const [codeSaisi, setCodeSaisi] = useState('');
  const [codeCopie, setCodeCopie] = useState(false);
  const [erreur, setErreur] = useState('');

  const latestRef = useRef(prive);          // toujours la dernière version locale
  const dirtyRef = useRef(new Set());       // sections modifiées pas encore enregistrées
  const timerRef = useRef(null);

  // --- Écoute de mes réponses privées ---------------------------------
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      doc(db, 'accord_prive', uid),
      (snap) => {
        if (snap.metadata.hasPendingWrites || dirtyRef.current.size > 0) { setCharge(true); return; }
        if (snap.exists()) {
          const d = snap.data();
          const v = {
            partenaireUid: d.partenaireUid || '',
            dateDebut: d.dateDebut || '',
            dateFin: d.dateFin || '',
            sections: d.sections || {}
          };
          latestRef.current = v;
          setPrive(v);
          setCodeSaisi((c) => c || v.partenaireUid);
        }
        setCharge(true);
      },
      (e) => { console.error('Lecture accord_prive :', e); setErreur("Impossible de lire tes réponses (règles Firestore à publier ?)."); setCharge(true); }
    );
    return () => unsub();
  }, [uid]);

  // --- Mes sections partagées -----------------------------------------
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'accord_partages'), where('uid', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.data().section] = { id: d.id, ...d.data() }; });
      setMesPartages(map);
    }, (e) => console.error('Lecture de mes partages :', e));
    return () => unsub();
  }, [uid]);

  // --- Sections qu'ELLE a partagées avec moi ---------------------------
  useEffect(() => {
    if (!uid || !prive.partenaireUid) { setSesPartages({}); return; }
    const q = query(
      collection(db, 'accord_partages'),
      where('uid', '==', prive.partenaireUid),
      where('partenaireUid', '==', uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.forEach((d) => { map[d.data().section] = { id: d.id, ...d.data() }; });
      setSesPartages(map);
    }, (e) => console.error('Lecture de ses partages :', e));
    return () => unsub();
  }, [uid, prive.partenaireUid]);

  // --- Enregistrement (avec petite attente pour ne pas écrire à chaque lettre) ---
  const ecrireSections = useCallback(async () => {
    if (!uid || dirtyRef.current.size === 0) return;
    const sids = Array.from(dirtyRef.current);
    const sections = {};
    sids.forEach((s) => { sections[s] = latestRef.current.sections[s] || {}; });
    try {
      await setDoc(doc(db, 'accord_prive', uid), { uid, sections, maj: serverTimestamp() }, { merge: true });
      sids.forEach((s) => dirtyRef.current.delete(s));
      setStatutSauvegarde('Enregistré ✓');
    } catch (e) {
      console.error("Erreur d'enregistrement :", e);
      setStatutSauvegarde("Erreur d'enregistrement");
    }
  }, [uid]);

  const changerSection = (sid, nouvelleDonnee) => {
    const suivant = { ...latestRef.current, sections: { ...latestRef.current.sections, [sid]: nouvelleDonnee } };
    latestRef.current = suivant;
    setPrive(suivant);
    dirtyRef.current.add(sid);
    setStatutSauvegarde('Enregistrement…');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(ecrireSections, 700);
  };

  // Si on quitte l'écran avec une modification en attente, on l'enregistre
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      if (dirtyRef.current.size > 0) ecrireSections();
    };
  }, [ecrireSections]);

  const sauverMeta = async (patch) => {
    const suivant = { ...latestRef.current, ...patch };
    latestRef.current = suivant;
    setPrive(suivant);
    try {
      await setDoc(doc(db, 'accord_prive', uid), { uid, ...patch, maj: serverTimestamp() }, { merge: true });
    } catch (e) {
      console.error('Erreur meta :', e);
    }
  };

  // --- Partage ---------------------------------------------------------
  const partager = async (sid) => {
    if (!prive.partenaireUid) return;
    clearTimeout(timerRef.current);
    await ecrireSections();
    try {
      await setDoc(doc(db, 'accord_partages', `${uid}_${sid}`), {
        uid,
        partenaireUid: prive.partenaireUid,
        section: sid,
        reponses: latestRef.current.sections[sid] || {},
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error('Erreur de partage :', e);
      setErreur('Le partage a échoué (règles Firestore à publier ?).');
    }
  };

  const retirerPartage = async (sid) => {
    if (!window.confirm('Reprendre le partage ? Elle ne verra plus cette section.')) return;
    try {
      await deleteDoc(doc(db, 'accord_partages', `${uid}_${sid}`));
    } catch (e) {
      console.error('Erreur de retrait :', e);
    }
  };

  // --- Noms (P1 / P2 remplacés par les prénoms de la section 0) -----------
  const s0 = prive.sections?.s0 || {};
  const nomme = useCallback(
    (str) => {
      if (typeof str !== 'string') return str;
      let r = str;
      if (s0.prenomP1) r = r.replace(/\bP1\b/g, s0.prenomP1);
      if (s0.prenomP2) r = r.replace(/\bP2\b/g, s0.prenomP2);
      return r;
    },
    [s0.prenomP1, s0.prenomP2]
  );

  const prenomElle = 'Elle';

  const copierCode = async () => {
    try {
      await navigator.clipboard.writeText(uid);
      setCodeCopie(true);
      setTimeout(() => setCodeCopie(false), 2000);
    } catch (e) {
      window.prompt('Copie ce code :', uid);
    }
  };

  if (!uid) return null;
  if (!charge) {
    return <p style={{ textAlign: 'center', color: '#B5A793', fontSize: '13.5px', padding: '40px 0' }}>Chargement…</p>;
  }

  // ===================================================================
  // ÉCRAN D'UNE SECTION
  // ===================================================================
  if (sectionOuverte) {
    const section = SECTIONS.find((s) => s.id === sectionOuverte);
    const donnees = prive.sections[section.id] || {};
    const monPartage = mesPartages[section.id];
    const sonPartage = sesPartages[section.id];
    const aChange = monPartage ? stable(monPartage.reponses || {}) !== stable(donnees) : false;
    const peutComparer = !!monPartage && !!sonPartage;

    const retour = async () => {
      clearTimeout(timerRef.current);
      await ecrireSections();
      setSectionOuverte(null);
      setVue('saisie');
    };

    return (
      <div>
        <button onClick={retour} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '0 0 12px 0' }}>
          <IconArrowLeft size={15} /> Toutes les sections
        </button>

        <h3 style={{ margin: '0 0 6px 0', fontSize: '19px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>
          {section.emoji} {section.titre}
        </h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.5' }}>{nomme(section.intro)}</p>

        {/* Carte de partage */}
        <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${monPartage ? '#CFE8DB' : '#E8DFCF'}`, borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            {monPartage ? <IconLockOpen size={17} color="#16A06B" /> : <IconLock size={17} color={ACCENT} />}
            <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#2B2420' }}>
              {monPartage ? 'Tu as partagé cette section' : 'Cette section est privée'}
            </span>
          </div>
          <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.45' }}>
            {monPartage
              ? aChange
                ? 'Tu as modifié tes réponses depuis le partage : elle voit encore l’ancienne version.'
                : 'Elle voit exactement tes réponses actuelles.'
              : 'Personne ne voit tes réponses tant que tu ne les partages pas. Tu peux continuer à les modifier.'}
          </p>

          {!prive.partenaireUid ? (
            <p style={{ margin: 0, fontSize: '12.5px', color: '#B3453A', fontWeight: '700' }}>
              Pour partager, relie d’abord vos deux comptes (en haut de la liste des sections).
            </p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {!monPartage && (
                <button onClick={() => partager(section.id)} style={{ flex: 1, minWidth: '170px', padding: '11px', borderRadius: '12px', border: 'none', backgroundColor: ACCENT, color: '#FFF', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}>
                  Partager avec elle
                </button>
              )}
              {monPartage && aChange && (
                <button onClick={() => partager(section.id)} style={{ flex: 1, minWidth: '170px', padding: '11px', borderRadius: '12px', border: 'none', backgroundColor: ACCENT, color: '#FFF', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <IconRefresh size={15} /> Mettre à jour le partage
                </button>
              )}
              {monPartage && (
                <button onClick={() => retirerPartage(section.id)} style={{ flex: 1, minWidth: '140px', padding: '11px', borderRadius: '12px', border: '1px solid #F3D2D0', backgroundColor: '#FEF2F2', color: '#B3453A', fontWeight: '800', fontSize: '13.5px', cursor: 'pointer' }}>
                  Reprendre le partage
                </button>
              )}
            </div>
          )}

          {prive.partenaireUid && (
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', fontWeight: '700', color: sonPartage ? '#16A06B' : '#B5A793' }}>
              {sonPartage ? '✓ Elle a partagé cette section' : 'Elle n’a pas encore partagé cette section'}
            </p>
          )}
        </div>

        {/* Onglets saisie / comparer */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {[['saisie', 'Mes réponses'], ['comparer', 'Comparer']].map(([id, titre]) => (
            <button
              key={id}
              onClick={() => setVue(id)}
              style={{
                flex: 1, padding: '10px', borderRadius: '11px', fontSize: '13px', fontWeight: '800', cursor: 'pointer',
                border: vue === id ? `1.5px solid ${ACCENT}` : '1.5px solid #E8DFCF',
                backgroundColor: vue === id ? ACCENT_BG : '#FFFFFF', color: vue === id ? ACCENT : '#8A7B68'
              }}
            >
              {titre}
            </button>
          ))}
        </div>

        {vue === 'saisie' ? (
          <div>
            <p style={{ margin: '0 0 14px 0', fontSize: '11.5px', fontWeight: '700', color: statutSauvegarde.startsWith('Erreur') ? '#B3453A' : '#B5A793', minHeight: '14px' }}>{statutSauvegarde}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {section.blocs.map((b, bi) => (
                <div key={bi}>
                  {b.titre && (
                    <p style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif", paddingBottom: '6px', borderBottom: '1px solid #E8DFCF' }}>
                      {b.titre}
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {b.champs.map((c, ci) => (
                      <Champ
                        key={c.id || `${bi}-${ci}`}
                        champ={c}
                        valeur={c.id ? donnees[c.id] : undefined}
                        onChange={(v) => changerSection(section.id, { ...donnees, [c.id]: v })}
                        nomme={nomme}
                        donnees={donnees}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : peutComparer ? (
          <VueComparer section={section} miennes={monPartage.reponses} siennes={sonPartage.reponses} nomme={nomme} prenomElle={prenomElle} />
        ) : (
          <div style={{ padding: '28px 18px', textAlign: 'center', backgroundColor: '#FFFFFF', borderRadius: '18px', border: '1px dashed #E8DFCF', color: '#8A7B68', fontSize: '13.5px', lineHeight: '1.55' }}>
            <IconLock size={22} color={ACCENT} />
            <p style={{ margin: '8px 0 0 0' }}>
              La comparaison s’ouvre quand vous avez <b>toutes les deux partagé</b> cette section.
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: '#B5A793' }}>
              {monPartage ? 'Tu as partagé. Il reste à elle de le faire.' : sonPartage ? 'Elle a partagé. À toi de le faire quand tu es prête.' : 'Ni l’une ni l’autre n’a encore partagé.'}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ===================================================================
  // ÉCRAN D'ACCUEIL : dates, liaison des comptes, liste des sections
  // ===================================================================
  return (
    <div>
      {erreur && (
        <div style={{ padding: '11px 14px', borderRadius: '12px', backgroundColor: '#FEF2F2', border: '1px solid #F3D2D0', color: '#B3453A', fontSize: '12.5px', fontWeight: '700', marginBottom: '14px' }}>
          {erreur}
        </div>
      )}

      <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#8A7B68', lineHeight: '1.5' }}>
        Chacune remplit de son côté. Rien n’est visible par l’autre tant que tu ne partages pas une section. Une fois que vous avez toutes les deux partagé, vous pouvez comparer.
      </p>

      {/* Dates */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Commencé le</label>
          <input type="date" value={prive.dateDebut || ''} onChange={(e) => sauverMeta({ dateDebut: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Terminé le</label>
          <input type="date" value={prive.dateFin || ''} onChange={(e) => sauverMeta({ dateFin: e.target.value })} style={inputStyle} />
        </div>
      </div>

      {/* Liaison des comptes */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <IconUsers size={17} color={ACCENT} />
          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#2B2420' }}>
            {prive.partenaireUid ? 'Comptes reliés' : 'Relier vos deux comptes'}
          </span>
        </div>
        <p style={{ margin: '0 0 10px 0', fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.45' }}>
          À faire une seule fois, par chacune. Envoie-lui ton code, et colle le sien ci-dessous.
        </p>

        <label style={labelStyle}>Mon code</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input readOnly value={uid} style={{ ...inputStyle, fontSize: '12px', color: '#8A7B68' }} onFocus={(e) => e.target.select()} />
          <button onClick={copierCode} style={{ flexShrink: 0, padding: '0 12px', borderRadius: '12px', border: '1px solid #E8DFCF', backgroundColor: '#FFFFFF', color: ACCENT, fontWeight: '800', fontSize: '12.5px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
            {codeCopie ? <IconCheck size={15} /> : <IconCopy size={15} />} {codeCopie ? 'Copié' : 'Copier'}
          </button>
        </div>

        <label style={labelStyle}>Son code</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={codeSaisi}
            onChange={(e) => setCodeSaisi(e.target.value.trim())}
            placeholder="Colle ici le code de ta partenaire"
            style={{ ...inputStyle, fontSize: '12px' }}
          />
          <button
            onClick={() => {
              if (codeSaisi === uid) { setErreur('Ce code est le tien : colle celui de ta partenaire.'); return; }
              setErreur('');
              sauverMeta({ partenaireUid: codeSaisi });
            }}
            disabled={codeSaisi === prive.partenaireUid}
            style={{ flexShrink: 0, padding: '0 14px', borderRadius: '12px', border: 'none', backgroundColor: codeSaisi === prive.partenaireUid ? '#E8DFCF' : ACCENT, color: '#FFF', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
          >
            Relier
          </button>
        </div>
      </div>

      {/* Liste des sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {SECTIONS.map((s) => {
          const { faites, total } = compterReponses(s, prive.sections[s.id] || {});
          const moi = !!mesPartages[s.id];
          const elle = !!sesPartages[s.id];
          return (
            <div
              key={s.id}
              onClick={() => { setSectionOuverte(s.id); setVue('saisie'); setStatutSauvegarde(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '18px', cursor: 'pointer' }}
            >
              <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '13px', backgroundColor: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '21px' }}>
                {s.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px 0', fontSize: '14.5px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>{s.titre}</p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11.5px', color: '#B5A793', fontWeight: '700' }}>{faites}/{total} réponses</span>
                  {moi && <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#16A06B', backgroundColor: '#E6F9F1', padding: '2px 7px', borderRadius: '999px' }}>partagée</span>}
                  {elle && <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#6E8AA6', backgroundColor: '#EEF2F0', padding: '2px 7px', borderRadius: '999px' }}>elle a partagé</span>}
                </div>
              </div>
              <IconChevronRight size={18} color="#B5A793" style={{ flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
