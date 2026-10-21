/**
 * Catalogue des 9 stratégies Bomaye V2 — données structurées persistantes (code).
 * Seuils / exemples = source Bomaye, non universels.
 */
import { BOMAYE_KNOWLEDGE_SOURCE, type BomayeSourceRef } from './bomaye-source';

export type BomayeStrategyId =
  | 'STRAT-01'
  | 'STRAT-02'
  | 'STRAT-03'
  | 'STRAT-04'
  | 'STRAT-05'
  | 'STRAT-06'
  | 'STRAT-07'
  | 'STRAT-08'
  | 'STRAT-09';

export type BomayeDifficulty = 'low' | 'medium' | 'high' | 'very_high';

export interface BomayeStrategy {
  id: BomayeStrategyId;
  name: string;
  category: string;
  difficulty: BomayeDifficulty;
  commercialProblem: string;
  objective: string;
  principle: string;
  steps: string[];
  resources: string[];
  requiredDataForPersonalization: string[];
  example: string;
  whatsappScript: string | null;
  kpis: string[];
  formula: { name: string; expression: string; unit: string };
  successConditions: string[];
  risks: string[];
  targetEstablishmentTypes: string[];
  decisionRule: {
    if: string;
    then: string;
    else?: string;
  };
  contraindications: string[];
  source: BomayeSourceRef;
}

const doc = BOMAYE_KNOWLEDGE_SOURCE.documentId;

export const BOMAYE_STRATEGIES: readonly BomayeStrategy[] = [
  {
    id: 'STRAT-01',
    name: 'Démocratisation culturelle par fusion sur produit porteur universel',
    category: 'Positionnement & Création d’Offre',
    difficulty: 'high',
    commercialProblem:
      'Manque d’accessibilité perçue et barrières culturelles d’une cuisine ethnique/traditionnelle.',
    objective:
      'Transformer une gastronomie perçue comme niche en produit de consommation désirable et récurrent.',
    principle:
      'Partir d’un plat authentique et le fusionner dans un format street-food universel (burger, pizza, taco…), sans saupoudrage marketing.',
    steps: [
      'Identifier un vecteur street-food à fort volume (burger, pizza, taco, sandwich).',
      'Sélectionner des recettes traditionnelles à vraie légitimité culinaire.',
      'Déconstruire et réadapter sans travestir les saveurs maîtresses.',
      'Établir une légitimité terrain (immersion, apprentissage local).',
      'Éduquer via storytelling du plat (origine, histoire, ingrédients).',
    ],
    resources: ['R&D culinaire', 'sourcing authentique', 'packaging', 'supports storytelling'],
    requiredDataForPersonalization: [
      'zone géographique',
      'habitudes alimentaires locales',
      'profil clientèle',
      'panier moyen cible',
    ],
    example:
      'Bomaye : Dibi / Kefta réinterprétés en burgers gastronomiques (source Bomaye, non universelle).',
    whatsappScript:
      'Bonjour {{prenom}} ! Connaissez-vous le Dibi, ce barbecue légendaire d’Afrique de l’Ouest ? Notre chef l’a réinterprété en burger fondant avec confit d’oignons et épices douces. Venez découvrir son histoire ce midi chez {{restaurant}} !',
    kpis: [
      'Taux d’essai des nouvelles créations',
      'Mix-produit (% ventes burger signature)',
      'Taux de réachat à 30 jours',
      'NPS culinaire',
    ],
    formula: {
      name: 'Taux d’Essai Produit',
      expression:
        '(Clients uniques ayant commandé le produit cible / Clients uniques période) * 100',
      unit: '%',
    },
    successConditions: [
      'Respect du goût et des techniques de base',
      'Absence de condescendance culturelle',
      'Régularité de préparation',
    ],
    risks: [
      'Appropriation culturelle mal perçue',
      'Effet gadget si le goût ne suit pas le storytelling',
    ],
    targetEstablishmentTypes: ['Fast-casual', 'Street food', 'Restaurants à thème', 'Brasseries créatives'],
    decisionRule: {
      if: 'Concept perçu comme trop complexe, clivant ou méconnu',
      then: 'Hybridation sur produit d’appel universel (burger, bao, pizza, wrap)',
      else: 'Maintenir le format traditionnel si la clientèle locale est déjà experte et demandeuse',
    },
    contraindications: [
      'Ne pas forcer une hybridation si la clientèle locale exige déjà le format traditionnel.',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-01',
      section: 'D / STRAT-01',
      timestamps: ['00:02:45-00:03:30', '00:09:40-00:11:10'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-02',
    name: 'Pre-Launch Audience Building (documenter avant d’ouvrir)',
    category: 'Acquisition & Lancement de Marque',
    difficulty: 'medium',
    commercialProblem:
      'Ouverture dans l’anonymat → dépenses pub jour J sans garantie de trafic.',
    objective:
      'Créer une audience engagée plusieurs mois avant l’ouverture pour remplir le carnet dès le jour 1.',
    principle:
      'Documenter en public la genèse (voyages, essais, travaux, doutes) pour transformer les abonnés en supporters.',
    steps: [
      'Créer un compte de contenu orienté quête.',
      'Publier en coulisses de manière brute et sincère.',
      'Engager la communauté (retours, avis).',
      'Pré-annoncer l’ouverture avec compte à rebours.',
      'Convertir abonnés → premiers clients physiques.',
    ],
    resources: ['Smartphone', 'régularité contenu', 'authenticité', 'community management'],
    requiredDataForPersonalization: [
      'canaux sociaux privilégiés',
      'thématique différenciante',
      'histoire des fondateurs',
    ],
    example:
      'Bomaye / @the_nasty_belly : ~6 mois, 8 pays, ~60k followers avant ouverture (métrique Bomaye, non garantie).',
    whatsappScript:
      'Après 6 mois d’aventures et des centaines d’essais culinaires partagés avec vous, la porte ouvre enfin ce jeudi à midi ! Pour notre communauté jour 1, un dessert surprise avec le code NASTYFAMILY.',
    kpis: [
      'Taille communauté pré-lancement',
      'Taux d’engagement moyen',
      'Conversion followers → visites 1er mois',
      'Fréquentation semaine 1',
    ],
    formula: {
      name: 'Taux de Conversion d’Ouverture',
      expression: '(Clients physiques issus de la communauté / Followers pré-lancement) * 100',
      unit: '%',
    },
    successConditions: ['Transparence', 'narration humaine', 'authenticité des fondateurs'],
    risks: ['Sur-vendre et décevoir si l’ops n’absorbe pas le flux'],
    targetEstablishmentTypes: ['Tous, surtout concepts à forte identité'],
    decisionRule: {
      if: 'Phase création / pré-ouverture avec délai > 3 mois',
      then: 'Activer documentation de genèse (Build in Public)',
      else: 'Si déjà ouvert : storytelling de coulisses sur nouveaux lancements',
    },
    contraindications: [
      'Ne pas promettre une file d’attente type Bomaye sans capacité ops réelle.',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-02',
      section: 'D / STRAT-02',
      timestamps: ['00:14:00-00:16:15'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-03',
    name: 'Collaborations mensuelles éphémères (Drops / Capsules)',
    category: 'Fidélisation & Animation Commerciale',
    difficulty: 'high',
    commercialProblem: 'Érosion d’intérêt, baisse de fréquence, fatigue carte / brigade.',
    objective: 'FOMO mensuel, réactivation CRM, audience partenaires sans pub payante.',
    principle:
      '1 collab mensuelle limitée à ~30 jours (codes retail capsules), teasing croisé.',
    steps: [
      'Calendrier éditorial annuel (1 collab / mois).',
      'Partenaires complémentaires à expertise reconnue.',
      'Co-créer une recette exclusive.',
      'Lancement + teasing croisé.',
      'Bloquer la durée à 30 jours.',
      'Mesurer mix-produit + réactiver CRM au switch.',
    ],
    resources: ['Agilité cuisine', 'fiches techniques', 'accords co-visibilité'],
    requiredDataForPersonalization: [
      'partenaires locaux',
      'coût matière drop',
      'préférences clientèle',
    ],
    example: 'Bomaye × Melt, Libertino / Big Mamma, chefs marocains/ivoiriens (cas Bomaye).',
    whatsappScript:
      'Alerte Drop Éphémère : Ce mois-ci seulement, burger exclusif en collab avec {{nom_partenaire}} ! Uniquement jusqu’au 31. Réservez avant disparition !',
    kpis: [
      'Repeat rate mensuel',
      'Volume ventes drop (% CA)',
      'Nouveaux clients partenaire',
      'Engagement social',
    ],
    formula: {
      name: 'Taux de Réactivation Mensuelle',
      expression:
        '(Clients inactifs >45 j revenus durant le Drop / Total clients inactifs) * 100',
      unit: '%',
    },
    successConditions: ['Qualité gustative', 'alignement de valeurs', 'finitude respectée'],
    risks: ['Complexité ops', 'décevoir habitués si goût déséquilibré'],
    targetEstablishmentTypes: ['Burgers / Street-food', 'Fast-casual', 'Bars cocktails', 'Pizzerias modernes'],
    decisionRule: {
      if: 'Essoufflement récurrence après ~3e mois d’ouverture',
      then: 'Programme mensuel Drops / Collaborations',
      else: 'Si brigade instable / sous-effectif : reporter jusqu’à stabilisation ops',
    },
    contraindications: [
      'Ne pas lancer de drops si la brigade est instable ou sous-effectif.',
      'Ne pas prioriser un drop si la note avis chute (voir REGLE-DEC-02).',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-03',
      section: 'D / STRAT-03',
      timestamps: ['00:12:45-00:13:55', '00:17:20-00:18:35'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-04',
    name: 'Constitution précoce de base first-party & fidélité active',
    category: 'Fidélisation & CRM Client',
    difficulty: 'low',
    commercialProblem:
      'Perte de contact direct, dépendance au bouche-à-oreille, incapacité à mesurer le repeat.',
    objective:
      'Capturer coordonnées dès le jour 1 pour stimuler le retour à coût quasi nul.',
    principle:
      'Leçon retail : ne pas attendre que le resto « grossisse » pour poser le CRM ; changer de programme plus tard fait perdre des données.',
    steps: [
      'Déployer terminal / tablette fidélité fluide en caisse.',
      'Inciter à l’enrôlement au 1er passage.',
      'Collecter téléphone avec consentement explicite.',
      'Segmenter récence / fréquence.',
      'Messages ciblés (carte, anniversaire).',
    ],
    resources: ['CRM / tablette fidélité ou WhatsApp', 'formation serveurs'],
    requiredDataForPersonalization: [
      'fréquence moyenne',
      'historique commandes',
      'canal favori (SMS/WhatsApp)',
    ],
    example: 'Bomaye utilise Pongo depuis l’ouverture (exemple stack, substituable).',
    whatsappScript:
      'Bonjour {{prenom}}, cela fait 3 semaines qu’on ne vous a pas croisé ! Pour votre prochain passage, votre boisson maison offerte sur présentation de ce message. À très vite !',
    kpis: [
      'Taux d’enrôlement CRM',
      'Rétention 60/90 j',
      'Fréquence visite membres',
      'CA incrémental campagnes',
    ],
    formula: {
      name: 'Fréquence de Visite',
      expression: 'Total visites membres fidélité / Membres actifs période',
      unit: 'visites / membre',
    },
    successConditions: ['Inscription < 10 s', 'récompenses atteignables'],
    risks: ['Dispositif invisible si équipe non formée', 'spam promo agressif'],
    targetEstablishmentTypes: [
      'Fast-casual',
      'Street-food',
      'Restaurants de quartier',
      'Restauration zones bureaux',
    ],
    decisionRule: {
      if: 'Aucun moyen de recontacter les clients physiques',
      then: 'Priorité absolue collecte first-party avant pub payante',
    },
    contraindications: [
      'Ne pas investir massivement en acquisition payante sans canal de recontact first-party.',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-04',
      section: 'D / STRAT-04',
      timestamps: ['00:16:45-00:17:15', '00:49:25-00:49:55'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-05',
    name: 'Plafonnement livraison & restaurant de destination',
    category: 'Stratégie Commerciale & Modèle de Vente',
    difficulty: 'medium',
    commercialProblem:
      'Commissions 25–35 % qui vampirisent les marges ; dilution d’identité.',
    objective:
      'Traiter la livraison comme vitrine marketing plafonnée (~10–15 % CA) ; salle = destination.',
    principle:
      'Investir l’expérience en salle ; plateformes = visibilité, pas pilier de CA.',
    steps: [
      'Définir seuil max dépendance livraison (ex. 10–15 % CA).',
      'Répercuter partie des coûts plateforme sur prix livraison si autorisé.',
      'Négocier mises en avant / co-branding.',
      'Soigner ambiance salle (design, musique, service).',
      'Flyer dans sacs livraison → drive-to-store.',
    ],
    resources: ['Identité visuelle', 'aménagement salle', 'packaging livraison mesuré'],
    requiredDataForPersonalization: [
      'répartition CA sur place / emporter / livraison',
      'marge nette par canal',
    ],
    example:
      'Bomaye : livraison ~10 % CA comme budget marketing ; ~80 % clients en salle (métrique Bomaye).',
    whatsappScript:
      'Merci pour votre commande livrée {{prenom}} ! Chez {{restaurant}}, frites maison et cocktails signatures se dégustent en salle. Réservez ce week-end !',
    kpis: [
      'Part livraison dans CA (cible ≤ 15 %)',
      'Marge nette par canal',
      'Transformation livraison → salle',
    ],
    formula: {
      name: 'Taux de Dépendance Livraison',
      expression: '(CA Brut Plateformes Livraison / CA Total) * 100',
      unit: '%',
    },
    successConditions: ['Expérience salle > domicile', 'maîtrise files d’attente'],
    risks: ['Tablettes livraison qui dégradent l’expérience salle aux coups de feu'],
    targetEstablishmentTypes: ['Concepts forts', 'Bars & lounges', 'Bistrots', 'Fast-casual'],
    decisionRule: {
      if: 'Part livraison tierce > 25 % et marge nette en baisse',
      then: 'Freiner promo agrégateurs ; réinvestir expérience salle + drive-to-store',
    },
    contraindications: [
      'Ne pas pousser l’acquisition livraison si dépendance déjà élevée et marge sous pression.',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-05',
      section: 'D / STRAT-05',
      timestamps: ['00:53:25-00:55:00'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-06',
    name: 'Unification stack digitale & interopérabilité API',
    category: 'Opérations & Technologie Restaurant',
    difficulty: 'medium',
    commercialProblem: 'Usine à gaz tablettes, ressaisies, stocks désynchro, pilotage flou.',
    objective: 'Écosystème interconnecté API : vente, encaissement, fidélité, hygiène.',
    principle:
      'Choisir outils à API ouvertes ; si le personnel ne comprend pas en 5 minutes, rejeter.',
    steps: [
      'Auditer outils et doubles saisies.',
      'Choisir caisse moderne ouverte API (hub).',
      'Connecter TPE sans ressaisie manuelle.',
      'Intégrer fidélité + stocks / fiches techniques.',
      'Tester ergonomie terrain.',
    ],
    resources: ['Matériel compatible', 'SaaS API', 'connecteurs'],
    requiredDataForPersonalization: [
      'volume transactions',
      'postes encaissement',
      'aisance numérique équipes',
    ],
    example: 'Bomaye : Zelty, Yavin, Pongo, Inpulse, Eezy (+ dashboard interne) — exemples, non exclusifs.',
    whatsappScript: null,
    kpis: [
      'Écart de caisse journalier → 0',
      'Temps moyen encaissement',
      'Adoption outils terrain',
      'Temps admin',
    ],
    formula: {
      name: 'Taux d’Écart de Caisse',
      expression: '(|Théorique caisse - Réel encaissé| / Théorique) * 100',
      unit: '%',
    },
    successConditions: ['Simplicité pour personnel peu qualifié', 'connexion internet robuste'],
    risks: ['Outils séduisants mais trop complexes en ops'],
    targetEstablishmentTypes: ['Tous, surtout focus rentabilité / fluidité'],
    decisionRule: {
      if: 'Erreurs de caisse fréquentes ou >2 tablettes non connectées',
      then: 'Unification caisse-TPE + intégration API avant digitalisation complexe',
    },
    contraindications: [
      'Ne pas ajouter de SaaS d’animation tant que la stack caisse/TPE n’est pas unifiée (REGLE-DEC-05).',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-06',
      section: 'D / STRAT-06',
      timestamps: ['00:46:25-00:49:15', '00:50:30-00:52:10'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-07',
    name: 'Marketing transversal de marque globale (hors-food)',
    category: 'Branding & Rayonnement de Marque',
    difficulty: 'high',
    commercialProblem: 'Restaurant perçu comme simple lieu de repas ; com limitée au menu.',
    objective: 'Marque lifestyle via musique, merch, créations artistiques.',
    principle:
      'Touchpoints culturels de vraie qualité transfèrent un halo sur la nourriture.',
    steps: [
      'Définir univers de marque au-delà de l’assiette.',
      'Collaborer avec artistes locaux (musique / clip).',
      'Merchandising désirable (pas goodies cheap).',
      'Distribuer streaming + boutique.',
      'Attirer médias hors rubriques gastro.',
    ],
    resources: ['Réseau créatifs', 'budget prod ou partenariats'],
    requiredDataForPersonalization: ['intérêts communauté', 'identité sonore'],
    example: 'Bomaye : single afro-urbain + capsule maillots Undiz (cas Bomaye).',
    whatsappScript:
      'Vous aimez l’ambiance sonore chez {{restaurant}} ? Notre single officiel est sorti : {{lien_musique}}. Plongez dans l’univers avant votre prochain repas !',
    kpis: [
      'Écoutes / vues contenu culturel',
      'Ventes merch',
      'Mentions presse hors gastro',
      'Attractivité recrutement',
    ],
    formula: {
      name: 'Marge Merchandising',
      expression: '(CA Merch - Coût Production Merch) / CA Merch',
      unit: 'ratio',
    },
    successConditions: ['Vrais produits qualitatifs', 'lien narratif avec le restaurant'],
    risks: ['Budget disproportionné', 'délaisser la qualité de l’assiette'],
    targetEstablishmentTypes: ['Concepts', 'Lounges / bars', 'Fast-casual identité jeune'],
    decisionRule: {
      if: 'Ops culinaires + panier moyen stabilisés mais aura médiatique faible',
      then: 'Projet branding transversal (musique, merch designer, expo)',
    },
    contraindications: [
      'Ne pas lancer hors-food si le produit / les ops ne sont pas encore stables.',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-07',
      section: 'D / STRAT-07',
      timestamps: ['00:24:15-00:26:35'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-08',
    name: 'Pilotage financier de sentimier & ajustement stratégique des prix',
    category: 'Analyse Financière & Rentabilité',
    difficulty: 'high',
    commercialProblem: 'Érosion rentabilité (inflation matières, énergie, salaires) sur marges minces.',
    objective:
      'Protéger la pérennité : ajuster la carte avec méthode sans briser la confiance.',
    principle:
      'Métier de sentimier : Food Cost et masse salariale pilotés au centime ; pas de shrinkflation.',
    steps: [
      'Calculer fiches techniques / Food Cost par référence.',
      'Identifier plats au-dessus du seuil critique (ex. > 30–32 %).',
      'Réajuster prix de façon ciblée (pas hausse indifférenciée).',
      'Préserver produits d’appel accessibles.',
      'Communiquer transparence qualité / faits maison.',
    ],
    resources: ['Outil fiches techniques', 'mercuriales', 'expertise finance'],
    requiredDataForPersonalization: [
      'marge brute actuelle',
      'élasticité-prix',
      'structure coûts fixes/variables',
      'Food Cost %',
      'CA net HT',
    ],
    example:
      'Bomaye : hausse de prix ciblée après ~18 mois face aux charges (cas Bomaye).',
    whatsappScript:
      'Chez {{restaurant}}, nous refusons de transiger sur le 100 % fait maison. Pour continuer sans baisser la qualité, notre carte évolue tout doucement. Merci pour votre confiance !',
    kpis: ['Food Cost %', 'Marge brute', 'Marge nette', 'Évolution ticket moyen'],
    formula: {
      name: 'Food Cost %',
      expression: '(Coût Achats Matières Consommées / CA Net HT) * 100',
      unit: '%',
    },
    successConditions: [
      'Justification par qualité produit',
      'Calibrage centime par centime',
      'Pas de shrinkflation',
    ],
    risks: [
      'Baisser portions / qualité en secret → fuite des réguliers (contre-indication absolue source)',
    ],
    targetEstablishmentTypes: ['Tous'],
    decisionRule: {
      if: 'Food Cost > 32 % ou marge nette menacée négative',
      then: 'Réévaluation chirurgicale carte / fiches techniques — jamais shrinkflation',
    },
    contraindications: [
      'Interdit : réduire secrètement les portions pour masquer un Food Cost élevé.',
      'Interdit : baisse générale de prix bruts pour « remplir » en contexte inflation (cas F §1).',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-08',
      section: 'D / STRAT-08',
      timestamps: ['00:28:40-00:29:10', '00:32:15-00:33:15'],
      confidence: 'directly_taught',
    },
  },
  {
    id: 'STRAT-09',
    name: 'Expansion multi-sites par adaptation contextuelle',
    category: 'Développement & Stratégie Réseau',
    difficulty: 'very_high',
    commercialProblem: 'Échec de duplication par copier-coller / franchise précipitée.',
    objective:
      'Marque unifiée + adaptation offre / format / modèle à chaque zone.',
    principle:
      '100 % nom de marque ; ~50–70 % carte socle ; adapter le reste et le mode de service.',
    steps: [
      'Sanctuariser le nom de marque.',
      'Conserver 50–70 % recettes signatures.',
      'Étude locale de zone.',
      'Ajuster format commande (serveurs vs bornes).',
      'Valider rentabilité du format adapté avant duplication.',
    ],
    resources: ['Analyse zone', 'flexibilité appro', 'reporting multi-sites'],
    requiredDataForPersonalization: [
      'typologie trafic local',
      'pouvoir d’achat secteur',
      'mois de rentabilité du 1er site',
    ],
    example:
      'Bomaye : 4–5 sites Paris adaptés puis Belgique via diaspora congolaise (projet cité, non universel).',
    whatsappScript:
      'Grande nouvelle pour la famille {{restaurant}} ! Nouvelle adresse à {{ville/quartier}} — décor et créations exclusives. Venez célébrer l’inauguration !',
    kpis: ['CA / m²', 'EBITDA / unité', 'Pénétration zone', 'Cohérence image de marque'],
    formula: {
      name: 'Rendement au m²',
      expression: 'CA Annuel du Point de Vente / Surface Exploitable (m²)',
      unit: '€ / m²',
    },
    successConditions: [
      'Fondamentaux maîtrisés avant 2e site',
      'Pas de franchise précipitée',
    ],
    risks: [
      'Changer de nom selon les lieux',
      'Cloner mécaniquement sans étude locale',
      'Franchise avant 3–5 sites en propre (erreur fréquente §H)',
    ],
    targetEstablishmentTypes: ['Enseignes scaling', 'Groupes', 'Concepts multi-sites'],
    decisionRule: {
      if: 'Souhait d’ouvrir 2e / 3e établissement',
      then: 'Nom identique + socle recettes ; adapter service et mix à la zone',
    },
    contraindications: [
      'Alerte forte si 1er site < 12 mois de rentabilité opérationnelle positive (REGLE-DEC-04).',
    ],
    source: {
      documentId: doc,
      strategyId: 'STRAT-09',
      section: 'D / STRAT-09',
      timestamps: ['00:35:20-00:37:30', '00:39:20-00:40:50'],
      confidence: 'directly_taught',
    },
  },
] as const;

export function getBomayeStrategy(id: BomayeStrategyId): BomayeStrategy | undefined {
  return BOMAYE_STRATEGIES.find((s) => s.id === id);
}

export function listBomayeStrategies(): readonly BomayeStrategy[] {
  return BOMAYE_STRATEGIES;
}
