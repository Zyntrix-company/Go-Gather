-- Migration 010: Create categories table for auto-banner assignment
-- Each category has a curated keyword list and S3/Unsplash photo URLs.
-- Temporarily using Unsplash URLs; replace with self-hosted S3 URLs later.

BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  keywords   TEXT[]       NOT NULL DEFAULT '{}',
  photo_urls TEXT[]       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- ── Seed data ──────────────────────────────────────────────────────────────
INSERT INTO categories (name, keywords, photo_urls) VALUES

('Beach & Coastal',
 ARRAY['beach','coastal','sea','shore','ocean','bay','coast','seaside','waves','surf','marina','harbour','harbor','cove','lagoon'],
 ARRAY[
   'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=1600&q=80'
 ]),

('Mountains & Hiking',
 ARRAY['mountain','mountains','snow','trek','trekking','hike','hiking','hills','peak','valley','alps','highland','summit','ridge','cliff'],
 ARRAY[
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1434394354979-a235cd36269d?auto=format&fit=crop&w=1600&q=80'
 ]),

('Historical & Heritage',
 ARRAY['fort','heritage','monument','ancient','ruins','museum','palace','castle','cathedral','temple','citadel','archaeological','historic','landmark','dynasty'],
 ARRAY[
   'https://images.unsplash.com/photo-1548013146-8673ef918943?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1600&q=80'
 ]),

('City & Urban',
 ARRAY['city','urban','downtown','skyline','metro','metropolitan','town','capital','street','district','neighbourhood','square','plaza','tower'],
 ARRAY[
   'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1600&q=80'
 ]),

('Nature & Forests',
 ARRAY['forest','jungle','waterfall','river','wildlife','nature','green','trees','rainforest','valley','meadow','lake','pond','national park','botanical'],
 ARRAY[
   'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1600&q=80'
 ]),

('Desert & Dunes',
 ARRAY['desert','dunes','sand','arid','canyon','sahara','dune','oasis','dry','barren','rocky','mesa','badlands'],
 ARRAY[
   'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1547234935-80c7145ec969?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1518544866330-4e716499f800?auto=format&fit=crop&w=1600&q=80'
 ]),

('Temples & Spiritual',
 ARRAY['temple','spiritual','shrine','pilgrimage','mosque','church','monastery','pagoda','gurdwara','mandir','masjid','cathedral','chapel','sacred','holy','religious'],
 ARRAY[
   'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1545506579-3a72a4e15fde?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1540760952200-e17a1e7e59c4?auto=format&fit=crop&w=1600&q=80'
 ]),

('Islands',
 ARRAY['island','islands','lagoon','atoll','reef','tropical','archipelago','maldives','caribbean','fiji','bali','phuket','goa','andaman','lakshadweep'],
 ARRAY[
   'https://images.unsplash.com/photo-1559131983-3b3520a96f28?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1548574505-5e239809ee19?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1530053969600-caed2596d242?auto=format&fit=crop&w=1600&q=80'
 ]),

('Snow & Cold',
 ARRAY['glacier','arctic','frozen','ice','skiing','ski','snowboard','blizzard','tundra','fjord','polar','scandinavia','siberia','antarctica','freezing'],
 ARRAY[
   'https://images.unsplash.com/photo-1483921616820-9e2bfb7e6ca7?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1491555103944-7c647fd857e6?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1418985991508-e47386d96a71?auto=format&fit=crop&w=1600&q=80'
 ]),

('Wildlife & Safari',
 ARRAY['safari','zoo','national park','animals','jungle','lion','elephant','tiger','leopard','cheetah','giraffe','wildlife sanctuary','reserve','serengeti','savanna','savannah'],
 ARRAY[
   'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1516426122078-c23e76319801?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1537672051766-ae2fec15975e?auto=format&fit=crop&w=1600&q=80'
 ]),

('Theme Parks & Entertainment',
 ARRAY['theme park','amusement','resort','rides','carnival','disney','universal','waterpark','entertainment','fun park','adventure park'],
 ARRAY[
   'https://images.unsplash.com/photo-1579652577786-1e89e8f4eaa2?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1512546148165-e50d714a565a?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1563396983906-b3795482a59a?auto=format&fit=crop&w=1600&q=80'
 ]),

('Food & Markets',
 ARRAY['market','street food','bazaar','cuisine','food','restaurant','cafe','culinary','spice','bazaar','souk','vendors','tasting','gastronomy','flavors'],
 ARRAY[
   'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=80',
   'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=80'
 ]);

COMMIT;
