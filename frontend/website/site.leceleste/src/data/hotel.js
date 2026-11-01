/**
 * Photos de demonstration (Unsplash). Remplace-les par les vraies
 * photos de l'hotel avant la mise en ligne : elles ne sont pas
 * libres de droits pour un usage commercial.
 */
const photo = (id, width) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=70`

const ROOMS_RAW = [
  {
    num: '01',
    name: 'Chambre Ciel',
    desc: 'Un lit king face au large, une table basse en chêne et une terrasse qui sent le sel.',
    spec: '24 m² · 2 personnes',
    price: 'dès 240 €',
    id: 'photo-1611892440504-42a792e24d32',
  },
  {
    num: '02',
    name: 'Suite Mistral',
    desc: 'Un salon séparé, une freuseuse et le petit-déjeuner servi sur la terrasse.',
    spec: '42 m² · 3 personnes',
    price: 'dès 390 €',
    id: 'photo-1616594039964-ae9021a400a0',
  },
  {
    num: '03',
    name: 'Chambre Ambre',
    desc: 'La plus calme de la maison, côté cour intérieure, pour dormir sans bruit de mer.',
    spec: '26 m² · 2 personnes',
    price: 'dès 210 €',
    id: 'photo-1590490360182-c33d57733427',
  },
  {
    num: '04',
    name: 'Suite Horizon',
    desc: 'La seule chambre à l’étage, avec un bain de vue et les decks de la corniche.',
    spec: '55 m² · 4 personnes',
    price: 'dès 520 €',
    id: 'photo-1582719478250-c89cae4dc85b',
  },
  {
    num: '05',
    name: 'Chambre Pergola',
    desc: 'Sous la tonnelle, à l’écart du couloir, avec un bureau et un fauteuil de lecture.',
    spec: '28 m² · 2 personnes',
    price: 'dès 265 €',
    id: 'photo-1618773928121-c32242e63f39',
  },
  {
    num: '06',
    name: 'Suite Verger',
    desc: 'Deux chambres reliées, une cuisineette et une table pour six convives.',
    spec: '68 m² · 6 personnes',
    price: 'dès 640 €',
    id: 'photo-1564501049412-61c2a3083791',
  },
]

export const ROOMS = ROOMS_RAW.map((room) => ({
  ...room,
  image: (width) => photo(room.id, width),
}))

export const HERO_IMAGE = photo('photo-1566073771259-6a8506099945', 1400)

export const GALLERY = [
  {
    id: 'photo-1445019980597-93fa8acb246c',
    caption: 'La table d’hôtes, le soir',
    size: 'a',
  },
  {
    id: 'photo-1571896349842-33c89424de2d',
    caption: 'La piscine, ouverte de mai à octobre',
    size: 'b',
  },
  {
    id: 'photo-1631049307264-da0ec9d70304',
    caption: 'Le hall et ses volumes d’origine',
    size: 'c',
  },
].map((item) => ({ ...item, image: (width) => photo(item.id, width) }))