const path = require("path");
const crypto = require("crypto");
const express = require("express");
const Database = require("better-sqlite3");
const { loadLocalEnv } = require("./config");

loadLocalEnv();

const DB_PATH = path.join(__dirname, "novicehall.db");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const adminSessions = new Map();

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function ratingToScore(value) {
  return Math.max(1, Math.min(5, Number(value))) * 20;
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;

  headerValue.split(";").forEach((part) => {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName) return;
    cookies[rawName] = decodeURIComponent(rawValue.join("=") || "");
  });

  return cookies;
}

function createAdminSession() {
  const token = crypto.randomBytes(24).toString("hex");
  adminSessions.set(token, Date.now());
  return token;
}

function clearAdminSession(token) {
  if (!token) return;
  adminSessions.delete(token);
}

function hasValidAdminSession(req) {
  const token = parseCookies(req.headers.cookie).nh_admin_session;
  return Boolean(token && adminSessions.has(token));
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    res.status(503).send("Admin access is disabled until ADMIN_PASSWORD is set.");
    return;
  }

  if (!hasValidAdminSession(req)) {
    if (req.path.startsWith("/api/")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.redirect("/admin-login.html");
    return;
  }

  next();
}

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
      source_submission_id INTEGER,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE CASCADE,
      FOREIGN KEY (source_submission_id) REFERENCES review_submissions(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS review_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workplace_id INTEGER,
      workplace_name TEXT NOT NULL,
      workplace_slug TEXT,
      reviewer_role TEXT NOT NULL,
      reviewer_location TEXT NOT NULL,
      employment_type TEXT NOT NULL,
      pay_rating INTEGER NOT NULL,
      management_rating INTEGER NOT NULL,
      environment_rating INTEGER NOT NULL,
      growth_rating INTEGER NOT NULL,
      reliability_rating INTEGER NOT NULL,
      salary_amount INTEGER,
      salary_period TEXT,
      review_title TEXT NOT NULL,
      review_body TEXT NOT NULL,
      public_status TEXT NOT NULL DEFAULT 'pending',
      verification_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workplace_id) REFERENCES workplaces(id) ON DELETE SET NULL
    );
  `);

  const workplaceReviewColumns = db.prepare("PRAGMA table_info(workplace_reviews)").all();
  if (!workplaceReviewColumns.some((column) => column.name === "source_submission_id")) {
    db.exec("ALTER TABLE workplace_reviews ADD COLUMN source_submission_id INTEGER");
  }

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
  const insertPublishedReview = db.prepare(`
    INSERT INTO workplace_reviews (workplace_id, title, snippet, source_submission_id, status)
    VALUES (?, ?, ?, ?, 'published')
  `);
  const getCategories = db.prepare(`
    SELECT id, label, value
    FROM workplace_categories
    WHERE workplace_id = ?
    ORDER BY sort_order ASC, id ASC
  `);
  const updateCategory = db.prepare(`
    UPDATE workplace_categories
    SET value = ?
    WHERE id = ?
  `);
  const updateWorkplaceMetrics = db.prepare(`
    UPDATE workplaces
    SET score = @score,
        band = @band,
        verified_reviews = @verifiedReviews,
        salary_reports = @salaryReports,
        beginner_signal = @beginnerSignal
    WHERE id = @id
  `);
  const updateSubmissionStatus = db.prepare(`
    UPDATE review_submissions
    SET public_status = @publicStatus,
        verification_status = @verificationStatus
    WHERE id = @id
  `);
  const deletePublishedReviewBySubmission = db.prepare(`
    DELETE FROM workplace_reviews
    WHERE source_submission_id = ?
  `);
  const deletePublishedReviewFallback = db.prepare(`
    DELETE FROM workplace_reviews
    WHERE id = (
      SELECT id
      FROM workplace_reviews
      WHERE workplace_id = ? AND title = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    )
  `);

  const rebuildSignal = (categories, reviewCount) => {
    const byLabel = Object.fromEntries(categories.map((category) => [category.label, category.value]));
    if (reviewCount <= 0) return "Awaiting approved reviews";
    if ((byLabel.Growth || 0) >= 80) return "Good beginner support";
    if ((byLabel["Management treatment"] || 0) <= 45) return "Approach with caution";
    return "Mixed beginner signal";
  };

  const ensureWorkplaceForSubmission = (submission) => {
    if (submission.workplace_id) {
      return db.prepare(`
        SELECT id, name, slug, score, band, verified_reviews, salary_reports, beginner_signal
        FROM workplaces
        WHERE id = ?
      `).get(submission.workplace_id);
    }

    const slugBase = slugify(submission.workplace_slug || submission.workplace_name) || `workplace-${submission.id}`;
    let slug = slugBase;
    let suffix = 2;
    while (db.prepare("SELECT 1 FROM workplaces WHERE slug = ?").get(slug)) {
      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }

    const categorySeed = [
      ["Pay fairness", ratingToScore(submission.pay_rating)],
      ["Management treatment", ratingToScore(submission.management_rating)],
      ["Workplace environment", ratingToScore(submission.environment_rating)],
      ["Growth", ratingToScore(submission.growth_rating)],
      ["Reliability", ratingToScore(submission.reliability_rating)]
    ];
    const average = clampScore(categorySeed.reduce((sum, item) => sum + item[1], 0) / categorySeed.length);
    const result = insertWorkplace.run({
      slug,
      name: submission.workplace_name,
      tagline: "A newly submitted workplace profile is taking shape from approved reviews.",
      summary: "This workplace page was created from a reviewed submission and will deepen as more approved stories come in.",
      location: submission.reviewer_location,
      industry: "Workplace",
      score: average,
      band: average >= 85 ? "Excellent" : average >= 70 ? "Strong" : average >= 55 ? "Mixed" : "High risk",
      verifiedReviews: 0,
      salaryReports: 0,
      beginnerSignal: "First reviewed signal"
    });

    categorySeed.forEach(([label, value], index) => {
      insertCategory.run(result.lastInsertRowid, label, value, index);
    });

    db.prepare(`
      UPDATE review_submissions
      SET workplace_id = ?, workplace_slug = ?
      WHERE id = ?
    `).run(result.lastInsertRowid, slug, submission.id);

    return db.prepare(`
      SELECT id, name, slug, score, band, verified_reviews, salary_reports, beginner_signal
      FROM workplaces
      WHERE id = ?
    `).get(result.lastInsertRowid);
  };

  const approveSubmission = db.transaction((id) => {
    const submission = db.prepare(`
      SELECT *
      FROM review_submissions
      WHERE id = ?
    `).get(id);

    if (!submission) {
      return { error: "Review submission not found.", status: 404 };
    }
    if (submission.public_status !== "pending") {
      return { error: "Review submission has already been decided.", status: 400 };
    }

    const workplace = ensureWorkplaceForSubmission(submission);
    const categories = getCategories.all(workplace.id);
    const existingReviewCount = Number(workplace.verified_reviews || 0);
    const incoming = {
      "Pay fairness": ratingToScore(submission.pay_rating),
      "Management treatment": ratingToScore(submission.management_rating),
      "Workplace environment": ratingToScore(submission.environment_rating),
      Growth: ratingToScore(submission.growth_rating),
      Reliability: ratingToScore(submission.reliability_rating)
    };

    categories.forEach((category) => {
      const nextValue = clampScore(((category.value * existingReviewCount) + incoming[category.label]) / (existingReviewCount + 1));
      updateCategory.run(nextValue, category.id);
    });

    const refreshedCategories = getCategories.all(workplace.id);
    const nextScore = clampScore(
      refreshedCategories.reduce((sum, category) => sum + category.value, 0) / Math.max(1, refreshedCategories.length)
    );
    const nextBand = nextScore >= 85 ? "Excellent" : nextScore >= 70 ? "Strong" : nextScore >= 55 ? "Mixed" : "High risk";
    const nextVerifiedReviews = existingReviewCount + 1;
    const nextSalaryReports = Number(workplace.salary_reports || 0) + (submission.salary_amount ? 1 : 0);
    const nextBeginnerSignal =
      submission.growth_rating >= 4 ? "Good beginner support" :
      submission.management_rating <= 2 ? "Approach with caution" :
      "Mixed beginner signal";

    updateWorkplaceMetrics.run({
      id: workplace.id,
      score: nextScore,
      band: nextBand,
      verifiedReviews: nextVerifiedReviews,
      salaryReports: nextSalaryReports,
      beginnerSignal: nextBeginnerSignal
    });

    const snippet = submission.review_body.length > 180
      ? `${submission.review_body.slice(0, 177).trim()}...`
      : submission.review_body;
    insertPublishedReview.run(workplace.id, submission.review_title, snippet, submission.id);
    updateSubmissionStatus.run({
      id: submission.id,
      publicStatus: "published",
      verificationStatus: "approved"
    });

    return {
      submissionId: submission.id,
      workplaceSlug: workplace.slug,
      publicStatus: "published",
      verificationStatus: "approved"
    };
  });

  const rejectSubmission = (id) => {
    const submission = db.prepare(`
      SELECT id, public_status
      FROM review_submissions
      WHERE id = ?
    `).get(id);
    if (!submission) {
      return { error: "Review submission not found.", status: 404 };
    }
    if (submission.public_status !== "pending") {
      return { error: "Review submission has already been decided.", status: 400 };
    }
    updateSubmissionStatus.run({
      id,
      publicStatus: "rejected",
      verificationStatus: "rejected"
    });
    return {
      submissionId: id,
      publicStatus: "rejected",
      verificationStatus: "rejected"
    };
  };

  const removePublishedSubmission = db.transaction((id) => {
    const submission = db.prepare(`
      SELECT *
      FROM review_submissions
      WHERE id = ?
    `).get(id);

    if (!submission) {
      return { error: "Review submission not found.", status: 404 };
    }
    if (submission.public_status !== "published") {
      return { error: "Only published reviews can be removed from public view.", status: 400 };
    }

    const workplace = db.prepare(`
      SELECT id, slug, verified_reviews, salary_reports
      FROM workplaces
      WHERE id = ?
    `).get(submission.workplace_id);

    if (!workplace) {
      return { error: "Linked workplace was not found.", status: 404 };
    }

    const categories = getCategories.all(workplace.id);
    const currentReviewCount = Math.max(1, Number(workplace.verified_reviews || 0));
    const incoming = {
      "Pay fairness": ratingToScore(submission.pay_rating),
      "Management treatment": ratingToScore(submission.management_rating),
      "Workplace environment": ratingToScore(submission.environment_rating),
      Growth: ratingToScore(submission.growth_rating),
      Reliability: ratingToScore(submission.reliability_rating)
    };

    categories.forEach((category) => {
      const nextValue =
        currentReviewCount <= 1
          ? incoming[category.label]
          : clampScore(((category.value * currentReviewCount) - incoming[category.label]) / (currentReviewCount - 1));
      updateCategory.run(nextValue, category.id);
    });

    const deleteResult = deletePublishedReviewBySubmission.run(submission.id);
    if (!deleteResult.changes) {
      deletePublishedReviewFallback.run(workplace.id, submission.review_title);
    }
    updateSubmissionStatus.run({
      id: submission.id,
      publicStatus: "removed",
      verificationStatus: "removed"
    });

    const refreshedCategories = getCategories.all(workplace.id);
    const nextReviewCount = Math.max(0, currentReviewCount - 1);
    const nextScore = clampScore(
      refreshedCategories.reduce((sum, category) => sum + category.value, 0) / Math.max(1, refreshedCategories.length)
    );
    const nextBand = nextScore >= 85 ? "Excellent" : nextScore >= 70 ? "Strong" : nextScore >= 55 ? "Mixed" : "High risk";
    const nextSalaryReports = Math.max(0, Number(workplace.salary_reports || 0) - (submission.salary_amount ? 1 : 0));

    updateWorkplaceMetrics.run({
      id: workplace.id,
      score: nextScore,
      band: nextBand,
      verifiedReviews: nextReviewCount,
      salaryReports: nextSalaryReports,
      beginnerSignal: rebuildSignal(refreshedCategories, nextReviewCount)
    });

    return {
      submissionId: submission.id,
      workplaceSlug: workplace.slug,
      publicStatus: "removed",
      verificationStatus: "removed"
    };
  });

  app.use(express.json());

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

  app.post("/api/reviews", (req, res) => {
    const body = req.body || {};
    const workplaceSlug = typeof body.workplaceSlug === "string" ? body.workplaceSlug.trim() : "";
    const workplaceName = typeof body.workplaceName === "string" ? body.workplaceName.trim() : "";
    const reviewerRole = typeof body.reviewerRole === "string" ? body.reviewerRole.trim() : "";
    const reviewerLocation = typeof body.reviewerLocation === "string" ? body.reviewerLocation.trim() : "";
    const employmentType = typeof body.employmentType === "string" ? body.employmentType.trim() : "";
    const reviewTitle = typeof body.reviewTitle === "string" ? body.reviewTitle.trim() : "";
    const reviewBody = typeof body.reviewBody === "string" ? body.reviewBody.trim() : "";
    const salaryPeriod = typeof body.salaryPeriod === "string" ? body.salaryPeriod.trim() : "";
    const salaryAmount = body.salaryAmount === "" || body.salaryAmount == null ? null : Number(body.salaryAmount);
    const ratings = {
      payRating: Number(body.payRating),
      managementRating: Number(body.managementRating),
      environmentRating: Number(body.environmentRating),
      growthRating: Number(body.growthRating),
      reliabilityRating: Number(body.reliabilityRating)
    };

    if (!reviewerRole || !reviewerLocation || !employmentType || !reviewTitle || !reviewBody) {
      res.status(400).json({ error: "Missing required review fields." });
      return;
    }

    const ratingValues = Object.values(ratings);
    const ratingsValid = ratingValues.every((value) => Number.isInteger(value) && value >= 1 && value <= 5);
    if (!ratingsValid) {
      res.status(400).json({ error: "Ratings must be whole numbers between 1 and 5." });
      return;
    }

    if (reviewTitle.length > 120 || reviewBody.length > 4000) {
      res.status(400).json({ error: "Review content is too long." });
      return;
    }

    if (salaryAmount !== null && (!Number.isFinite(salaryAmount) || salaryAmount < 0)) {
      res.status(400).json({ error: "Salary amount must be a positive number." });
      return;
    }

    let workplace = null;
    if (workplaceSlug) {
      workplace = db.prepare(`
        SELECT id, name, slug
        FROM workplaces
        WHERE slug = ?
      `).get(workplaceSlug);
      if (!workplace) {
        res.status(400).json({ error: "Selected workplace was not found." });
        return;
      }
    }

    const resolvedWorkplaceName = workplace ? workplace.name : workplaceName;
    if (!resolvedWorkplaceName) {
      res.status(400).json({ error: "Choose a workplace or enter a workplace name." });
      return;
    }

    const resolvedSlug = workplace ? workplace.slug : slugify(resolvedWorkplaceName);
    const insertSubmission = db.prepare(`
      INSERT INTO review_submissions (
        workplace_id,
        workplace_name,
        workplace_slug,
        reviewer_role,
        reviewer_location,
        employment_type,
        pay_rating,
        management_rating,
        environment_rating,
        growth_rating,
        reliability_rating,
        salary_amount,
        salary_period,
        review_title,
        review_body
      ) VALUES (
        @workplaceId,
        @workplaceName,
        @workplaceSlug,
        @reviewerRole,
        @reviewerLocation,
        @employmentType,
        @payRating,
        @managementRating,
        @environmentRating,
        @growthRating,
        @reliabilityRating,
        @salaryAmount,
        @salaryPeriod,
        @reviewTitle,
        @reviewBody
      )
    `);

    const result = insertSubmission.run({
      workplaceId: workplace ? workplace.id : null,
      workplaceName: resolvedWorkplaceName,
      workplaceSlug: resolvedSlug || null,
      reviewerRole,
      reviewerLocation,
      employmentType,
      payRating: ratings.payRating,
      managementRating: ratings.managementRating,
      environmentRating: ratings.environmentRating,
      growthRating: ratings.growthRating,
      reliabilityRating: ratings.reliabilityRating,
      salaryAmount,
      salaryPeriod: salaryPeriod || null,
      reviewTitle,
      reviewBody
    });

    res.status(201).json({
      submission: {
        id: result.lastInsertRowid,
        workplaceName: resolvedWorkplaceName,
        publicStatus: "pending",
        verificationStatus: "pending"
      }
    });
  });

  app.get("/api/admin/reviews", (req, res) => {
    if (!hasValidAdminSession(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : "pending";
    const baseQuery = `
      SELECT
        id,
        workplace_name AS workplaceName,
        workplace_slug AS workplaceSlug,
        workplace_id AS workplaceId,
        reviewer_role AS reviewerRole,
        reviewer_location AS reviewerLocation,
        employment_type AS employmentType,
        pay_rating AS payRating,
        management_rating AS managementRating,
        environment_rating AS environmentRating,
        growth_rating AS growthRating,
        reliability_rating AS reliabilityRating,
        salary_amount AS salaryAmount,
        salary_period AS salaryPeriod,
        review_title AS reviewTitle,
        review_body AS reviewBody,
        public_status AS publicStatus,
        verification_status AS verificationStatus,
        created_at AS createdAt
      FROM review_submissions
    `;
    const submissions =
      status === "all"
        ? db.prepare(`${baseQuery} ORDER BY created_at DESC, id DESC`).all()
        : db.prepare(`${baseQuery} WHERE public_status = ? ORDER BY created_at DESC, id DESC`).all(status);

    res.json({ submissions });
  });

  app.post("/api/admin/reviews/:id/decision", (req, res) => {
    if (!hasValidAdminSession(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const id = Number(req.params.id);
    const decision = typeof req.body.decision === "string" ? req.body.decision.trim().toLowerCase() : "";
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid submission id." });
      return;
    }
    if (decision !== "approve" && decision !== "reject") {
      res.status(400).json({ error: "Decision must be approve or reject." });
      return;
    }

    const result = decision === "approve" ? approveSubmission(id) : rejectSubmission(id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ submission: result });
  });

  app.post("/api/admin/reviews/:id/remove", (req, res) => {
    if (!hasValidAdminSession(req)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid submission id." });
      return;
    }

    const result = removePublishedSubmission(id);
    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ submission: result });
  });

  app.post("/api/admin/login", (req, res) => {
    if (!ADMIN_PASSWORD) {
      res.status(503).json({ error: "Admin access is disabled until ADMIN_PASSWORD is set." });
      return;
    }

    const password = typeof req.body.password === "string" ? req.body.password : "";
    if (password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }

    const token = createAdminSession();
    res.setHeader("Set-Cookie", `nh_admin_session=${token}; HttpOnly; SameSite=Lax; Path=/`);
    res.json({ ok: true });
  });

  app.post("/api/admin/logout", (req, res) => {
    const token = parseCookies(req.headers.cookie).nh_admin_session;
    clearAdminSession(token);
    res.setHeader("Set-Cookie", "nh_admin_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0");
    res.json({ ok: true });
  });

  app.get("/admin-login.html", (_req, res) => {
    res.sendFile(path.join(__dirname, "admin-login.html"));
  });

  app.get("/admin.html", requireAdminAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, "admin.html"));
  });

  app.get("/admin-data.html", requireAdminAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, "admin-data.html"));
  });

  app.use(express.static(__dirname));

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
