const express = require('express');

const router = express.Router();

const DEALS = [
  {
    id: 1,
    category: 'hotel',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
    title: 'Taj Coral Reef, Maldives',
    subtitle: 'Overwater villas from ₹18,999/night — limited rooms left',
  },
  {
    id: 2,
    category: 'hotel',
    image: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop',
    title: 'The Leela Goa',
    subtitle: 'Beachfront stay from ₹7,499/night — breakfast included',
  },
  {
    id: 3,
    category: 'hotel',
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop',
    title: 'Zostel Manali',
    subtitle: 'Cosy hostel dorms from ₹599/night — perfect for groups',
  },
  {
    id: 4,
    category: 'cab',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&auto=format&fit=crop',
    title: 'Goa Airport Cab',
    subtitle: 'AC sedan to North Goa beaches — flat ₹699, instant booking',
  },
  {
    id: 5,
    category: 'cab',
    image: 'https://images.unsplash.com/photo-1611642218468-de0a5cbe49c0?w=800&auto=format&fit=crop',
    title: 'Manali Innova Crysta',
    subtitle: 'Full-day hill station cab for 6 — from ₹3,499, driver included',
  },
  {
    id: 6,
    category: 'trip',
    image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop',
    title: 'Spiti Valley Group Trek',
    subtitle: '7-day fully guided package from ₹14,999 — meals & stays covered',
  },
];

// GET /deals
router.get('/', (_req, res) => {
  res.json(DEALS);
});

module.exports = router;
