import type { GeneratedCatalogInput } from '@loyala/validation';

export interface CatalogTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  data: GeneratedCatalogInput;
}

/**
 * Ready-to-use, sector-specific starter catalogs. Prices are indicative (XOF)
 * and fully editable in the preview before the user applies them. These give an
 * instant, zero-cost starting point so no one ever faces a blank page.
 */
export const CATALOG_TEMPLATES: CatalogTemplate[] = [
  {
    id: 'restaurant',
    label: 'Restaurant',
    emoji: '🍽️',
    description: 'Entrées, plats, desserts et boissons',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Entrées',
          description: 'Pour bien commencer',
          items: [
            { name: 'Salade César', description: 'Poulet, croûtons, parmesan', price: 3000, type: 'product' },
            { name: 'Nems (x4)', description: 'Rouleaux croustillants', price: 2500, type: 'product' },
            { name: 'Avocat crevettes', description: 'Sauce cocktail maison', price: 3500, type: 'product' },
          ],
        },
        {
          name: 'Plats',
          description: 'Nos spécialités',
          items: [
            { name: 'Poulet braisé', description: 'Attiéké et sauce piment', price: 4500, type: 'product' },
            { name: 'Poisson grillé', description: 'Riz ou alloco au choix', price: 5000, type: 'product' },
            { name: 'Burger maison', description: 'Bœuf, cheddar, frites', price: 4000, type: 'product' },
            { name: 'Riz sauté', description: 'Légumes et crevettes', price: 3500, type: 'product' },
          ],
        },
        {
          name: 'Desserts',
          description: 'Une touche sucrée',
          items: [
            { name: 'Tarte ananas', description: 'Fait maison', price: 2000, type: 'product' },
            { name: 'Salade de fruits', description: 'Fruits frais de saison', price: 1800, type: 'product' },
          ],
        },
        {
          name: 'Boissons',
          description: '',
          items: [
            { name: 'Jus de bissap', description: 'Fait maison', price: 1000, type: 'product' },
            { name: 'Eau minérale', description: '50 cl', price: 500, type: 'product' },
            { name: 'Soda', description: '33 cl', price: 800, type: 'product' },
          ],
        },
      ],
    },
  },
  {
    id: 'bar',
    label: 'Bar / Lounge',
    emoji: '🍸',
    description: 'Cocktails, bières, vins et snacks',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Cocktails',
          description: 'Signatures du bar',
          items: [
            { name: 'Mojito', description: 'Rhum, menthe, citron vert', price: 3500, type: 'product' },
            { name: 'Piña Colada', description: 'Rhum, ananas, coco', price: 4000, type: 'product' },
            { name: 'Daïquiri', description: 'Rhum, citron, sucre', price: 3500, type: 'product' },
          ],
        },
        {
          name: 'Bières',
          description: '',
          items: [
            { name: 'Bière blonde', description: '33 cl', price: 1500, type: 'product' },
            { name: 'Bière pression', description: '25 cl', price: 1200, type: 'product' },
          ],
        },
        {
          name: 'Vins',
          description: 'Au verre',
          items: [
            { name: 'Vin rouge', description: 'Verre 15 cl', price: 2500, type: 'product' },
            { name: 'Vin blanc', description: 'Verre 15 cl', price: 2500, type: 'product' },
          ],
        },
        {
          name: 'Snacks',
          description: 'À grignoter',
          items: [
            { name: 'Ailes de poulet', description: 'x6, sauce BBQ', price: 3000, type: 'product' },
            { name: 'Frites', description: 'Portion', price: 1500, type: 'product' },
          ],
        },
      ],
    },
  },
  {
    id: 'cafe',
    label: 'Café',
    emoji: '☕',
    description: 'Cafés, thés, pâtisseries',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Cafés',
          description: '',
          items: [
            { name: 'Espresso', description: 'Simple', price: 1000, type: 'product' },
            { name: 'Cappuccino', description: 'Mousse de lait', price: 1500, type: 'product' },
            { name: 'Café latte', description: 'Doux et crémeux', price: 1800, type: 'product' },
          ],
        },
        {
          name: 'Thés & infusions',
          description: '',
          items: [
            { name: 'Thé vert', description: 'À la menthe', price: 1000, type: 'product' },
            { name: 'Chocolat chaud', description: 'Maison', price: 1500, type: 'product' },
          ],
        },
        {
          name: 'Pâtisseries',
          description: '',
          items: [
            { name: 'Croissant', description: 'Pur beurre', price: 800, type: 'product' },
            { name: 'Muffin', description: 'Pépites de chocolat', price: 1200, type: 'product' },
          ],
        },
      ],
    },
  },
  {
    id: 'boulangerie',
    label: 'Boulangerie',
    emoji: '🥖',
    description: 'Pains, viennoiseries, pâtisseries',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Pains',
          description: '',
          items: [
            { name: 'Baguette', description: 'Tradition', price: 300, type: 'product' },
            { name: 'Pain complet', description: 'Farine complète', price: 700, type: 'product' },
          ],
        },
        {
          name: 'Viennoiseries',
          description: '',
          items: [
            { name: 'Croissant', description: 'Pur beurre', price: 500, type: 'product' },
            { name: 'Pain au chocolat', description: '', price: 600, type: 'product' },
          ],
        },
        {
          name: 'Pâtisseries',
          description: '',
          items: [
            { name: 'Éclair au chocolat', description: '', price: 1200, type: 'product' },
            { name: 'Tarte aux fruits', description: 'Part', price: 1500, type: 'product' },
          ],
        },
      ],
    },
  },
  {
    id: 'salon',
    label: 'Salon de coiffure',
    emoji: '💇',
    description: 'Coupes, coiffures, soins',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Coupes',
          description: '',
          items: [
            { name: 'Coupe homme', description: 'Tondeuse + ciseaux', price: 2000, type: 'service' },
            { name: 'Coupe femme', description: 'Shampoing inclus', price: 3500, type: 'service' },
          ],
        },
        {
          name: 'Coiffures',
          description: '',
          items: [
            { name: 'Tresses', description: 'Selon longueur', price: 8000, type: 'service' },
            { name: 'Tissage', description: 'Pose complète', price: 12000, type: 'service' },
          ],
        },
        {
          name: 'Soins',
          description: '',
          items: [
            { name: 'Soin capillaire', description: 'Masque nourrissant', price: 4000, type: 'service' },
            { name: 'Coloration', description: 'Couleur au choix', price: 6000, type: 'service' },
          ],
        },
      ],
    },
  },
  {
    id: 'spa',
    label: 'Spa / Institut',
    emoji: '💆',
    description: 'Massages, soins visage & corps',
    data: {
      currency: 'XOF',
      categories: [
        {
          name: 'Massages',
          description: '',
          items: [
            { name: 'Massage relaxant', description: '60 min', price: 15000, type: 'service' },
            { name: 'Massage aux pierres chaudes', description: '75 min', price: 20000, type: 'service' },
          ],
        },
        {
          name: 'Soins visage',
          description: '',
          items: [
            { name: 'Nettoyage de peau', description: '45 min', price: 10000, type: 'service' },
            { name: 'Soin anti-âge', description: '60 min', price: 18000, type: 'service' },
          ],
        },
        {
          name: 'Soins corps',
          description: '',
          items: [
            { name: 'Gommage corps', description: '45 min', price: 12000, type: 'service' },
            { name: 'Manucure', description: 'Pose vernis incluse', price: 6000, type: 'service' },
          ],
        },
      ],
    },
  },
];
