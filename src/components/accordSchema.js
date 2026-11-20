// =====================================================================
// SCHÉMA DE L'ACCORD DE COHABITATION
// Tout le contenu du PDF "Notre vie à deux" est décrit ici, sous forme
// de données. Le composant AccordCohabitation.jsx lit ce fichier pour
// afficher le formulaire. Pour modifier une question, une option ou
// ajouter un champ, c'est ici que ça se passe.
// =====================================================================

// --- Constantes du loyer (section 1.1) ---
export const LOYER_NET = 2050;
export const PARKING_P1 = 150;
export const PARKING_P2 = 100;

export const chf = (n) =>
  Number(n).toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Parts de revenu (prorata) pour deux revenus
export function calcParts(a, b) {
  const A = num(a);
  const B = num(b);
  const total = A + B;
  if (total <= 0) return null;
  return { total, p1: (A / total) * 100, p2: (B / total) * 100 };
}

// --- Petits constructeurs pour garder le schéma lisible ---
const info = (texte) => ({ type: 'info', texte });
const texte = (id, label, placeholder) => ({ id, type: 'texte', label, placeholder });
const long = (id, label, placeholder) => ({ id, type: 'long', label, placeholder });
const nombre = (id, label, unite) => ({ id, type: 'nombre', label, unite });
const date = (id, label) => ({ id, type: 'date', label });
const choix = (id, label, options) => ({ id, type: 'choix', label, options });
const cases = (id, label, options) => ({ id, type: 'cases', label, options });
const grille = (id, label, lignes, colonnes) => ({ id, type: 'grille', label, lignes, colonnes });
const tableau = (id, label, colonnes) => ({ id, type: 'tableau', label, colonnes });
const l = (id, label, over) => ({ id, label, over });

// --- Listes d'options réutilisées ---
const NOTE = ['A', 'B', 'C', 'D'];
const QUI = ['P1', 'P2', 'à tour de rôle'];
const PRORATA_50 = ['prorata', '50/50'];
const NIVEAU = ['1', '2', '3'];
const OUI_NON = ['oui', 'non'];

const colTache = [
  { id: 'note', label: 'Ma note (A adore · B ok · C bof · D j’aime pas)', type: 'choix', options: NOTE },
  { id: 'qui', label: 'Qui s’en occupe', type: 'choix', options: QUI },
  { id: 'com', label: 'Commentaire', type: 'texte' }
];

const colMinimum = [{ id: 'qui', label: 'Qui s’en charge', type: 'choix', options: ['P1', 'P2', 'celle qui peut'] }];

export const SECTIONS = [
  // ===================================================================
  {
    id: 's0',
    titre: 'Notre situation de départ',
    emoji: '🏠',
    intro:
      'Les prénoms que tu écris ici remplacent « P1 » et « P2 » dans tout le document. P1 = la personne titulaire du bail, déjà dans le logement avec ses 2 chats ; P2 = celle qui emménage.',
    blocs: [
      {
        champs: [
          texte('prenomP1', 'Prénom P1'),
          texte('prenomP2', 'Prénom P2'),
          texte('adresse', 'Logement : appartement de 2,5 pièces, adresse'),
          date('dateEmmenagement', 'Date d’emménagement de P2'),
          info('Animaux : 2 chats (propriété de P1).'),
          info('Ce que P2 quitte : un petit studio, meubles et affaires à trier avant le déménagement.')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's1',
    titre: '1. Argent',
    emoji: '💶',
    intro:
      'Le loyer se partage au prorata des revenus, validé par écrit, et chacune paie sa place de parc. Rien n’est pré-rempli pour pouvoir recalculer après un changement.',
    blocs: [
      {
        titre: '1.1 Loyer et places de parc',
        champs: [
          nombre('revenuP1', 'Revenu net mensuel retenu de P1 (A)', 'CHF'),
          nombre('revenuP2', 'Revenu net mensuel retenu de P2 (B)', 'CHF'),
          { id: 'loyerCalc', type: 'loyerCalc' },
          info(
            'Le loyer actuel est de 2 200 CHF net, dont 150 CHF de place de parc. La place extérieure de P2 (100 CHF) s’y ajoute : à faire confirmer par la régie avant l’emménagement.'
          ),
          cases('repValidee', 'Répartition', ['validée par écrit']),
          date('repValideeLe', 'Validée le'),
          cases('parcConfirmee', 'Place extérieure de P2', ['confirmée par la régie']),
          texte('parcNumero', 'Numéro de la place'),
          date('parcDepuis', 'À partir du'),
          choix('paiementRegie', 'Comment on paie la régie', [
            'P1 paie tout et P2 lui vire sa part',
            'chacune paie directement sa part',
            'depuis le compte commun (1.4)'
          ]),
          nombre('jourVirement', 'Virement de P2 avant le … du mois', 'jour'),
          nombre('retardPrevenir', 'Si un virement a du retard : on se prévient au plus tard le … du mois', 'jour'),
          nombre('retardJours', 'et on règle sous', 'jours')
        ]
      },
      {
        titre: '1.2 Charges et frais courants',
        champs: [
          texte('chargesAutreLabel', 'Poste « Autre » (précise lequel)'),
          grille(
            'charges',
            'Pour chaque poste',
            [
              l('charges', 'Charges et chauffage (acompte à la régie)'),
              l('electricite', 'Électricité'),
              l('internet', 'Internet et téléphonie fixe'),
              l('tv', 'Redevance radio-TV (une par ménage)'),
              l('assurance', 'Assurance ménage et RC'),
              l('abos', 'Abonnements partagés (streaming, musique)'),
              l('produits', 'Produits ménagers et d’entretien'),
              l('chatsCroq', 'Chats : croquettes et litière', { repartition: ['P1 seule', 'prorata', '50/50'] }),
              l('chatsVeto', 'Chats : vétérinaire courant', { repartition: ['P1 seule', 'prorata', '50/50'] }),
              l('autre', 'Autre')
            ],
            [
              { id: 'montant', label: 'Montant par mois', type: 'nombre', unite: 'CHF' },
              { id: 'repartition', label: 'Répartition', type: 'choix', options: PRORATA_50 },
              { id: 'avance', label: 'Qui avance', type: 'choix', options: ['P1', 'P2'] }
            ]
          ),
          info(
            'Restent à la charge de chacune : téléphone mobile, assurance maladie, impôts, voiture (assurance, entretien, essence) et abonnements personnels.'
          ),
          nombre('vetoSeuil', 'Frais vétérinaires imprévus (opération, urgence) : au-delà de … on décide ensemble', 'CHF'),
          choix('vetoQui', 'Dans ce cas', ['P1 seule paie', 'on partage au prorata', 'on partage 50/50'])
        ]
      },
      {
        titre: '1.3 Courses et repas',
        champs: [
          choix('courses', 'Courses courantes', ['au prorata', '50/50', 'chacune ses courses', 'budget commun']),
          nombre('budgetCourses', 'Si budget commun : montant par mois', 'CHF'),
          choix('produitsPerso', 'Produits personnels (snacks, boissons, cosmétiques)', ['chacune les siens', 'on partage']),
          choix('restos', 'Restaurants, livraisons, repas avec invités', [
            'chacune paie sa part',
            'on alterne',
            'depuis le compte commun'
          ]),
          long('habitudesRepas', 'Aliments ou habitudes à clarifier (ce qu’on ne veut pas voir dans le frigo, horaires des repas)')
        ]
      },
      {
        titre: '1.4 Compte commun et dépenses personnelles',
        champs: [
          choix('compte', 'Compte commun', ['oui', 'non, un virement mensuel suffit', 'à tester']),
          nombre('compteTest', 'Si à tester : pendant … mois', 'mois'),
          nombre('versementP1', 'Versement mensuel au compte commun : P1', 'CHF'),
          nombre('versementP2', 'Versement mensuel au compte commun : P2', 'CHF'),
          nombre('persoP1', 'Argent personnel libre, sans justification, par mois : P1', 'CHF'),
          nombre('persoP2', 'Argent personnel libre, sans justification, par mois : P2', 'CHF'),
          choix('carteP1', 'Carte liée au compte commun : P1', OUI_NON),
          choix('carteP2', 'Carte liée au compte commun : P2', OUI_NON),
          cases('payeCompte', 'On paie depuis le compte commun', [
            'charges',
            'courses',
            'assurance ménage',
            'chats',
            'sorties à deux',
            'cadeaux communs',
            'autre'
          ]),
          nombre('achatSeuil', 'Achat important : au-delà de … (meuble, électroménager, voyage) on en parle avant d’acheter', 'CHF'),
          choix('dettes', 'Dettes, crédits, leasing en cours', ['rien à signaler', 'oui, on en parle franchement']),
          long('dettesDetail', 'Si oui, lesquels'),
          choix('prets', 'Prêts entre nous', ['non', 'oui, notés par écrit']),
          nombre('pretsSeuil', 'Prêts notés par écrit au-delà de', 'CHF'),
          date('pretsAvant', 'Remboursés avant le')
        ]
      },
      {
        titre: '1.5 Épargne et projets',
        champs: [
          grille(
            'epargne',
            'Objectifs',
            [
              l('urgence', 'Fonds d’urgence commun (3 mois de dépenses communes)'),
              l('vacances', 'Vacances'),
              l('meubles', 'Meubles et électroménager à acheter ou remplacer'),
              l('autre', 'Autre')
            ],
            [
              { id: 'montant', label: 'Montant visé', type: 'nombre', unite: 'CHF' },
              { id: 'p1', label: 'P1 verse par mois', type: 'nombre', unite: 'CHF' },
              { id: 'p2', label: 'P2 verse par mois', type: 'nombre', unite: 'CHF' },
              { id: 'echeance', label: 'Échéance', type: 'date' }
            ]
          ),
          choix('epargnePerso', 'Épargne et prévoyance personnelles', ['chacune gère les siennes', 'on en parle une fois par an'])
        ]
      },
      {
        titre: '1.6 Si un revenu change : révision du prorata',
        champs: [
          info(
            'La part de chacune se recalcule ainsi : revenu net de la personne ÷ (revenu net de P1 + revenu net de P2). Le nouveau prorata s’applique au loyer sans parking.'
          ),
          nombre('seuilRevenu', 'On recalcule dès qu’il y a une hausse ou baisse de revenu de plus de', '%'),
          nombre('seuilConge', 'ou un arrêt de travail ou un congé de plus de', 'mois'),
          cases('declencheurs', 'On recalcule aussi en cas de', ['changement d’emploi', 'formation', 'autre']),
          texte('declAutre', 'Autre déclencheur'),
          nombre('delaiSemaines', 'Délai : on en parle dans les … semaines, effet au 1er du mois suivant', 'semaines'),
          choix('preuve', 'Preuve', ['fiche de salaire', 'décision ou contrat', 'simple déclaration']),
          choix('baisseTemp', 'Baisse temporaire', ['on recalcule tout de suite', 'on garde le prorata actuel pendant un temps, puis on recalcule']),
          nombre('baisseMois', 'Si on garde le prorata : pendant', 'mois'),
          tableau('histoRevenus', 'Historique des révisions', [
            { id: 'date', label: 'Date', type: 'date' },
            { id: 'a', label: 'Revenu net P1 (A)', type: 'nombre', unite: 'CHF' },
            { id: 'b', label: 'Revenu net P2 (B)', type: 'nombre', unite: 'CHF' },
            {
              id: 'total',
              label: 'Total (A + B)',
              type: 'calc',
              calc: (r) => (num(r.a) + num(r.b) > 0 ? `${chf(num(r.a) + num(r.b))} CHF` : '')
            },
            {
              id: 'partP1',
              label: 'Part P1',
              type: 'calc',
              calc: (r) => {
                const p = calcParts(r.a, r.b);
                return p ? `${p.p1.toFixed(1)} %` : '';
              }
            },
            {
              id: 'partP2',
              label: 'Part P2',
              type: 'calc',
              calc: (r) => {
                const p = calcParts(r.a, r.b);
                return p ? `${p.p2.toFixed(1)} %` : '';
              }
            },
            {
              id: 'loyerP1',
              label: 'Loyer P1 (sans parking)',
              type: 'calc',
              calc: (r) => {
                const p = calcParts(r.a, r.b);
                return p ? `${chf((LOYER_NET * p.p1) / 100)} CHF` : '';
              }
            },
            {
              id: 'loyerP2',
              label: 'Loyer P2 (sans parking)',
              type: 'calc',
              calc: (r) => {
                const p = calcParts(r.a, r.b);
                return p ? `${chf((LOYER_NET * p.p2) / 100)} CHF` : '';
              }
            }
          ])
        ]
      },
      {
        titre: '1.7 Garantie de loyer, bail et assurances',
        champs: [
          nombre('garantie', 'Garantie de loyer déjà versée par P1 (au plus 3 mois de loyer net dans le canton de Vaud)', 'CHF'),
          choix('garantieQui', 'Garantie', [
            'Elle reste celle de P1, P2 ne verse rien',
            'P2 y contribue (rendu si elle part ou si le bail prend fin)'
          ]),
          nombre('garantieContrib', 'Contribution de P2', 'CHF'),
          choix('statutBail', 'Statut de P2 sur le bail', [
            'P1 reste seule titulaire et la régie est informée que P2 habite le logement',
            'P2 devient colocataire par avenant signé avec la régie',
            'autre'
          ]),
          texte('statutAutre', 'Autre statut'),
          info(
            'Un concubin ne peut pas être imposé à la régie comme colocataire : il faut son accord. Devenir colocataire signifie aussi répondre du loyer entier envers la régie. À vérifier avec la régie et le bail avant de choisir.'
          ),
          choix('assuranceMenage', 'Assurance ménage et RC', [
            'une police au nom de P1, P2 ajoutée',
            'une police au nom des deux',
            'P2 garde la sienne, mise à jour'
          ]),
          cases('papiers', 'Adresses et papiers', [
            'annonce de changement d’adresse de P2 à la commune',
            'contrats et abonnements de P2 mis à jour',
            'boîte aux lettres et sonnette au nom de P2'
          ])
        ]
      },
      {
        titre: '1.8 Si on se sépare : qui garde quoi',
        champs: [
          info('On le décide maintenant, quand tout va bien, pour ne pas le découvrir en pleine dispute.'),
          grille(
            'separation',
            'Qui garde quoi',
            [
              l('chats', 'Les chats', { convenu: ['restent avec P1', 'autre'] }),
              l('meubles', 'Meubles et affaires apportés par chacune', { convenu: ['chacune reprend les siens'] }),
              l('achats', 'Achats faits à deux', {
                convenu: ['revendus, produit partagé', 'l’une rachète la part de l’autre', 'selon la liste ci-dessous']
              }),
              l('compte', 'Solde du compte commun', {
                convenu: ['partagé au prorata des versements', 'partagé 50/50']
              }),
              l('epargne', 'Épargne et fonds d’urgence communs', {
                convenu: ['partagés au prorata des versements', 'partagés 50/50']
              }),
              l('garantie', 'Garantie de loyer', { convenu: ['selon 1.7'] }),
              l('abos', 'Internet, électricité, abonnements communs', { convenu: ['résiliés', 'repris par une de nous'] }),
              l('parking', 'Places de parc', { convenu: ['chacune garde la sienne tant que son bail ou sa location court'] }),
              l('dettes', 'Dettes ou avances en cours entre nous', { convenu: ['réglées avant le départ'] })
            ],
            [
              { id: 'convenu', label: 'Ce qu’on a convenu', type: 'choix', options: [] },
              { id: 'remarque', label: 'Remarque', type: 'texte' }
            ]
          ),
          tableau('achatsCommuns', 'Achats communs importants (à compléter au fil du temps)', [
            { id: 'objet', label: 'Objet', type: 'texte' },
            { id: 'date', label: 'Date', type: 'date' },
            { id: 'prix', label: 'Prix', type: 'nombre', unite: 'CHF' },
            { id: 'paye', label: 'Payé par', type: 'texte' },
            { id: 'garde', label: 'Qui le garde', type: 'texte' }
          ])
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's2',
    titre: '2. Tâches domestiques',
    emoji: '🧹',
    intro:
      'Note chaque tâche seule : A = j’adore · B = ok · C = bof mais ça ne me dérange pas · D = j’aime pas. On distribue d’abord ce que l’une adore et que l’autre déteste, ensuite on se partage le reste.',
    blocs: [
      {
        titre: 'Cuisine et repas',
        champs: [
          grille(
            'cuisine',
            'Tâches',
            [
              l('menus', 'Penser aux menus de la semaine'),
              l('liste', 'Faire la liste de courses'),
              l('courses', 'Faire les courses'),
              l('cuisSem', 'Cuisiner (semaine)'),
              l('cuisWe', 'Cuisiner (week-end)'),
              l('vaisselle', 'Vaisselle et lave-vaisselle (remplir, vider)'),
              l('plan', 'Nettoyer plan de travail, plaques, évier'),
              l('frigo', 'Trier le frigo et jeter ce qui est périmé')
            ],
            colTache
          )
        ]
      },
      {
        titre: 'Linge',
        champs: [
          grille(
            'linge',
            'Tâches',
            [
              l('lessive', 'Lessive : lancer la machine', { qui: ['P1', 'P2', 'chacune la sienne'] }),
              l('etendre', 'Linge : étendre, plier, ranger', { qui: ['P1', 'P2', 'chacun le sien'] }),
              l('repassage', 'Repassage', { qui: ['P1', 'P2', 'chacune le sien'] }),
              l('draps', 'Changer les draps')
            ],
            colTache
          )
        ]
      },
      {
        titre: 'Ménage et rangement',
        champs: [
          grille(
            'menage',
            'Tâches',
            [
              l('aspi', 'Aspirateur et sols'),
              l('poussieres', 'Poussières et surfaces'),
              l('sdb', 'Salle de bain (douche, lavabo, miroir)'),
              l('wc', 'WC'),
              l('salon', 'Ranger le salon et l’entrée au quotidien', { qui: ['P1', 'P2', 'chacune ses affaires'] }),
              l('vitres', 'Vitres, balcon, plantes'),
              l('poubelles', 'Poubelles, tri, verre, carton'),
              l('racheter', 'Racheter ce qui manque (papier WC, lessive, savon)'),
              l('trier', 'Trier et désencombrer (placards, caves)', { qui: ['P1', 'P2', 'ensemble'] })
            ],
            colTache
          )
        ]
      },
      {
        titre: 'Chats, voitures, administratif',
        champs: [
          grille(
            'admin',
            'Tâches',
            [
              l('litiere', 'Chats : litière (responsabilité de P1)', { qui: ['P1', 'P2', 'voir ci-dessous'] }),
              l('croquettes', 'Chats : croquettes, eau, jeux'),
              l('veto', 'Chats : vétérinaire, vaccins, rendez-vous', { qui: ['P1', 'P2'] }),
              l('poils', 'Chats : poils et griffes (aspirer, protéger les meubles)'),
              l('voitures', 'Voitures : entretien, pneus, lavage', { qui: ['chacune la sienne', 'on s’entraide'] }),
              l('factures', 'Factures, paiements, rappels'),
              l('courrier', 'Courrier, papiers, classement'),
              l('assurances', 'Assurances, contrats, impôts', { qui: ['P1', 'P2', 'chacune les siens'] }),
              l('regie', 'Contact avec la régie, les voisins, les réparations'),
              l('agenda', 'Agenda commun, rendez-vous, week-ends, vacances', { qui: ['P1', 'P2', 'ensemble'] }),
              l('cadeaux', 'Cadeaux, anniversaires, cartes aux proches', { qui: ['P1', 'P2', 'chacune ses proches'] }),
              l('autre', 'Autre')
            ],
            colTache
          )
        ]
      },
      {
        titre: 'La litière des chats',
        champs: [
          info(
            'La litière reste la responsabilité de P1, puisque ce sont ses chats. La question est ce qui se passe quand P1 est absente ou très fatiguée. À remplir par P2, seule, en toute franchise.'
          ),
          choix('litiere', 'Réponse de P2', [
            'Oui, je la fais sans problème',
            'Oui, mais pas plus de … fois par semaine ou par mois',
            'Oui, quand P1 me le demande clairement (phrase code, section 3)',
            'Non, pas la litière. On trouve autre chose',
            'À essayer pendant un temps, puis on en reparle'
          ]),
          texte('litiereFreq', 'Si « pas plus de … » : combien de fois, par semaine ou par mois ?'),
          cases('litiereAlt', 'Si non, on trouve autre chose', ['litière autonome', 'voisin ou proche', 'aide payante', 'autre']),
          texte('litiereAutre', 'Autre solution'),
          nombre('litiereEssai', 'Si à essayer : pendant', 'semaines'),
          cases('autresSoins', 'Autres soins aux chats que P2 accepte', [
            'croquettes et eau',
            'jeux et câlins',
            'appeler le vétérinaire en urgence',
            'garde quand P1 voyage',
            'aucun'
          ]),
          texte('echange', 'En échange ou en remerciement'),
          info('Un coup de main ponctuel ne devient pas un devoir : si P2 dépanne la litière, on se le redit à chaque révision (section 9).')
        ]
      },
      {
        titre: 'Bilan',
        champs: [
          texte('tachesDD', 'Tâches que ni l’une ni l’autre n’aime (D des deux côtés)'),
          choix('tachesDDsol', 'Pour ces tâches', [
            'on alterne',
            'on la fait ensemble avec de la musique',
            'on la délègue (aide ménagère)',
            'on baisse le standard'
          ]),
          nombre('budgetAide', 'Budget aide ménagère', 'CHF'),
          texte('regP1', 'Tâches régulières de P1'),
          texte('regP2', 'Tâches régulières de P2'),
          texte('regTour', 'Tâches à tour de rôle'),
          choix('justeTaches', 'Est-ce que ça nous semble juste ?', ['oui', 'non, on ajuste']),
          texte('ajusteTaches', 'On ajuste comment ?')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's3',
    titre: '3. Quand on est toutes les deux fatiguées',
    emoji: '🔋',
    intro:
      'Quand on est à plat toutes les deux, on garde le minimum vital, on reporte le reste et on le dit avec une phrase code, sans reproche.',
    blocs: [
      {
        titre: '3.1 Minimum vital (même épuisées)',
        champs: [
          grille(
            'minimum',
            'Minimum vital',
            [
              l('chatsCroq', 'Chats : croquettes et eau'),
              l('litiere', 'Chats : litière ramassée au moins une fois par jour'),
              l('repas', 'Un repas simple (pâtes, œufs, surgelé, plat à emporter)'),
              l('vaisselle', 'Vaisselle : lave-vaisselle lancé ou trempage'),
              l('poubelle', 'Poubelle pleine sortie'),
              l('autre', 'Autre')
            ],
            colMinimum
          )
        ]
      },
      {
        titre: '3.2 Ce qu’on peut reporter sans culpabiliser',
        champs: [
          cases('reporter', 'On peut reporter', [
            'aspirateur',
            'salle de bain à fond',
            'repassage',
            'vitres',
            'rangement et tri',
            'lessive non urgente',
            'courrier non urgent',
            'courses non vitales',
            'autre'
          ]),
          texte('reporterAutre', 'Autre'),
          nombre('delaiReport', 'Délai maximum de report (au-delà, la tâche passe en tête de la liste de la semaine suivante)', 'jours')
        ]
      },
      {
        titre: '3.3 Plan de secours',
        champs: [
          cases('aucunRepas', 'Aucun repas prévu', ['plats de secours au congélateur', 'livraison ou plat à emporter']),
          nombre('repasSecours', 'Plats de secours : au moins … repas', 'repas'),
          nombre('livraisonBudget', 'Budget livraison ou plat à emporter', 'CHF'),
          cases('stockChats', 'Stock de secours pour les chats', ['croquettes pour quelques jours', 'un sac de litière d’avance']),
          nombre('stockJours', 'Croquettes pour … jours', 'jours'),
          texte('personneChats', 'Personne ne peut s’occuper des chats : qui appeler'),
          texte('personneTel', 'Téléphone'),
          cases('vrille', 'Le logement part en vrille', ['aide ménagère ponctuelle', 'un proche vient donner un coup de main']),
          nombre('vrilleBudget', 'Budget aide ménagère ponctuelle', 'CHF'),
          texte('vrilleProche', 'Quel proche ?'),
          choix('unePlat', 'Une seule est à plat : l’autre prend le minimum vital. En retour', [
            'on rend la pareille',
            'on le note, on rééquilibre à la fin du mois'
          ]),
          nombre('epuisementSem', 'Si l’épuisement dure plus de … semaines : on l’a dit, on enlève quelque chose de l’agenda et on cherche de l’aide', 'semaines'),
          cases('epuisementAide', 'On cherche de l’aide auprès de', ['médecin', 'employeur', 'proches', 'autre'])
        ]
      },
      {
        titre: '3.4 Notre phrase code',
        champs: [
          texte('phraseCode', 'Pour dire « je suis à plat, je ne peux plus rien porter »', 'ex : « mode économie d’énergie »'),
          texte('reponseCode', 'Réponse de l’autre', 'ex : « je prends le minimum vital »'),
          texte('phrasePause', 'Pour dire « j’ai besoin d’une pause, on en parle plus tard »'),
          cases('reglesCode', 'Règles du jeu', [
            'on la dit sans avoir à se justifier',
            'personne ne la discute sur le moment',
            'la pause dure au plus un temps convenu',
            'si elle revient trop souvent, on en reparle sous 48 heures',
            'signal visuel possible'
          ]),
          nombre('pauseMinutes', 'La pause dure au plus', 'minutes'),
          nombre('retourFois', 'Si elle revient plus de … fois par semaine, on en reparle sous 48 heures', 'fois'),
          cases('signal', 'Signal visuel', ['post-it sur le frigo', 'message avec un mot convenu'])
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's4',
    titre: '4. Charge mentale et standards de propreté',
    emoji: '🧠',
    intro: 'La charge mentale, c’est penser, planifier et rappeler, pas seulement faire. On met à plat qui pense à quoi.',
    blocs: [
      {
        titre: '4.1 Qui pense à quoi',
        champs: [
          grille(
            'pense',
            'Ce à quoi il faut penser',
            [
              l('stock', 'Stock de produits (papier WC, lessive, litière, croquettes)'),
              l('menus', 'Menus et liste de courses'),
              l('factures', 'Échéances de factures et paiements'),
              l('veto', 'Rendez-vous et vaccins des chats', { devrait: ['P1', 'P2'] }),
              l('cadeaux', 'Anniversaires, cadeaux, cartes aux proches', { devrait: ['chacune ses proches', 'à tour de rôle'] }),
              l('agenda', 'Agenda commun, soirées, week-ends', { devrait: ['P1', 'P2', 'ensemble'] }),
              l('vacances', 'Vacances et réservations'),
              l('planning', 'Planning du ménage et de la lessive'),
              l('autre', 'Autre')
            ],
            [
              { id: 'aujourdhui', label: 'Qui y pense aujourd’hui', type: 'choix', options: ['P1', 'P2', 'les deux'] },
              { id: 'devrait', label: 'Qui devrait y penser', type: 'choix', options: QUI }
            ]
          ),
          cases('regles4', 'Nos règles', [
            'Qui prend une tâche la gère de A à Z : y penser, la faire, la finir, sans qu’on ait à la rappeler.',
            'Un seul rappel, par la liste ou l’agenda partagé, jamais trois.',
            'Pas de « dis-moi quoi faire » : celle qui a pris la tâche choisit comment, tant que le résultat respecte notre standard (4.2).',
            'Un point de 15 minutes chaque semaine.'
          ]),
          texte('jourPoint', 'Point hebdomadaire : jour'),
          texte('heurePoint', 'Point hebdomadaire : heure'),
          choix('outil', 'Outil commun', ['liste partagée sur le téléphone', 'tableau papier sur le frigo', 'agenda partagé', 'autre']),
          texte('outilAutre', 'Autre outil')
        ]
      },
      {
        titre: '4.2 Standards de propreté',
        champs: [
          info('Niveaux : 1 = rangé suffit · 2 = propre · 3 = impeccable. Chacune choisit son niveau, puis on fixe un standard commun, avec la fréquence maximale entre deux passages.'),
          grille(
            'standards',
            'Zones',
            [
              l('cuisine', 'Cuisine : plan de travail, plaques, évier'),
              l('sdb', 'Salle de bain : douche, lavabo, miroir'),
              l('wc', 'WC'),
              l('sols', 'Sols et aspirateur (poils de chats inclus)'),
              l('salon', 'Salon et entrée'),
              l('chambre', 'Chambre et lit'),
              l('draps', 'Draps et linge de lit'),
              l('litiere', 'Litière : changement complet'),
              l('balcon', 'Balcon, plantes, vitres')
            ],
            [
              { id: 'moi', label: 'Mon niveau', type: 'choix', options: NIVEAU },
              { id: 'commun', label: 'Standard commun', type: 'choix', options: NIVEAU },
              { id: 'jours', label: 'Au plus tous les …', type: 'nombre', unite: 'jours' }
            ]
          ),
          choix('vaisselleNuit', 'Vaisselle sale', ['jamais dans l’évier la nuit', 'au plus quelques heures', 'pas de règle']),
          nombre('vaisselleHeures', 'Au plus … heures', 'heures'),
          choix('lavevaisselle', 'Lave-vaisselle', ['chacune le range comme elle veut', 'méthode convenue', 'celle qui vide décide']),
          texte('lvMethode', 'Méthode convenue'),
          choix('traine', 'Affaires qui traînent', ['chacune range les siennes dans la journée', 'un panier « à ranger » qu’on vide un jour fixe']),
          texte('panierJour', 'Jour où on vide le panier'),
          cases('chaussures', 'Chaussures, vêtements sales, sacs', ['chaussures à l’entrée', 'linge sale au panier', 'sacs à un endroit fixe']),
          texte('sacsLieu', 'Endroit fixe pour les sacs'),
          texte('invitesRange', 'Invités : rangement minimum avant leur arrivée'),
          choix('regleOr', 'Notre règle d’or : quand le standard de l’une est plus haut que celui de l’autre', [
            'la plus exigeante fait elle-même la différence',
            'on se rejoint au milieu',
            'on délègue (aide ménagère)',
            'autre'
          ]),
          texte('regleOrAutre', 'Autre règle d’or')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's5',
    titre: '5. Espace perso, invités, famille, bruit, télétravail',
    emoji: '🛋️',
    intro:
      'Dans un 2,5 pièces, chaque mouvement de l’une se voit et s’entend chez l’autre : on prévoit donc d’avance où chacune range ses affaires, quand elle est seule, qui peut venir et ce qui est permis aux heures de calme.',
    blocs: [
      {
        titre: '5.1 Rangement, coin à soi et déco',
        champs: [
          grille(
            'rangement',
            'Répartition de l’espace',
            [
              l('armoire', 'Armoire et penderie'),
              l('commode', 'Commode, étagères'),
              l('sdb', 'Salle de bain (tiroirs, étagère, douche)'),
              l('cuisine', 'Cuisine (placards, frigo, congélateur)'),
              l('entree', 'Entrée (chaussures, manteaux)'),
              l('cave', 'Cave ou galetas')
            ],
            [
              { id: 'p1', label: 'Part de P1', type: 'nombre', unite: '%' },
              { id: 'p2', label: 'Part de P2', type: 'nombre', unite: '%' },
              { id: 'rem', label: 'Remarques', type: 'texte' }
            ]
          ),
          texte('garder', 'Affaires de P2 qui viennent du studio : à garder absolument'),
          texte('vendre', 'À vendre, donner ou stocker'),
          texte('coinP1', 'Un coin rien qu’à soi : P1'),
          texte('coinP2', 'Un coin rien qu’à soi : P2'),
          cases('deco', 'Déco et mobilier', [
            'on décide ensemble de tout ce qui est partagé',
            'chacune choisit pour ses propres objets'
          ]),
          cases('changer', 'Ce qu’on peut changer dans le logement', ['couleurs', 'disposition du salon', 'literie', 'déco murale', 'autre']),
          texte('changerAutre', 'Autre'),
          nombre('seuleHeures', 'Temps seule à la maison : au moins … heures par semaine (l’autre sort ou se met ailleurs, sans que ce soit un reproche)', 'heures'),
          texte('seuleJour', 'Jour'),
          choix('retourTravail', 'Retour du travail', ['15 minutes de sas avant de se parler', 'on se salue puis chacune souffle', 'pas de règle'])
        ]
      },
      {
        titre: '5.2 Sommeil et lit',
        champs: [
          grille(
            'sommeil',
            'Sujets',
            [
              l('chatsChambre', 'Chats dans la chambre la nuit', { accord: ['oui', 'non', 'porte fermée'] }),
              l('chatsLit', 'Chats sur le lit', { accord: ['oui', 'non', 'à certains endroits'] }),
              l('heures', 'Heure de coucher et de lever', { accord: [] }),
              l('temperature', 'Température, fenêtre ouverte ou fermée', { accord: ['ouverte', 'fermée', 'selon la saison'] }),
              l('ecrans', 'Écrans, lumière et réveil dans la chambre', {
                accord: ['écrans coupés à une heure fixe', 'liseuse ou casque seulement', 'libre']
              }),
              l('derange', 'Si l’une dérange le sommeil de l’autre', { accord: ['on dort séparément quand il le faut, sans drame', 'autre'] })
            ],
            [
              { id: 'accord', label: 'Notre accord', type: 'choix', options: [] },
              { id: 'precision', label: 'Précision (heures, endroits…)', type: 'texte' }
            ]
          )
        ]
      },
      {
        titre: '5.3 Invités et amis',
        champs: [
          choix('impro', 'Amis à l’improviste', ['oui', 'il faut prévenir à l’avance', 'jamais en semaine']),
          nombre('improHeures', 'Prévenir au moins … heures avant', 'heures'),
          nombre('soireePers', 'Soirées à la maison : au plus … personnes', 'personnes'),
          texte('soireeFin', 'Fin à (heure)'),
          nombre('soireesMois', 'Au plus … soirées par mois', 'soirées'),
          choix('dorment', 'Invités qui dorment chez nous', ['non (trop petit)', 'oui, d’accord toutes les deux', 'canapé seulement']),
          nombre('nuitsMois', 'Au plus … nuits par mois', 'nuits'),
          choix('amisSeuls', 'Amis seuls à la maison, sans l’hôte', ['oui', 'non', 'une personne de confiance']),
          texte('amisSeulsQui', 'Personne de confiance'),
          choix('chatsInvites', 'Chats et invités', ['les chats restent dans le salon', 'la chambre leur est réservée', 'on prévient les invités'])
        ]
      },
      {
        titre: '5.4 Famille et belle-famille',
        champs: [
          grille(
            'famille',
            'Visites chez nous',
            [l('p1', 'Famille de P1'), l('p2', 'Famille de P2'), l('amis', 'Amis proches de longue date')],
            [
              { id: 'fois', label: 'Fois', type: 'nombre', unite: 'fois' },
              { id: 'par', label: 'Par … jours', type: 'nombre', unite: 'jours' },
              { id: 'preavis', label: 'Préavis', type: 'texte' },
              { id: 'nuit', label: 'Nuit sur place', type: 'choix', options: ['non', 'oui'] },
              { id: 'nuitsMax', label: 'Nuits max', type: 'nombre', unite: 'nuits' }
            ]
          ),
          cases('reglesFamille', 'Règles', [
            'chacune gère sa propre famille (appels, conflits, demandes)',
            'on se soutient devant les proches de l’autre',
            'on ne critique pas la famille de l’autre quand elle est présente',
            'le « non » à une visite se dit à deux, avec une phrase préparée'
          ]),
          texte('phraseNon', 'Phrase préparée pour dire non'),
          choix('argentFamille', 'Argent de la famille (prêts, cadeaux, aides)', [
            'on en parle toujours avant de dire oui',
            'chacune décide pour ce qui la concerne'
          ])
        ]
      },
      {
        titre: '5.5 Bruit et voisinage',
        champs: [
          nombre('calmeDe', 'Heures calmes dans l’immeuble (règlement de maison) : de … h', 'h'),
          nombre('calmeA', 'à … h', 'h'),
          cases('bruitRegles', 'Nos règles', [
            'musique et TV au casque après une heure fixe',
            'lessive et aspirateur pas après une heure fixe',
            'pas d’appel vidéo à voix haute dans le salon',
            'jeux des chats la nuit : on les occupe avant le coucher',
            'le matin, la première levée fait attention au bruit'
          ]),
          nombre('casqueApres', 'Casque après … h', 'h'),
          nombre('lessiveApres', 'Pas de lessive ni d’aspirateur après … h', 'h'),
          texte('bruitMoi', 'Bruit qui me dérange le plus chez l’autre (moi)')
        ]
      },
      {
        titre: '5.6 Télétravail et horaires (moi)',
        champs: [
          nombre('teletravail', 'Jours de télétravail par semaine', 'jours'),
          choix('horairesDecales', 'Horaires décalés (nuit, week-ends, gardes)', ['non', 'oui']),
          texte('horairesPrecision', 'Si oui, lesquels'),
          choix('ouTravaille', 'Où je travaille à la maison', ['salon', 'chambre', 'coin bureau', 'autre']),
          choix('visios', 'Visios et appels, besoin de silence', OUI_NON),
          texte('nePasDeranger', 'Heures « ne pas déranger »'),
          choix('teletravailDeux', 'Si on télétravaille toutes les deux le même jour', [
            'l’une va au café, à la bibliothèque ou en cowork',
            'on alterne les jours',
            'on se répartit les pièces'
          ]),
          texte('repartPieces', 'Répartition des pièces'),
          cases('reglesTele', 'Règles', [
            'on se prévient la veille de ses appels importants',
            'casque pour les réunions',
            'le poste de travail se range le soir pour que le salon redevienne un salon'
          ]),
          choix('materielQui', 'Le matériel (bureau, écran, chaise) est acheté par', ['P1', 'P2', 'compte commun']),
          nombre('materielBudget', 'Budget matériel', 'CHF')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's6',
    titre: '6. Vie de couple, vacances, fêtes',
    emoji: '💞',
    intro:
      'Vivre ensemble ne doit pas manger le couple : on réserve du temps à deux, on dit comment on décide, et on règle dès maintenant les vacances et les fêtes.',
    blocs: [
      {
        titre: '6.1 Temps à deux et temps à soi (moi)',
        champs: [
          nombre('soireesDeux', 'Soirées à deux souhaitées par semaine', 'soirées'),
          nombre('soireesSeule', 'Soirées seule ou entre amis par semaine', 'soirées'),
          long('aimeDeux', 'Ce que j’aime faire à deux'),
          long('ressource', 'Ce dont j’ai besoin pour me ressourcer'),
          cases('rituels', 'Nos rituels', [
            'un repas ensemble par jour sans téléphone',
            'une soirée à deux fixe',
            'un week-end sans programme par mois',
            'une sortie à deux par mois, à tour de rôle pour choisir',
            'autre'
          ]),
          texte('rituelsPrecision', 'Précisions (jour de la soirée fixe, autre rituel)'),
          choix('ecransCouple', 'Écrans pendant le temps à deux', [
            'pas de règle',
            'pas de téléphone à table',
            'une heure d’écran chacune de son côté, puis on se retrouve'
          ])
        ]
      },
      {
        titre: '6.2 Affection, intimité, confiance',
        champs: [
          cases('intimite', 'Intimité', ['on en parle de temps en temps, sans pression ni reproche', 'on a notre façon de dire « oui », « non » ou « pas ce soir »']),
          texte('faconDire', 'Notre façon de dire « oui », « non » ou « pas ce soir »'),
          long('sentirAimee', 'Ce qui me fait me sentir aimée (moi)'),
          choix('sorties', 'Sorties et messages', ['on prévient quand on rentre tard', 'pas besoin de prévenir']),
          choix('geoloc', 'Géolocalisation', OUI_NON),
          cases('reseaux', 'Ex, amitiés, réseaux sociaux', [
            'on est transparentes sur nos contacts importants',
            'on demande avant de publier une photo de l’autre',
            'mots de passe : chacune garde les siens'
          ])
        ]
      },
      {
        titre: '6.3 Comment on décide',
        champs: [
          choix('petitesDec', 'Petites décisions du quotidien', ['celle qui s’en occupe décide', 'on se met d’accord vite']),
          choix('grossesDec', 'Grosses décisions (achat important, déménagement, changement de travail, nouvel animal, voyage)', [
            'on décide à deux, accord des deux nécessaire',
            'la personne la plus concernée tranche après avoir écouté'
          ]),
          nombre('delaiReponse', 'On laisse passer … jours avant de répondre', 'jours'),
          long('projet1', 'Projets dans 1 an'),
          long('projet3', 'Projets dans 3 ans'),
          cases('revoirAn', 'Projets', ['on en reparle une fois par an'])
        ]
      },
      {
        titre: '6.4 Vacances (moi)',
        champs: [
          nombre('conges', 'Semaines de congés à partir ensemble par an', 'semaines'),
          nombre('budgetVac', 'Budget vacances par an', 'CHF'),
          cases('typeVac', 'Type de vacances', ['repos', 'visites', 'nature', 'ville', 'autre']),
          texte('rythmeVac', 'Rythme (levée tôt, grasse matinée, programme)'),
          texte('absolumentVac', 'Ce qui doit absolument y figurer'),
          choix('organise', 'Qui organise et réserve', ['à tour de rôle', 'P1', 'P2', 'ensemble']),
          choix('paieVac', 'Qui paie', ['prorata', '50/50', 'chacune son voyage']),
          choix('vacSep', 'Vacances séparées', ['oui', 'non', 'à voir']),
          nombre('vacSepSem', 'Si oui, jusqu’à … semaines par an', 'semaines'),
          cases('chatsAbs', 'Chats pendant les absences', ['voisin ou proche', 'pension', 'visite à domicile']),
          texte('chatsAbsQui', 'Voisin ou proche : qui ?'),
          nombre('chatsAbsCout', 'Coût estimé', 'CHF'),
          choix('chatsAbsPaie', 'Payé par', ['P1', 'prorata', '50/50'])
        ]
      },
      {
        titre: '6.5 Fêtes de fin d’année',
        champs: [
          info('La première année est celle où tout se joue : on décide dès maintenant pour fin 2026, puis on pose une règle pour les années suivantes.'),
          grille(
            'fetes',
            'Fêtes',
            [
              l('noel', 'Noël (24 et 25 décembre)', {
                f2026: ['chez nous', 'famille P1', 'famille P2', 'chacune dans sa famille'],
                f2027: ['on alterne', 'idem', 'autre']
              }),
              l('sylvestre', 'Saint-Sylvestre', {
                f2026: ['chez nous', 'chez des amis', 'sortie', 'chacune de son côté'],
                f2027: ['on alterne', 'idem', 'autre']
              }),
              l('janvier', '1er janvier et jours suivants', {
                f2026: ['repos à deux', 'famille', 'autre'],
                f2027: ['on alterne', 'idem', 'autre']
              }),
              l('anniv', 'Anniversaires de chacune', {
                f2026: ['fête', 'sortie à deux', 'discret'],
                f2027: ['idem', 'autre']
              })
            ],
            [
              { id: 'f2026', label: 'Fin 2026', type: 'choix', options: [] },
              { id: 'f2027', label: 'Fin 2027', type: 'choix', options: [] },
              { id: 'qui', label: 'Qui invite ou cuisine', type: 'texte' }
            ]
          ),
          long('compteFetes', 'Ce qui compte vraiment pour moi pendant les fêtes (moi)'),
          choix('cadeauxEntre', 'Cadeaux entre nous', ['oui', 'non']),
          nombre('cadeauxBudget', 'Budget cadeaux entre nous', 'CHF'),
          nombre('cadeauxProches', 'Cadeaux pour les proches : par personne', 'CHF'),
          choix('cadeauxProchesQui', 'Cadeaux pour les proches', ['chacune les siens', 'liste commune']),
          choix('trajets', 'Trajets et chats', ['on rentre le soir même', 'on dort sur place']),
          texte('chatsGardes', 'Si on dort sur place : chats gardés par'),
          choix('sapin', 'Sapin et décorations (attention aux chats)', ['oui', 'non', 'version sûre']),
          texte('sapinSur', 'Version sûre')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's7',
    titre: '7. Gestion des disputes',
    emoji: '🕊️',
    intro:
      'On se dispute forcément, et ce n’est pas le problème : ce qui abîme un couple, c’est de ne pas avoir de règles pour traverser la dispute. On les pose maintenant, à tête reposée.',
    blocs: [
      {
        titre: '7.1 Ce qui nous met le plus en colère (moi)',
        champs: [
          texte('colere1', 'Trois choses qui me font monter : 1'),
          texte('colere2', '2'),
          texte('colere3', '3'),
          cases('reaction', 'Ma façon de réagir quand ça monte', ['je hausse le ton', 'je me tais', 'je pars', 'je pleure', 'je fais des reproches']),
          long('besoinDispute', 'Ce dont j’ai besoin pendant une dispute'),
          cases('declencheurs7', 'Déclencheurs fréquents', [
            'le ton de la voix',
            'être coupée',
            'le silence qui dure',
            'les reproches du passé',
            'le désordre',
            'devoir tout rappeler',
            'une dépense non annoncée',
            'le téléphone pendant qu’on parle',
            'un plan changé à la dernière minute',
            'la famille ou les amis',
            'autre'
          ])
        ]
      },
      {
        titre: '7.2 Règles du jeu',
        champs: [
          cases('regles72', 'Nos règles', [
            'Pas d’insultes, pas de mots définitifs (« tu es toujours … », « je m’en vais »).',
            'Un sujet à la fois, sans ressortir le passé.',
            'On dit « je » : « je me sens … quand …, j’ai besoin de … ».',
            'Pas de dispute par message : on téléphone ou on attend d’être ensemble.',
            'Pas de grosse discussion quand l’une a faim, est épuisée ou doit partir travailler : on reporte.'
          ]),
          nombre('reporteHeures', 'On reporte à … heures maximum', 'heures'),
          texte('regleNous', 'Autre règle à nous')
        ]
      },
      {
        titre: '7.3 La pause',
        champs: [
          texte('motPause', 'Mot ou geste pour demander une pause'),
          choix('pauseDuree', 'Durée de la pause', ['20 minutes', '1 heure', 'jusqu’au lendemain', 'autre']),
          nombre('pauseMax', 'Si jusqu’au lendemain : au plus … heures', 'heures'),
          cases('pendantPause', 'Pendant la pause', [
            'je peux sortir marcher, je dis où je vais et quand je reviens',
            'je vais dans une autre pièce, porte fermée',
            'on ne claque pas la porte et on ne quitte pas le logement pour la nuit'
          ]),
          choix('seRetrouve', 'On se retrouve', ['c’est celle qui a demandé la pause qui relance', 'on se retrouve à une heure convenue']),
          texte('retrouveHeure', 'Heure de retrouvailles'),
          texte('gesteRouvrir', 'Un geste simple pour rouvrir la discussion')
        ]
      },
      {
        titre: '7.4 Après la dispute',
        champs: [
          cases('apres', 'Après', [
            'Chacune dit ce qu’elle a compris de l’autre avant de répondre.',
            'On dit ce que chacune fera différemment la prochaine fois.',
            'Si le sujet revient, on l’ajoute au tableau ci-dessous et on le traite lors du prochain point hebdomadaire.'
          ]),
          cases('geste', 'Notre geste de réparation', ['un câlin', 'un thé ensemble', 'une promenade', 'un mot écrit', 'autre']),
          texte('gesteAutre', 'Autre geste'),
          tableau('sujetsRevenants', 'Sujets qui reviennent', [
            { id: 'sujet', label: 'Sujet', type: 'texte' },
            { id: 'depuis', label: 'Depuis quand', type: 'texte' },
            { id: 'essaye', label: 'Ce qu’on a essayé', type: 'texte' },
            { id: 'decision', label: 'Notre décision', type: 'texte' }
          ]),
          choix('revientTrop', 'Un sujet revient plus de trois fois sans solution', [
            'on demande un regard extérieur (ami neutre, proche de confiance)',
            'on consulte une personne qualifiée (conseil de couple, médiation)',
            'on essaie encore quelques semaines puis on refait le point'
          ]),
          nombre('revientSemaines', 'Si on essaie encore : … semaines', 'semaines')
        ]
      },
      {
        titre: '7.5 La limite qui ne se négocie pas',
        champs: [
          info(
            'Une dispute ne doit jamais faire peur : ni coups, ni menaces, ni contrôle, ni humiliation répétée. Si cela arrive, ce n’est plus un sujet d’accord entre nous, et la personne qui a peur peut partir tout de suite, sans avoir à se justifier.'
          ),
          cases('securite', 'Sécurité', [
            'Je connais le 117 (police) et le 144 (ambulance) en cas de danger immédiat. Le 142, ligne nationale d’aide aux victimes, répond jour et nuit, gratuitement et de façon confidentielle.',
            'J’ai un lieu où aller et une personne à appeler, au cas où.'
          ]),
          texte('lieuPersonne', 'Ce lieu et cette personne (moi)')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's8',
    titre: '8. Si ça ne marche pas',
    emoji: '🧳',
    intro:
      'Penser à la fin pendant que tout va bien n’est pas pessimiste : c’est ce qui permet de se quitter sans se détruire. On fixe ici le préavis, qui reste, comment l’autre est aidée à se reloger et comment on partage les affaires.',
    blocs: [
      {
        titre: '8.1 Annoncer et laisser du temps',
        champs: [
          cases('annonce', 'On se le dit', [
            'en face à face, jamais par message (sauf danger)',
            'on se laisse quelques jours pour en parler avant d’agir',
            'on prévient nos proches après s’en être parlé'
          ]),
          nombre('delaiAgir', 'Jours pour en parler avant d’agir', 'jours'),
          choix('preavis', 'Préavis entre nous', ['1 mois', '2 mois', '3 mois', 'autre']),
          nombre('preavisAutre', 'Autre préavis', 'mois'),
          date('preavisDepuis', 'À compter du'),
          choix('raccourci', 'Préavis raccourci', [
            'oui, sans discussion si la relation devient dangereuse ou insupportable',
            'oui, si la personne qui part a déjà un logement',
            'non'
          ]),
          info(
            'Si P2 n’est pas sur le bail, son départ ne dépend d’aucun délai légal : ce préavis est un accord entre nous. Si P2 est colocataire (1.7), la sortie du bail se règle avec la régie, selon les délais et les échéances prévus dans le bail.'
          )
        ]
      },
      {
        titre: '8.2 Qui reste dans le logement',
        champs: [
          choix('resteLogement', 'Qui reste', [
            'P1 reste (titulaire du bail, avec les chats) et P2 déménage',
            'P2 reste et P1 part, seulement si la régie l’accepte et si le bail le permet',
            'Aucune ne reste, on rend le logement ensemble',
            'Autre'
          ]),
          texte('resteAutre', 'Précision'),
          grille(
            'pendantPreavis',
            'Pendant le préavis',
            [
              l('loyerP2', 'Loyer de P2', { accord: ['prorata maintenu jusqu’au départ effectif', 'jusqu’à une date fixée', 'autre'] }),
              l('loyerApres', 'Loyer après le départ de P2', { accord: ['P1 reprend le loyer entier', 'le prorata est revu selon 1.6'] }),
              l('parc', 'Place de parc de P2', { accord: ['résiliée à la fin du préavis', 'reprise par P1', 'autre'] }),
              l('dort', 'Qui dort où', {
                accord: ['chambre pour l’une, canapé pour l’autre, en alternance', 'l’une dort chez des proches']
              }),
              l('vie', 'Vie commune', {
                accord: ['on reste cordiales', 'on se répartit les heures à la maison', 'on évite les décisions importantes les premiers jours']
              })
            ],
            [
              { id: 'accord', label: 'Notre accord', type: 'choix', options: [] },
              { id: 'precision', label: 'Précision', type: 'texte' }
            ]
          )
        ]
      },
      {
        titre: '8.3 Aide au relogement',
        champs: [
          texte('tempsLoger', 'Temps pour trouver un logement (semaines ou mois, dans le préavis)'),
          choix('coupPouce', 'Coup de pouce financier', ['non', 'oui', 'en prêt']),
          nombre('coupPouceMontant', 'Jusqu’à (garantie, premier loyer, déménagement)', 'CHF'),
          texte('coupPoucePret', 'Si prêt : remboursé en combien de mois'),
          choix('garantieP2', 'Garantie de loyer de P2', ['non concernée', 'sa contribution (1.7) lui est rendue sous quelques jours']),
          nombre('garantieJours', 'Rendue sous', 'jours'),
          cases('aidePratique', 'Aide pratique', [
            'on cherche ensemble les annonces',
            'une journée de déménagement avec aide',
            'stockage temporaire de ses affaires'
          ]),
          date('stockageJusquau', 'Stockage jusqu’au'),
          texte('endroitTendu', 'Un endroit où aller si c’est trop tendu (moi)'),
          choix('transport', 'Transport du déménagement', ['véhicule d’une de nous', 'location partagée', 'aide de proches']),
          texte('transportProches', 'Proches')
        ]
      },
      {
        titre: '8.4 Partage des affaires et papiers',
        champs: [
          cases('affaires', 'Partage', [
            'Chacune reprend ce qu’elle a apporté : on se base sur la liste de 5.1 et sur les photos du logement à l’arrivée de P2.',
            'Les achats communs suivent la liste de 1.8.',
            'Les cadeaux restent à la personne qui les a reçus.',
            'Les chats restent avec P1.'
          ]),
          choix('chatsRevoir', 'P2 peut revoir les chats', ['oui', 'non', 'à voir']),
          texte('chatsRevoirPrecision', 'Précision (quand, après combien de semaines)'),
          date('clesDate', 'Clés, badges, boîte aux lettres, mots de passe partagés, comptes communs : rendus, changés ou clôturés au plus tard le'),
          date('adressesDate', 'Changements d’adresse, assurances, contrats et abonnements de P2 mis à jour par P2 avant le'),
          nombre('delaiAffaires', 'Délai pour récupérer les dernières affaires : … semaines après le départ', 'semaines'),
          choix('remise', 'Remise des affaires', ['en présence de l’autre', 'un ou une proche présent·e', 'en l’absence de l’autre, par accord'])
        ]
      },
      {
        titre: '8.5 Après la séparation',
        champs: [
          choix('contact', 'Contact', ['pause totale', 'uniquement pour l’administratif', 'on reste en contact amical', 'à voir']),
          nombre('pauseSemaines', 'Pause totale de … semaines', 'semaines'),
          choix('proches', 'Ce qu’on dit aux proches et sur les réseaux', [
            'on convient d’une phrase commune',
            'chacune dit ce qu’elle veut, sans dénigrer l’autre'
          ]),
          texte('phraseCommune', 'Phrase commune')
        ]
      },
      {
        titre: '8.6 À savoir',
        champs: [
          info(
            'En concubinage, la loi ne prévoit pas de règles de partage des biens comme pour le mariage. Ce document est donc un accord entre nous : pour les points importants, une consultation juridique donne un cadre plus solide.'
          ),
          cases('professionnel', 'Sujets à voir avec un ou une professionnelle', [
            'testament',
            'clause bénéficiaire de l’assurance ou de la prévoyance',
            'procuration en cas d’incapacité',
            'directives anticipées',
            'autre'
          ]),
          texte('professionnelAutre', 'Autre')
        ]
      }
    ]
  },

  // ===================================================================
  {
    id: 's9',
    titre: '9. Révision et signatures',
    emoji: '✍️',
    intro: 'On relit cet accord tous les 3 mois : c’est ce qui le garde juste quand nos vies changent. Il se révise aussi tout de suite si un revenu, un travail ou le logement change.',
    blocs: [
      {
        titre: '9.1 Calendrier de révision',
        champs: [
          grille(
            'revisions',
            'Révisions',
            [l('r3', '1re : 3 mois après l’emménagement'), l('r6', '2e : 6 mois'), l('r9', '3e : 9 mois'), l('r12', '4e : 12 mois')],
            [
              { id: 'prevue', label: 'Date prévue', type: 'date' },
              { id: 'faite', label: 'Faite le', type: 'date' },
              { id: 'change', label: 'Ce qu’on a changé', type: 'texte' },
              { id: 'paraphes', label: 'Paraphes P1 / P2', type: 'texte' }
            ]
          ),
          cases('revisionTout', 'On révise tout de suite si', [
            'un revenu change (voir 1.6)',
            'l’une change de travail ou d’horaires',
            'un proche ou un animal arrive ou part',
            'le logement change',
            'l’une se sent débordée ou injuste'
          ])
        ]
      },
      {
        titre: '9.2 Comment on fait le point (1 heure)',
        champs: [
          cases('pointRegles', 'Déroulé', [
            'Chacune relit seule les sections avant la soirée.',
            'On passe d’abord ce qui marche bien, puis ce qui coince, puis ce qu’on essaie pendant les 3 prochains mois.',
            'On regarde le tableau des tâches (2) : qui en fait trop ? Qui y pense trop (4) ?',
            'On regarde l’argent (1) : revenus, charges, épargne, achats à prévoir.',
            'On regarde la litière et les chats : un coup de main est-il devenu un dû ?'
          ]),
          long('marche', 'Ce qui marche bien (moi)'),
          long('coince', 'Ce qui coince (moi)'),
          long('essayer', 'Ce que je voudrais essayer (moi)'),
          choix('lieuPoint', 'Lieu et moment du point', ['à la maison avec un thé', 'dehors, en marchant', 'au restaurant']),
          date('prochainePoint', 'Prochaine date')
        ]
      },
      {
        titre: '9.3 Journal des modifications',
        champs: [
          tableau('journal', 'Modifications', [
            { id: 'date', label: 'Date', type: 'date' },
            { id: 'quoi', label: 'Ce qu’on a modifié', type: 'texte' },
            { id: 'section', label: 'Section', type: 'texte' },
            { id: 'paraphes', label: 'Paraphes P1 / P2', type: 'texte' }
          ])
        ]
      }
    ]
  }
];
