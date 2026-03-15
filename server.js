const path = require("path");
const express = require("express");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "novicehall.db");

function openDatabase() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS workplaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      summary TEXT NOT NULL,
      location TEXT NOT NULL,
      industry TEXT NOT NULL,
      score INTEGER NOT NULL,
      band TEXT NOT NULL,
      verified_reviews INTEGER NOT NULL DEFAULT 0,
      salary_reports INTEGER NOT NULL DEFAULT 0,
      beginner_signal TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workplace_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workplace_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      value INTEGER NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS workplace_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workplace_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      snippet TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE
    );
  `);

  seedDatabase(db);
  return db;
}

function seedDatabase(db) {
  const existing = db.prepare("SELECT COUNT(*) AS count FROM workplaces").get().count;
  if (existing > 0) return;

  const workplaces = [
    {
      slug: "harbor-electric-co",
      name: "Harbor Electric Co.",
      tagline: "Steady crews, fair starting pay, and solid mentoring for newer hires.",
      summary:
        "Known for steady crews and supervisors who explain the work instead of throwing new people into the deep end.",
      location: "Baltimore, MD",
      industry: "Electrical",
      score: 84,
      band: "Strong",
      verifiedReviews: 18,
      salaryReports: 6,
      beginnerSignal: "Good beginner support",
      categories: [
        ["Pay fairness", 82],
        ["Management treatment", 86],
        ["Workplace environment", 83],
        ["Growth", 85],
        ["Reliability", 84]
      ],
      reviews: [
        ["Good place to get your footing", "The pace is real, but people answer questions and beginners are not mocked for learning."],
        ["Steady work and fair expectations", "Not perfect, but the crew was consistent and the pay matched what was promised."]
      ]
    },
    {
      slug: "northline-fabrication",
      name: "Northline Fabrication",
      tagline: "Better pay than some nearby shops, but pressure and supervision feel uneven.",
      summary:
        "Pay signals are stronger than average, though several reviews point to uneven training and rough communication.",
      location: "Cleveland, OH",
      industry: "Fabrication",
      score: 68,
      band: "Mixed",
      verifiedReviews: 11,
      salaryReports: 4,
      beginnerSignal: "Fast-paced floor",
      categories: [
        ["Pay fairness", 78],
        ["Management treatment", 58],
        ["Workplace environment", 64],
        ["Growth", 67],
        ["Reliability", 71]
      ],
      reviews: [
        ["You learn fast, but the pressure is real", "Useful if you can keep up, though some supervisors are not patient with beginners."],
        ["Decent pay, mixed support", "Worth checking carefully. Some teams sounded much better than others."]
      ]
    },
    {
      slug: "maple-transit-services",
      name: "Maple Transit Services",
      tagline: "Supportive team culture with steadier retention than many similar employers.",
      summary:
        "Workers describe a friendlier team culture, though advancement can depend a lot on location and supervisor.",
      location: "St. Paul, MN",
      industry: "Transit",
      score: 76,
      band: "Steady",
      verifiedReviews: 15,
      salaryReports: 5,
      beginnerSignal: "Low turnover",
      categories: [
        ["Pay fairness", 72],
        ["Management treatment", 79],
        ["Workplace environment", 80],
        ["Growth", 71],
        ["Reliability", 78]
      ],
      reviews: [
        ["Team made the difference", "The work was tiring, but the crew actually tried to help new people settle in."],
        ["More stable than most", "Scheduling was clearer than expected and turnover seemed lower than nearby places."]
      ]
    }
  ];

  const insertWorkplace = db.prepare(`
    INSERT INTO workplaces (
      slug, name, tagline, summary, location, industry, score, band,
      verified_reviews, salary_reports, beginner_signal
    ) VALUES (
      @slug, @name, @tagline, @summary, @location, @industry, @score, @band,
      @verifiedReviews, @salaryReports, @beginnerSignal
    )
  `);
  const insertCategory = db.prepare(`
    INSERT INTO workplace_categories (workplace_id, label, value, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  const insertReview = db.prepare(`
    INSERT INTO workplace_reviews (workplace_id, title, snippet)
    VALUES (?, ?, ?)
  `);

  const seed = db.transaction((items) => {
    for (const workplace of items) {
      const result = insertWorkplace.run(workplace);
      workplace.categories.forEach(([label, value], index) => {
        insertCategory.run(result.lastInsertRowid, label, value, index);
      });
      workplace.reviews.forEach(([title, snippet]) => {
        insertReview.run(result.lastInsertRowid, title, snippet);
      });
    }
  });

  seed(workplaces);
}

function createApp() {
  const db = openDatabase();
  const app = express();

  app.use(express.json());
  app.use(express.static(__dirname));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/workplaces", (_req, res) => {
    const workplaces = db.prepare(`
      SELECT
        slug,
        name,
        tagline,
        location,
        industry,
        score,
        band,
        verified_reviews AS verifiedReviews,
        salary_reports AS salaryReports,
        beginner_signal AS beginnerSignal
      FROM workplaces
      ORDER BY score DESC, name ASC
    `).all();

    res.json({ workplaces });
  });

  app.get("/api/workplaces/:slug", (req, res) => {
    const workplace = db.prepare(`
      SELECT
        id,
        slug,
        name,
        tagline,
        summary,
        location,
        industry,
        score,
        band,
        verified_reviews AS verifiedReviews,
        salary_reports AS salaryReports,
        beginner_signal AS beginnerSignal
      FROM workplaces
      WHERE slug = ?
    `).get(req.params.slug);

    if (!workplace) {
      res.status(404).json({ error: "Workplace not found" });
      return;
    }

    const categories = db.prepare(`
      SELECT label, value
      FROM workplace_categories
      WHERE workplace_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(workplace.id);

    const reviews = db.prepare(`
      SELECT title, snippet, created_at AS createdAt
      FROM workplace_reviews
      WHERE workplace_id = ? AND status = 'published'
      ORDER BY created_at DESC, id DESC
      LIMIT 6
    `).all(workplace.id);

    res.json({
      workplace: {
        ...workplace,
        categories,
        reviews
      }
    });
  });

  return app;
}

function startServer() {
  const app = createApp();
  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => {
    console.log(`NoviceHall server listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  openDatabase
};
