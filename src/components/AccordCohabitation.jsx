import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore';
import {
  IconArrowLeft, IconPlus, IconTrash, IconCheck, IconLock, IconLockOpen,
  IconChevronRight, IconCopy, IconUsers, IconRefresh, IconPencil, IconArrowUp, IconArrowDown, IconSettings
} from '@tabler/icons-react';
import { LOYER_NET, PARKING_P1, PARKING_P2, chf, calcParts, CALCULS, modeleParDefaut } from './accordSchema';

// =====================================================================
// ACCORD DE COHABITATION — formulaire privé, partage par section,
// questions modifiables par l'administratrice.
//
// Données :
//  - accord_modele/{uidAdmin}      → les questions + les prénoms P1/P2
//                                    (écrits par l'administratrice, lus par sa partenaire)
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
const petitBouton = { border: 'none', background: 'none', color: '#B5A793', cursor: 'pointer', padding: '4px', display: 'flex' };

const nouvelId = (prefixe) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const propre = (o) => JSON.parse(JSON.stringify(o)); // enlève les undefined, interdits par Firestore

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
// ---------------------------------------------------------------------
function aplatir(section) {
  const out = [];
  (section.blocs || []).forEach((b) => {
    (b.champs || []).forEach((c) => {
      if (c.type === 'info' || c.type === 'loyerCalc') return;
      if (c.type === 'grille') {
        (c.lignes || []).forEach((lg) => {
          (c.colonnes || []).forEach((col) => {
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
        const morceaux = (feuille.champ.colonnes || [])
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
      {ligne(`Loyer + charges, sans parking (${chf(LOYER_NET)})`, loyer1 !== null ? chf(loyer1) : '—', loyer2 !== null ? chf(loyer2) : '—')}
      {ligne('Place de parc', chf(PARKING_P1), chf(PARKING_P2))}
      {ligne('Total par mois, charges et parking compris', tot1 !== null ? chf(tot1) : '—', tot2 !== null ? chf(tot2) : '—', true)}
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
    return <div>{label}<Chips options={champ.options || []} valeur={valeur} multiple onChange={onChange} nomme={nomme} /></div>;
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
          {(champ.lignes || []).map((lg) => (
            <div key={lg.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '14px', padding: '12px' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '13.5px', fontWeight: '800', color: '#2B2420' }}>{nomme(lg.label)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(champ.colonnes || []).map((col) => (
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
                <button type="button" onClick={() => onChange(lignes.filter((_, idx) => idx !== i))} style={petitBouton}>
                  <IconTrash size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {(champ.colonnes || []).map((col) =>
                  col.type === 'calc' ? (
                    <div key={col.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', padding: '4px 2px' }}>
                      <span style={{ color: '#8A7B68', fontWeight: '700' }}>{col.label}</span>
                      <span style={{ color: '#2B2420', fontWeight: '800' }}>{(CALCULS[col.calc] ? CALCULS[col.calc](row) : '') || '—'}</span>
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
// MODE ADMINISTRATRICE — éditeur de questions
// =====================================================================
const TYPES_QUESTION = [
  { id: 'texte', label: 'Réponse libre (courte)' },
  { id: 'long', label: 'Réponse libre (longue)' },
  { id: 'oui_non', label: 'Oui / Non' },
  { id: 'choix', label: 'Un seul choix dans une liste' },
  { id: 'cases', label: 'Plusieurs choix possibles' },
  { id: 'nombre', label: 'Nombre' },
  { id: 'date', label: 'Date' }
];

const typeActuel = (c) =>
  c.type === 'choix' && c.options?.length === 2 && c.options[0] === 'oui' && c.options[1] === 'non' ? 'oui_non' : c.type;

function appliquerType(c, t) {
  const base = { id: c.id, label: c.label || '' };
  if (t === 'oui_non') return { ...base, type: 'choix', options: ['oui', 'non'] };
  if (t === 'choix' || t === 'cases') {
    const garder = c.options && c.options.length > 0 && typeActuel(c) !== 'oui_non';
    return { ...base, type: t, options: garder ? c.options : ['Option 1', 'Option 2'] };
  }
  if (t === 'nombre') return { ...base, type: 'nombre', unite: c.unite || '' };
  return { ...base, type: t };
}

function nouvelleQuestion(t) {
  return appliquerType({ id: nouvelId('q'), label: 'Nouvelle question' }, t);
}

// Liste d'options : une par ligne
function EditeurOptions({ options, onChange }) {
  const [texte, setTexte] = useState((options || []).join('\n'));
  return (
    <div>
      <label style={labelStyle}>Les choix possibles (un par ligne)</label>
      <textarea
        rows={Math.min(8, Math.max(3, (options || []).length + 1))}
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          onChange(e.target.value.split('\n').map((x) => x.trim()).filter(Boolean));
        }}
        style={{ ...inputStyle, resize: 'vertical', fontSize: '14px' }}
      />
    </div>
  );
}

function BarreQuestion({ badge, index, total, onMove, onDelete }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
      <span style={{ fontSize: '10.5px', fontWeight: '800', color: ACCENT, backgroundColor: ACCENT_BG, padding: '3px 8px', borderRadius: '999px' }}>{badge}</span>
      <div style={{ display: 'flex', gap: '2px' }}>
        <button type="button" disabled={index === 0} onClick={() => onMove(-1)} style={{ ...petitBouton, opacity: index === 0 ? 0.3 : 1 }}><IconArrowUp size={16} /></button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} style={{ ...petitBouton, opacity: index === total - 1 ? 0.3 : 1 }}><IconArrowDown size={16} /></button>
        {onDelete && <button type="button" onClick={onDelete} style={{ ...petitBouton, color: '#B3453A' }}><IconTrash size={16} /></button>}
      </div>
    </div>
  );
}

function EditeurQuestion({ champ, index, total, onChange, onDelete, onMove }) {
  const t = champ.type;
  const carte = { backgroundColor: '#FFFFFF', border: '1.5px solid #E6D8E2', borderRadius: '14px', padding: '12px' };

  if (t === 'loyerCalc') {
    return (
      <div style={carte}>
        <BarreQuestion badge="Calcul du loyer" index={index} total={total} onMove={onMove} />
        <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.45' }}>
          Tableau automatique (part de chacune, loyer, parking). Il utilise les deux questions de revenu juste au-dessus : ne les supprime pas.
        </p>
      </div>
    );
  }

  if (t === 'info') {
    return (
      <div style={carte}>
        <BarreQuestion badge="Texte d’information" index={index} total={total} onMove={onMove} onDelete={onDelete} />
        <textarea rows={3} value={champ.texte || ''} onChange={(e) => onChange({ ...champ, texte: e.target.value })} style={{ ...inputStyle, resize: 'vertical', fontSize: '14px' }} />
      </div>
    );
  }

  if (t === 'grille') {
    const lignes = champ.lignes || [];
    const majLigne = (i, patch) => onChange({ ...champ, lignes: lignes.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
    return (
      <div style={carte}>
        <BarreQuestion badge="Liste de lignes" index={index} total={total} onMove={onMove} onDelete={onDelete} />
        <label style={labelStyle}>Titre de la liste</label>
        <input type="text" value={champ.label || ''} onChange={(e) => onChange({ ...champ, label: e.target.value })} style={{ ...inputStyle, marginBottom: '12px' }} />
        <label style={labelStyle}>Les lignes (chaque ligne garde les mêmes colonnes : {(champ.colonnes || []).map((c) => c.label).join(', ')})</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '9px' }}>
          {lignes.map((lg, i) => (
            <div key={lg.id} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="text" value={lg.label} onChange={(e) => majLigne(i, { label: e.target.value })} style={{ ...inputStyle, padding: '9px 11px', fontSize: '14px' }} />
              <button type="button" onClick={() => onChange({ ...champ, lignes: lignes.filter((_, idx) => idx !== i) })} style={{ ...petitBouton, color: '#B3453A' }}><IconTrash size={16} /></button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...champ, lignes: [...lignes, { id: nouvelId('l'), label: 'Nouvelle ligne' }] })}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1.5px dashed #D9CDB8', background: 'transparent', borderRadius: '11px', padding: '9px 12px', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
        >
          <IconPlus size={15} /> Ajouter une ligne
        </button>
      </div>
    );
  }

  if (t === 'tableau') {
    return (
      <div style={carte}>
        <BarreQuestion badge="Tableau à remplir" index={index} total={total} onMove={onMove} onDelete={onDelete} />
        <label style={labelStyle}>Titre du tableau</label>
        <input type="text" value={champ.label || ''} onChange={(e) => onChange({ ...champ, label: e.target.value })} style={inputStyle} />
        <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#B5A793' }}>Colonnes : {(champ.colonnes || []).map((c) => c.label).join(', ')}. Chacune ajoute ses lignes en remplissant.</p>
      </div>
    );
  }

  // Question classique
  const tu = typeActuel(champ);
  return (
    <div style={carte}>
      <BarreQuestion badge={TYPES_QUESTION.find((x) => x.id === tu)?.label || t} index={index} total={total} onMove={onMove} onDelete={onDelete} />
      <label style={labelStyle}>La question</label>
      <textarea rows={2} value={champ.label || ''} onChange={(e) => onChange({ ...champ, label: e.target.value })} style={{ ...inputStyle, resize: 'vertical', fontSize: '14px', marginBottom: '10px' }} />

      <label style={labelStyle}>Type de réponse</label>
      <select value={tu} onChange={(e) => onChange(appliquerType(champ, e.target.value))} style={{ ...inputStyle, marginBottom: '10px', fontSize: '14px' }}>
        {TYPES_QUESTION.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>

      {(tu === 'choix' || tu === 'cases') && (
        <EditeurOptions key={`${champ.id}-${tu}`} options={champ.options} onChange={(options) => onChange({ ...champ, options })} />
      )}
      {tu === 'nombre' && (
        <div>
          <label style={labelStyle}>Unité (facultatif : CHF, %, jours…)</label>
          <input type="text" value={champ.unite || ''} onChange={(e) => onChange({ ...champ, unite: e.target.value })} style={inputStyle} />
        </div>
      )}
    </div>
  );
}

function BoutonAjouterQuestion({ onAjouter }) {
  const [ouvert, setOuvert] = useState(false);
  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1.5px dashed ${ACCENT}`, background: 'transparent', borderRadius: '12px', padding: '11px', color: ACCENT, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}>
        <IconPlus size={15} /> Ajouter une question
      </button>
    );
  }
  return (
    <div style={{ backgroundColor: ACCENT_BG, borderRadius: '14px', padding: '12px' }}>
      <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '800', color: ACCENT }}>Quel type de réponse ?</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        {TYPES_QUESTION.map((x) => (
          <button key={x.id} type="button" onClick={() => { onAjouter(nouvelleQuestion(x.id)); setOuvert(false); }} style={{ padding: '8px 12px', borderRadius: '999px', border: `1.5px solid ${ACCENT}`, backgroundColor: '#FFF', color: ACCENT, fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}>
            {x.label}
          </button>
        ))}
        <button type="button" onClick={() => { onAjouter({ id: nouvelId('i'), type: 'info', texte: 'Nouveau texte d’information' }); setOuvert(false); }} style={{ padding: '8px 12px', borderRadius: '999px', border: '1.5px solid #D9CDB8', backgroundColor: '#FFF', color: '#8A7B68', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}>
          Texte d’information
        </button>
        <button type="button" onClick={() => setOuvert(false)} style={{ padding: '8px 12px', border: 'none', background: 'none', color: '#8A7B68', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>
  );
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

  const [prive, setPrive] = useState({ partenaireUid: '', dateDebut: '', dateFin: '', admin: false, sections: {} });
  const [charge, setCharge] = useState(false);
  const [modele, setModele] = useState(() => modeleParDefaut());
  const [mesPartages, setMesPartages] = useState({});   // sectionId -> doc partagé par moi
  const [sesPartages, setSesPartages] = useState({});   // sectionId -> doc partagé par elle
  const [sectionOuverte, setSectionOuverte] = useState(null);
  const [vue, setVue] = useState('saisie'); // 'saisie' | 'comparer'
  const [modeEdition, setModeEdition] = useState(false);
  const [statutSauvegarde, setStatutSauvegarde] = useState('');
  const [statutModele, setStatutModele] = useState('');
  const [codeSaisi, setCodeSaisi] = useState('');
  const [codeCopie, setCodeCopie] = useState(false);
  const [erreur, setErreur] = useState('');

  const latestRef = useRef(prive);          // toujours la dernière version locale de mes réponses
  const dirtyRef = useRef(new Set());       // sections modifiées pas encore enregistrées
  const timerRef = useRef(null);
  const modeleRef = useRef(modele);         // dernière version locale des questions
  const dirtyModeleRef = useRef(false);
  const timerModeleRef = useRef(null);

  const estAdmin = !!prive.admin;

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
            admin: !!d.admin,
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

  // --- Le modèle (questions + prénoms) : celui de l'administratrice -----
  // Si je suis l'administratrice, c'est le mien. Sinon, celui de ma partenaire.
  const sourceModele = estAdmin ? uid : prive.partenaireUid;
  useEffect(() => {
    const defaut = () => { const m = modeleParDefaut(); modeleRef.current = m; setModele(m); };
    if (!uid || !sourceModele) { if (!dirtyModeleRef.current) defaut(); return; }
    const unsub = onSnapshot(
      doc(db, 'accord_modele', sourceModele),
      (snap) => {
        if (snap.metadata.hasPendingWrites || dirtyModeleRef.current) return;
        if (snap.exists()) {
          const d = snap.data();
          const m = { noms: d.noms || { P1: '', P2: '' }, sections: d.sections || [] };
          modeleRef.current = m;
          setModele(m);
        } else {
          defaut();
        }
      },
      () => defaut() // pas (encore) de modèle lisible : on garde les questions par défaut
    );
    return () => unsub();
  }, [uid, sourceModele]);

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

  // --- Enregistrement de mes réponses ------------------------------------
  const ecrireSections = useCallback(async () => {
    if (!uid || dirtyRef.current.size === 0) return;
    const sids = Array.from(dirtyRef.current);
    const sections = {};
    sids.forEach((s) => { sections[s] = propre(latestRef.current.sections[s] || {}); });
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

  // --- Enregistrement du modèle (administratrice seulement) ---------------
  const ecrireModele = useCallback(async () => {
    if (!uid || !dirtyModeleRef.current) return;
    try {
      await setDoc(doc(db, 'accord_modele', uid), {
        uid,
        partenaireUid: latestRef.current.partenaireUid || '',
        noms: propre(modeleRef.current.noms),
        sections: propre(modeleRef.current.sections),
        maj: serverTimestamp()
      });
      dirtyModeleRef.current = false;
      setStatutModele('Modifications enregistrées et visibles par ta partenaire ✓');
    } catch (e) {
      console.error('Erreur modèle :', e);
      setStatutModele("Erreur d'enregistrement des questions");
    }
  }, [uid]);

  // Applique une modification au modèle : fn reçoit une copie à modifier
  const majModele = (fn) => {
    const copie = propre(modeleRef.current);
    fn(copie);
    modeleRef.current = copie;
    setModele(copie);
    dirtyModeleRef.current = true;
    setStatutModele('Enregistrement…');
    clearTimeout(timerModeleRef.current);
    timerModeleRef.current = setTimeout(ecrireModele, 800);
  };

  // Si on quitte l'écran avec des modifications en attente, on les enregistre
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(timerModeleRef.current);
      if (dirtyRef.current.size > 0) ecrireSections();
      if (dirtyModeleRef.current) ecrireModele();
    };
  }, [ecrireSections, ecrireModele]);

  const sauverMeta = async (patch) => {
    const suivant = { ...latestRef.current, ...patch };
    latestRef.current = suivant;
    setPrive(suivant);
    try {
      await setDoc(doc(db, 'accord_prive', uid), { uid, ...patch, maj: serverTimestamp() }, { merge: true });
      // Si je suis l'administratrice et que je relie ma partenaire, son accès au modèle suit
      if (patch.partenaireUid !== undefined && suivant.admin && !dirtyModeleRef.current) {
        await setDoc(doc(db, 'accord_modele', uid), { partenaireUid: patch.partenaireUid }, { merge: true }).catch(() => {});
      }
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
        reponses: propre(latestRef.current.sections[sid] || {}),
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

  // --- Noms : P1 / P2 remplacés par les prénoms choisis par l'administratrice ---
  const nomP1 = modele.noms?.P1 || '';
  const nomP2 = modele.noms?.P2 || '';
  const nomme = useCallback(
    (str) => {
      if (typeof str !== 'string') return str;
      let r = str;
      if (nomP1) r = r.replace(/\bP1\b/g, nomP1);
      if (nomP2) r = r.replace(/\bP2\b/g, nomP2);
      return r;
    },
    [nomP1, nomP2]
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

  const sections = modele.sections || [];

  // ===================================================================
  // ÉCRAN D'UNE SECTION
  // ===================================================================
  if (sectionOuverte) {
    const indexSection = sections.findIndex((s) => s.id === sectionOuverte);
    const section = sections[indexSection];
    if (!section) {
      // la section a été supprimée par l'administratrice
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <p style={{ fontSize: '13.5px', color: '#8A7B68' }}>Cette section n’existe plus.</p>
          <button onClick={() => setSectionOuverte(null)} style={{ border: 'none', background: 'none', color: ACCENT, fontWeight: '800', cursor: 'pointer' }}>Retour à la liste</button>
        </div>
      );
    }
    const donnees = prive.sections[section.id] || {};
    const monPartage = mesPartages[section.id];
    const sonPartage = sesPartages[section.id];
    const aChange = monPartage ? stable(monPartage.reponses || {}) !== stable(donnees) : false;
    const peutComparer = !!monPartage && !!sonPartage;

    const retour = async () => {
      clearTimeout(timerRef.current);
      await ecrireSections();
      if (dirtyModeleRef.current) { clearTimeout(timerModeleRef.current); await ecrireModele(); }
      setSectionOuverte(null);
      setVue('saisie');
      setModeEdition(false);
    };

    // --- Modifications du modèle pour cette section ---
    const majSection = (fn) => majModele((m) => { fn(m.sections.find((s) => s.id === section.id)); });
    const deplacer = (tableau, i, delta) => {
      const j = i + delta;
      if (j < 0 || j >= tableau.length) return;
      [tableau[i], tableau[j]] = [tableau[j], tableau[i]];
    };

    return (
      <div>
        <button onClick={retour} style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer', padding: '0 0 12px 0' }}>
          <IconArrowLeft size={15} /> Toutes les sections
        </button>

        {modeEdition ? (
          // ---------------- MODE ADMINISTRATRICE : modifier les questions ----------------
          <div>
            <div style={{ backgroundColor: ACCENT_BG, borderRadius: '14px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '800', color: ACCENT }}>✏️ Tu modifies les questions</p>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.45' }}>
                Tes changements sont enregistrés tout seuls et visibles tout de suite par ta partenaire. Les réponses déjà données restent en place.
              </p>
              <p style={{ margin: '6px 0 0 0', fontSize: '11.5px', fontWeight: '700', color: statutModele.startsWith('Erreur') ? '#B3453A' : '#16A06B', minHeight: '14px' }}>{statutModele}</p>
              <button onClick={() => setModeEdition(false)} style={{ marginTop: '8px', padding: '9px 14px', borderRadius: '11px', border: 'none', backgroundColor: ACCENT, color: '#FFF', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}>
                Terminer les modifications
              </button>
            </div>

            <label style={labelStyle}>Titre de la section</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
              <input type="text" value={section.emoji || ''} onChange={(e) => majSection((s) => { s.emoji = e.target.value; })} style={{ ...inputStyle, width: '64px', textAlign: 'center', flexShrink: 0 }} />
              <input type="text" value={section.titre || ''} onChange={(e) => majSection((s) => { s.titre = e.target.value; })} style={inputStyle} />
            </div>
            <label style={labelStyle}>Texte d’introduction</label>
            <textarea rows={3} value={section.intro || ''} onChange={(e) => majSection((s) => { s.intro = e.target.value; })} style={{ ...inputStyle, resize: 'vertical', fontSize: '14px', marginBottom: '20px' }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {section.blocs.map((b, bi) => (
                <div key={bi} style={{ borderTop: '2px solid #E8DFCF', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                    <input
                      type="text"
                      placeholder="Titre du bloc (facultatif)"
                      value={b.titre || ''}
                      onChange={(e) => majSection((s) => { s.blocs[bi].titre = e.target.value; })}
                      style={{ ...inputStyle, fontWeight: '800' }}
                    />
                    <button type="button" disabled={bi === 0} onClick={() => majSection((s) => deplacer(s.blocs, bi, -1))} style={{ ...petitBouton, opacity: bi === 0 ? 0.3 : 1 }}><IconArrowUp size={17} /></button>
                    <button type="button" disabled={bi === section.blocs.length - 1} onClick={() => majSection((s) => deplacer(s.blocs, bi, 1))} style={{ ...petitBouton, opacity: bi === section.blocs.length - 1 ? 0.3 : 1 }}><IconArrowDown size={17} /></button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Supprimer ce bloc et toutes ses questions ?')) majSection((s) => { s.blocs.splice(bi, 1); });
                      }}
                      style={{ ...petitBouton, color: '#B3453A' }}
                    >
                      <IconTrash size={17} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {b.champs.map((c, ci) => (
                      <EditeurQuestion
                        key={c.id || ci}
                        champ={c}
                        index={ci}
                        total={b.champs.length}
                        onChange={(nouveau) => majSection((s) => { s.blocs[bi].champs[ci] = nouveau; })}
                        onMove={(delta) => majSection((s) => deplacer(s.blocs[bi].champs, ci, delta))}
                        onDelete={() => {
                          if (window.confirm('Supprimer cette question ?')) majSection((s) => { s.blocs[bi].champs.splice(ci, 1); });
                        }}
                      />
                    ))}
                    <BoutonAjouterQuestion onAjouter={(q) => majSection((s) => { s.blocs[bi].champs.push(q); })} />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => majSection((s) => { s.blocs.push({ titre: 'Nouveau bloc', champs: [] }); })}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1.5px dashed #D9CDB8', background: 'transparent', borderRadius: '12px', padding: '12px', color: '#8A7B68', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                <IconPlus size={15} /> Ajouter un bloc de questions
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Supprimer toute cette section ? Les réponses déjà données ne seront plus affichées.')) {
                    majModele((m) => { m.sections = m.sections.filter((s) => s.id !== section.id); });
                    setModeEdition(false);
                    setSectionOuverte(null);
                  }
                }}
                style={{ padding: '12px', borderRadius: '12px', border: '1px solid #F3D2D0', backgroundColor: '#FEF2F2', color: '#B3453A', fontWeight: '800', fontSize: '13px', cursor: 'pointer' }}
              >
                Supprimer cette section
              </button>
            </div>
          </div>
        ) : (
          // ---------------- MODE NORMAL : répondre / comparer ----------------
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>
                {section.emoji} {nomme(section.titre)}
              </h3>
              {estAdmin && (
                <button onClick={() => setModeEdition(true)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 11px', borderRadius: '10px', border: `1.5px solid ${ACCENT}`, backgroundColor: '#FFF', color: ACCENT, fontWeight: '800', fontSize: '12px', cursor: 'pointer' }}>
                  <IconPencil size={14} /> Modifier
                </button>
              )}
            </div>
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
                          {nomme(b.titre)}
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
                  {section.blocs.length === 0 && <p style={{ fontSize: '13px', color: '#B5A793', textAlign: 'center' }}>Cette section est vide pour l’instant.</p>}
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
        )}
      </div>
    );
  }

  // ===================================================================
  // ÉCRAN D'ACCUEIL : dates, liaison des comptes, administration, sections
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
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
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

      {/* Administration */}
      <div style={{ backgroundColor: '#FFFFFF', border: `1px solid ${estAdmin ? ACCENT : '#E8DFCF'}`, borderRadius: '16px', padding: '14px', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <IconSettings size={17} color={ACCENT} />
          <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#2B2420' }}>Administration</span>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '9px', cursor: 'pointer', marginBottom: estAdmin ? '12px' : 0 }}>
          <input type="checkbox" checked={estAdmin} onChange={(e) => sauverMeta({ admin: e.target.checked })} style={{ marginTop: '3px', width: '17px', height: '17px', accentColor: ACCENT }} />
          <span style={{ fontSize: '12.5px', color: '#8A7B68', lineHeight: '1.45' }}>
            Je gère les questions et les prénoms. Ma partenaire voit mes changements, mais ne peut pas les modifier. <b>À cocher par une seule de vous deux.</b>
          </span>
        </label>

        {estAdmin && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prénom de P1 (titulaire du bail)</label>
                <input type="text" value={nomP1} onChange={(e) => majModele((m) => { m.noms = { ...(m.noms || {}), P1: e.target.value }; })} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Prénom de P2 (qui emménage)</label>
                <input type="text" value={nomP2} onChange={(e) => majModele((m) => { m.noms = { ...(m.noms || {}), P2: e.target.value }; })} style={inputStyle} />
              </div>
            </div>
            <p style={{ margin: '0 0 10px 0', fontSize: '11.5px', fontWeight: '700', color: statutModele.startsWith('Erreur') ? '#B3453A' : '#16A06B', minHeight: '14px' }}>{statutModele}</p>
            <button
              type="button"
              onClick={() => majModele((m) => { m.sections.push({ id: nouvelId('s'), titre: 'Nouvelle section', emoji: '📝', intro: '', blocs: [{ titre: '', champs: [] }] }); })}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: `1.5px dashed ${ACCENT}`, background: 'transparent', borderRadius: '12px', padding: '11px', color: ACCENT, fontSize: '13px', fontWeight: '800', cursor: 'pointer' }}
            >
              <IconPlus size={15} /> Ajouter une section
            </button>
          </div>
        )}
      </div>

      {/* Liste des sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sections.map((s, i) => {
          const { faites, total } = compterReponses(s, prive.sections[s.id] || {});
          const moi = !!mesPartages[s.id];
          const elle = !!sesPartages[s.id];
          return (
            <div
              key={s.id}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', backgroundColor: '#FFFFFF', border: '1px solid #E8DFCF', borderRadius: '18px' }}
            >
              <div
                onClick={() => { setSectionOuverte(s.id); setVue('saisie'); setStatutSauvegarde(''); setModeEdition(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0, cursor: 'pointer' }}
              >
                <div style={{ flexShrink: 0, width: '44px', height: '44px', borderRadius: '13px', backgroundColor: ACCENT_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '21px' }}>
                  {s.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px 0', fontSize: '14.5px', fontWeight: '800', color: '#2B2420', fontFamily: "'Playfair Display', Georgia, serif" }}>{nomme(s.titre)}</p>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11.5px', color: '#B5A793', fontWeight: '700' }}>{faites}/{total} réponses</span>
                    {moi && <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#16A06B', backgroundColor: '#E6F9F1', padding: '2px 7px', borderRadius: '999px' }}>partagée</span>}
                    {elle && <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#6E8AA6', backgroundColor: '#EEF2F0', padding: '2px 7px', borderRadius: '999px' }}>elle a partagé</span>}
                  </div>
                </div>
              </div>
              {estAdmin ? (
                <div style={{ display: 'flex', flexShrink: 0 }}>
                  <button type="button" disabled={i === 0} onClick={() => majModele((m) => { [m.sections[i - 1], m.sections[i]] = [m.sections[i], m.sections[i - 1]]; })} style={{ ...petitBouton, opacity: i === 0 ? 0.3 : 1 }}><IconArrowUp size={17} /></button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => majModele((m) => { [m.sections[i + 1], m.sections[i]] = [m.sections[i], m.sections[i + 1]]; })} style={{ ...petitBouton, opacity: i === sections.length - 1 ? 0.3 : 1 }}><IconArrowDown size={17} /></button>
                </div>
              ) : (
                <IconChevronRight size={18} color="#B5A793" style={{ flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
