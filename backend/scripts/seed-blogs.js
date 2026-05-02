/**
 * One-shot seed: insert the 6 static blog posts into the blogs table.
 *
 * Safe to re-run — uses INSERT ... ON CONFLICT (slug) DO NOTHING.
 *
 * Usage:
 *   node backend/scripts/seed-blogs.js
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { query, pool } = require('../src/config/database');

const BLOGS = [
  {
    id: 1,
    slug: 'scuba-diving-andaman-guide',
    image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&auto=format&fit=crop',
    title: 'Scuba Diving in Andaman: The Ultimate Guide to an Unforgettable Underwater Experience',
    excerpt: 'There are trips you enjoy—and then there are experiences that stay with you forever. Scuba diving in the Andaman Islands falls firmly into the second category.',
    category: 'ADVENTURE',
    author: 'Vihaan Khanna',
    published_at: '2024-05-18',
    content: `There are trips you enjoy—and then there are experiences that stay with you forever.
Scuba diving in the Andaman Islands falls firmly into the second category.

Why Andaman is Perfect for Scuba Diving
The Andaman Islands offer some of the clearest waters in India, with underwater visibility often reaching up to 20–30 meters. Rich coral ecosystems, colorful marine life (clownfish, turtles, reef sharks), and less crowded sites make it ideal for beginners and experienced divers alike.

Best Places to Go Scuba Diving
Havelock Island (Swaraj Dweep) — the scuba diving hub of Andaman. Popular sites: Nemo Reef, Elephant Beach, Lighthouse.
Neil Island (Shaheed Dweep) — quieter, cleaner reefs, fewer crowds.
North Bay Island — close to Port Blair, budget-friendly, beginner-focused.

Best Time to Visit
October to May. The sea is calm, visibility is at its best, and marine life is more active. Avoid monsoon season (June–September).

Cost of Scuba Diving
Beginner/Discovery Dive: ₹2,000 – ₹6,500 per person (includes training, 20–40 min dive, certified instructor).
PADI Open Water Course: ₹20,000 – ₹35,000.

Things to Know Before You Dive
You don't need to know swimming for beginner dives. A certified instructor guides you throughout. Breathing is slow and controlled through the regulator.

Planning Your Andaman Trip
A typical itinerary: 2–3 nights Havelock, 1–2 nights Neil Island, 1 night Port Blair. Coordinating ferries, dive slots, and group preferences can get complicated — that's exactly why we built GatherrGo.

Contact us at Hello@GatherrGo.com for a free customized itinerary and exclusive discounts for your trip.`,
  },
  {
    id: 2,
    slug: 'how-to-plan-group-trip-without-chaos',
    image: 'https://images.unsplash.com/photo-1539635278303-d4002c07eae3?w=800&auto=format&fit=crop',
    title: 'How to Plan a Group Trip Without Chaos (Step-by-Step Guide)',
    excerpt: 'Planning a group trip always starts the same way. Someone sends a message on WhatsApp: "Let\'s plan a trip!" Everyone reacts with excitement. And then… chaos begins.',
    category: 'TRAVEL TIPS',
    author: 'Vihaan Khanna',
    published_at: '2024-06-02',
    content: `Planning a group trip always starts the same way. Someone sends a message on WhatsApp: "Let's plan a trip!" Everyone reacts with excitement. And then… chaos begins.

The WhatsApp chat gets flooded. Important messages get lost between jokes. Someone creates a Splitwise group "just in case." Dates keep changing. Half the group goes silent. A week later, nothing is booked.

1. Start With a Shared Vision
Before the chat turns into 200 unread messages, align on what kind of trip this is. Chill, adventure, party, or a mix — be clear. This one step can save hours of back-and-forth.

2. Lock the Group
Set a clear deadline and ask people to confirm. After that, plan only with the people who are in.

3. Finalize Dates and Budget First
Share 2–3 date options, let everyone vote, lock it. Then talk budget — before bookings, not after.

4. Choose a Destination
Shortlist 2–3 destinations that fit your dates and budget. Share quick pros and cons. Decide and move on.

5. Stop Relying Only on WhatsApp
WhatsApp is great for talking, terrible for planning. Important details get buried, booking links disappear. Patching WhatsApp + Google Docs + Splitwise + Notes just creates chaos in five places.

6. Keep the Itinerary Simple
Plan loosely — one or two key things per day. Leave space for flexibility. Group trips aren't about ticking off places — they're about shared moments.

7. Preserve the Trip After It Ends
Photos stay scattered across phones unless someone actively organizes them. Use GatherrGo to keep everything in one place — from the first idea to the last memory.`,
  },
  {
    id: 3,
    slug: 'top-6-cities-usa-first-time-travelers',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800&auto=format&fit=crop',
    title: 'Top 6 Cities to Visit in the USA for First-Time Travelers (Complete Guide)',
    excerpt: 'Planning a trip to the United States can feel overwhelming. It\'s not just one destination—it\'s a collection of completely different worlds.',
    category: 'GUIDES',
    author: 'Vihaan Khanna',
    published_at: '2024-07-08',
    content: `Planning a trip to the United States can feel overwhelming. It's not just one destination — it's a collection of completely different worlds.

1. New York City – The Ultimate First Impression
Times Square, Central Park, Brooklyn Bridge, Empire State Building. 3-day suggested itinerary covering Midtown, Downtown, and Culture & Views.

2. Las Vegas – Where Time Doesn't Exist
The Strip, Bellagio Fountains, High Roller, pool parties, nightlife. 3-day plan including an optional Grand Canyon day trip.

3. Los Angeles – A City of Different Moods
Hollywood Boulevard, Griffith Observatory, Santa Monica Pier, Venice Beach, Downtown LA. 3-day plan.

4. San Francisco – Slower, Scenic, Cinematic
Golden Gate Bridge, Alcatraz, cable car, Lombard Street, Fisherman's Wharf. 2-day plan.

5. Miami – Beach Days, Party Nights
South Beach, Ocean Drive, Wynwood Walls. 2-day plan.

6. Chicago – The Unexpected Favorite
The Bean, riverwalk, architecture cruise, Navy Pier. 2-day plan.

Suggested Route for First-Time Travelers
New York → Chicago → Las Vegas → Los Angeles → San Francisco (add Miami if you have extra time).

Things to Know
Domestic flights are easiest between cities. Public transport works best in New York & Chicago. LA and Miami are easier with a car. Book major attractions in advance.

Planning a multi-city trip like this with a group? GatherrGo keeps city-wise itineraries, bookings, and group coordination in one place.`,
  },
  {
    id: 4,
    slug: 'top-apps-group-travel-planning',
    image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&auto=format&fit=crop',
    title: 'Top Apps for Group Travel Planning: Better Alternatives to WhatsApp Chaos',
    excerpt: 'Every group trip starts in the same place: a WhatsApp group. For a while, it feels like things are moving. Then reality kicks in.',
    category: 'GENERAL',
    author: 'Vihaan Khanna',
    published_at: '2024-04-20',
    content: `Every group trip starts in the same place: a WhatsApp group. For a while, it feels like things are moving. Then reality kicks in.

1. WhatsApp – Great for Talking, Terrible for Planning
Fast, familiar, everyone's there. But important details get lost, links disappear, and you scroll endlessly for that one message. Not designed to organize a trip.

2. Splitwise – Solves Money, Not Coordination
Tracks shared expenses well. Doesn't help with destination, itinerary, or bookings. A great add-on, not a complete solution.

3. TripAdvisor – Endless Ideas, No Decisions
Incredible for discovery. Bad for group decision-making. You don't need more options — you need alignment.

4. ChatGPT – Great Ideas, No Coordination
Fast itinerary ideas, but the plan lives in one person's chat. Doesn't track bookings or keep everyone aligned.

5. TripIt – Great for Individual Itineraries
Auto-organizes bookings from email. Primarily for solo travelers, not deeply collaborative.

6. Wanderlog – Closer, But Still Fragmented
Purpose-built for travel. Comes close but discussions often continue on WhatsApp and expense tracking isn't seamless.

7. Google Docs – Organized, But Hard to Maintain
Works initially but people forget to update it and it doesn't connect with chats, bookings, or expenses.

The Real Problem Isn't the Apps — It's the Fragmentation
WhatsApp + TripAdvisor + ChatGPT + Google Docs + TripIt + Splitwise. Each solves one part. None solve the entire journey.

GatherrGo brings everything into a single unified experience — plan, coordinate, track expenses, and preserve memories — all in one place.`,
  },
  {
    id: 5,
    slug: 'thailand-nightlife-guide',
    image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800&auto=format&fit=crop',
    title: 'Thailand Nightlife Guide: The Best Parties Across Bangkok, Phuket & Koh Phangan',
    excerpt: 'Thailand isn\'t just a destination—it\'s an experience that truly comes alive after dark. As the sun sets, cities transform.',
    category: 'NIGHTLIFE',
    author: 'Vihaan Khanna',
    published_at: '2024-08-22',
    content: `Thailand isn't just a destination — it's an experience that truly comes alive after dark.

Bangkok – Rooftops, Streets & High-Energy Clubs
Start at Tichuca Rooftop Bar → Vertigo and Moon Bar → Sky Bar → Sukhumvit Road → Levels Club & Lounge → late-night street food.
Night 2: Khao San Road bar-hopping → The Club Khaosan → after-party food.

Phuket – Beach Clubs & Bangla Road Madness
Night 1: Walk through Bangla Road → bar hopping → Illuzion Phuket → Sugar Club.
Night 2: Sunset at Café del Mar → Catch Beach Club.

Koh Phangan – The Full Moon Party
Head to Haad Rin Beach → pre-drinks → neon paint → music zones → fire shows → party till sunrise.

Krabi – Slower Nights, Better Conversations
Beachside dinner → live music bars → casual drinks → night market stroll.

Suggested Route
Bangkok → Phuket → Koh Phangan → Krabi. Big city nightlife → beach club energy → wild party → relaxed ending.

Things to Know Before You Party
Always carry ID. Stay aware in crowded areas. Be careful with bucket drinks. Use trusted transport at night.

Planning nightlife across multiple cities with a group can get messy fast — different plans, scattered bookings. GatherrGo keeps it all coordinated.`,
  },
  {
    id: 6,
    slug: 'goa-trip-cost-budget-breakdown',
    image: 'https://images.unsplash.com/photo-1587922546307-776227941871?w=800&auto=format&fit=crop',
    title: 'Goa Trip Cost for Friends: Real Budget Breakdown for a 4-Day North Goa Trip',
    excerpt: 'Planning a Goa trip with friends always starts the same way—big plans, beach scenes, party ideas. And then reality hits: "Kitna kharcha hoga?"',
    category: 'BUDGET',
    author: 'Vihaan Khanna',
    published_at: '2024-09-10',
    content: `Planning a Goa trip with friends always starts the same way — big plans, beach scenes, party ideas. And then reality hits: "Kitna kharcha hoga?"

Trip Overview: 4 Days, North Goa (group of 4 friends, 3 nights)
Best areas: Anjuna, Vagator, Morjim.

Stay Costs (Per Person, 3 Nights)
Budget hostels: ₹1,500–₹3,000.
Mid-range hotels/Airbnbs (shared): ₹4,500–₹12,000. Sweet spot for 4 people.
Beachside/boutique: ₹15,000–₹37,500.

Food & Drinks (Per Day)
Breakfast at cafés: ₹250–₹700.
Lunch at local thalis: ₹350–₹1,000. Beach shacks: ₹700–₹1,200.
Dinner + drinks: ₹800–₹2,500.
Smart tip: Alcohol is significantly cheaper from local stores. Pre-drinking dramatically cuts nightlife spend.

Total Food Cost (4 Days): Budget ₹3,500–₹7,000 | Mid-range ₹7,000–₹12,500.

Transport
Self-drive car: ₹1,000–₹1,500/day, split 4 ways = very cheap. Scooter: ₹300–₹500/day.

Nightlife (3 Nights)
North Goa highlights: Thalassa, Hilltop, Pablo's & Joseph Bar, Darlings.
Budget ₹2,000–₹5,000 | Mid-range ₹5,000–₹10,000.

Total Cost Breakdown Per Person
Budget: ₹9,000–₹18,000 | Mid-range: ₹18,000–₹37,000 | Premium: ₹37,000–₹75,000+.

Goa becomes significantly cheaper — and better — when planned right, especially with a group of 4. GatherrGo keeps expenses, plans, and group coordination in one place.`,
  },
];

async function main() {
  console.log('Seeding blogs...');

  for (const blog of BLOGS) {
    const { rowCount } = await query(
      `INSERT INTO blogs
         (id, slug, image, title, excerpt, content, category, author, published_at,
          published, show_on_web, show_on_app, sort_order_web, sort_order_app)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true, true, true, $1, $1)
       ON CONFLICT (slug) DO NOTHING`,
      [
        blog.id,
        blog.slug,
        blog.image,
        blog.title,
        blog.excerpt,
        blog.content,
        blog.category,
        blog.author,
        blog.published_at,
      ],
    );
    console.log(`  ${rowCount ? 'inserted' : 'skipped (exists)'} — ${blog.slug}`);
  }

  // Advance the sequence past our manually set IDs so future INSERTs don't collide
  await query(`SELECT setval('blogs_id_seq', (SELECT MAX(id) FROM blogs))`);

  console.log('Done.');
  await pool.end();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
