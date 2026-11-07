/**
 * seed/seed.js
 * Run with: npm run seed
 * Populates Properties and Funds catalogs so GET /api/properties,
 * GET /api/funds and the dashboard's "Top Properties" / "Top Funds"
 * sections have real data to show.
 *
 * FAIX rule (same as properties.controller.js / fund.controller.js):
 *   1 FAIX Token = ₹11
 *
 * NOTE: this file previously inserted documents missing several
 * fields the current schemas require (propertyName, propertyType,
 * totalPropertyCost, totalFaixToken, availableFaixToken on Property;
 * nav on Fund) — `insertMany` would fail Mongoose validation. Rewritten
 * to match models/Property.model.js and models/Fund.model.js exactly.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Property = require('../models/Property.model');
const Fund = require('../models/Fund.model');

const TOKEN_VALUE = 11; // ₹11 = 1 FAIX Token

// Only propertyName, propertyPrice, propertyType, location and
// totalPropertyCost are hand-picked here — totalFaixToken /
// availableFaixToken are derived below, exactly like
// adminCreateProperty() does in controllers/properties.controller.js.
const RAW_PROPERTIES = [
  {
    propertyName: 'London Penthouse',
    propertyType: 'Penthouse',
    location: 'Prime Central, London',
    description: 'A landmark penthouse overlooking the city skyline, fully tokenized for fractional ownership.',
    propertyPrice: 4500000,
    totalPropertyCost: 495000,
  },
  {
    propertyName: 'Dubai Marina Villa',
    propertyType: 'Villa',
    location: 'Waterfront, Dubai',
    description: "A waterfront villa in Dubai Marina with private berth access and skyline views.",
    propertyPrice: 3850000,
    totalPropertyCost: 423500,
  },
  {
    propertyName: 'Singapore Condo',
    propertyType: 'Condominium',
    location: 'Orchard, Singapore',
    description: "A premium condominium in the heart of Singapore's Orchard Road shopping district.",
    propertyPrice: 3200000,
    totalPropertyCost: 352000,
  },
  {
    propertyName: 'Tokyo Apartment',
    propertyType: 'Apartment',
    location: 'Shibuya, Tokyo',
    description: "A modern apartment in Shibuya, steps away from Tokyo's busiest commercial district.",
    propertyPrice: 2875000,
    totalPropertyCost: 316250,
  },
  {
    propertyName: 'Paris Loft',
    propertyType: 'Loft',
    location: 'Le Marais, Paris',
    description: 'A historic loft conversion in Le Marais, blending original architecture with modern finishes.',
    propertyPrice: 2420000,
    totalPropertyCost: 266200,
  },
];

const properties = RAW_PROPERTIES.map((property) => {
  const totalFaixToken = property.totalPropertyCost / TOKEN_VALUE;

  return {
    ...property,
    totalFaixToken,
    availableFaixToken: totalFaixToken,
    soldFaixToken: 0,
    status: 'Available',
  };
});

// Fund model requires `nav` (> 0) — added below; everything else
// matches the original seed values.
const funds = [
  { name: 'Metalan Growth Fund', category: 'Growth', value: 125000, growthPercent: 15.3, nav: 125.4, icon: 'trending-up' },
  { name: 'Real Estate Index', category: 'Index', value: 98500, growthPercent: 11.2, nav: 108.75, icon: 'bar-chart' },
  { name: 'Crypto Balanced', category: 'Balanced', value: 76200, growthPercent: 22.8, nav: 92.15, icon: 'activity' },
  { name: 'Stable Yield', category: 'Fixed', value: 54000, growthPercent: 6.5, nav: 101.05, icon: 'shield' },
  { name: 'Commodity Tracker', category: 'Commodity', value: 41800, growthPercent: 9.1, nav: 87.6, icon: 'zap' },
];

(async () => {
  await connectDB();

  await Property.deleteMany({});
  await Property.insertMany(properties);

  await Fund.deleteMany({});
  await Fund.insertMany(funds);

  console.log('[seed] Properties and Funds seeded successfully.');
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[seed] Failed:', err);
  process.exit(1);
});
