const express = require('express');
const { query } = require('../../config/database');

const router = express.Router();

function mapBlog(row, includeContent = false) {
  const out = {
    id: row.id,
    slug: row.slug,
    image: row.image,
    title: row.title,
    excerpt: row.excerpt,
    category: row.category,
    author: row.author,
    publishedAt: row.published_at,
  };
  if (includeContent) out.content = row.content;
  return out;
}

// GET /blogs?client=web|app
router.get('/', async (req, res) => {
  const client = req.query.client; // 'web' | 'app' | undefined

  let filterClause = 'WHERE published = true';
  if (client === 'web') filterClause += ' AND show_on_web = true';
  else if (client === 'app') filterClause += ' AND show_on_app = true';

  const orderClause = client === 'app'
    ? 'ORDER BY sort_order_app NULLS LAST, published_at DESC'
    : 'ORDER BY sort_order_web NULLS LAST, published_at DESC';

  try {
    const { rows } = await query(
      `SELECT id, slug, image, title, excerpt, category, author, published_at
         FROM blogs ${filterClause} ${orderClause}`,
    );
    res.json(rows.map((r) => mapBlog(r)));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blogs' });
  }
});

// GET /blogs/:idOrSlug
router.get('/:idOrSlug', async (req, res) => {
  const param = req.params.idOrSlug;
  const asNum = Number(param);
  const isId = !Number.isNaN(asNum) && Number.isInteger(asNum);

  try {
    const { rows } = await query(
      isId
        ? 'SELECT * FROM blogs WHERE id = $1 AND published = true'
        : 'SELECT * FROM blogs WHERE slug = $1 AND published = true',
      [isId ? asNum : param],
    );
    if (!rows.length) return res.status(404).json({ error: 'Blog not found' });
    res.json(mapBlog(rows[0], true));
  } catch (err) {
    res.status(500).json({ error: 'Failed to load blog' });
  }
});

module.exports = router;
