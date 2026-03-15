(function () {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const apiBase = "/api/workplaces";
  const reviewApiBase = "/api/reviews";
  const adminReviewApiBase = "/api/admin/reviews";
  const adminWorkplaceApiBase = "/api/admin/workplaces";
  const adminLoginApiBase = "/api/admin/login";
  const adminLogoutApiBase = "/api/admin/logout";

  const downloadCsv = (rows, fileName) => {
    const escapeCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const escapeHtml = (value) =>
    String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const cardMarkup = (workplace) => `
    <article class="card company-card">
      <div class="company-head">
        <div>
          <h3>${escapeHtml(workplace.name)}</h3>
          <p>${escapeHtml(workplace.tagline)}</p>
        </div>
        <div class="company-score" aria-label="Workplace score ${workplace.score} out of 100">
          <strong>${workplace.score}</strong>
          <span>${escapeHtml(workplace.band)}</span>
        </div>
      </div>
      <div class="signal-row">
        <span class="signal">${workplace.verifiedReviews} verified reviews</span>
        <span class="signal">${workplace.salaryReports} salary reports</span>
        <span class="signal">${escapeHtml(workplace.beginnerSignal)}</span>
      </div>
      <a class="btn btn-soft" href="company.html?slug=${encodeURIComponent(workplace.slug)}">Open workplace</a>
    </article>
  `;

  const emptyStateMarkup = (title, body) => `
    <article class="card">
      <h3>${title}</h3>
      <p>${body}</p>
    </article>
  `;

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json", ...(options.headers || {}) },
      ...options
    });

    if (!response.ok) {
      const maybeJson = await response.json().catch(() => ({}));
      throw new Error(maybeJson.error || `Request failed: ${response.status}`);
    }

    return response.json();
  };

  const renderHomeCards = async () => {
    const mount = document.querySelector("[data-workplace-preview]");
    if (!mount) return;

    try {
      const data = await fetchJson(apiBase);
      const workplaces = data.workplaces || [];

      if (!workplaces.length) {
        mount.innerHTML = emptyStateMarkup("No workplaces yet", "Company cards will appear here once workplace data starts coming in.");
        return;
      }

      mount.innerHTML = workplaces.slice(0, 3).map(cardMarkup).join("");
    } catch (_error) {
      mount.innerHTML = emptyStateMarkup("Workplaces are loading soon", "The shared workplace cards will appear here once the API is running.");
    }
  };

  const renderCompaniesPage = async () => {
    const mount = document.querySelector("[data-companies-grid]");
    if (!mount) return;

    try {
      const data = await fetchJson(apiBase);
      const workplaces = data.workplaces || [];

      if (!workplaces.length) {
        mount.innerHTML = emptyStateMarkup("No workplaces yet", "Company cards will appear here once data starts coming in.");
        return;
      }

      mount.innerHTML = workplaces.map(cardMarkup).join("");
    } catch (_error) {
      mount.innerHTML = emptyStateMarkup("Could not load workplaces", "Start the backend server to turn this list into a live company feed.");
    }
  };

  const renderCompanyPage = async () => {
    const mount = document.querySelector("[data-company-detail]");
    if (!mount) return;

    const slug = params.get("slug");
    if (!slug) {
      mount.innerHTML =
        '<section class="section container"><article class="card"><h2>Choose a workplace first</h2><p>Open a workplace from the browse page to load its shared detail view.</p></article></section>';
      return;
    }

    try {
      const data = await fetchJson(`${apiBase}/${encodeURIComponent(slug)}`);
      const workplace = data.workplace;

      mount.innerHTML = `
        <section class="score-hero container reveal in-view">
          <div class="score-hero-grid">
            <div class="score-hero-copy">
              <p class="eyebrow">${escapeHtml(workplace.industry)} | ${escapeHtml(workplace.location)}</p>
              <h1>${escapeHtml(workplace.name)}</h1>
              <p class="hero-copy">${escapeHtml(workplace.summary)}</p>
              <div class="hero-actions">
                <a class="btn btn-primary" href="companies.html">Browse more workplaces</a>
                <a class="btn btn-soft" href="review-workplace.html?slug=${encodeURIComponent(workplace.slug)}">Review this workplace</a>
              </div>
            </div>
            <aside class="search-preview">
              <p class="mini-caption">Current workplace signal</p>
              <div class="company-score company-score-large" aria-label="Workplace score ${workplace.score} out of 100">
                <strong>${workplace.score}</strong>
                <span>${escapeHtml(workplace.band)}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${workplace.verifiedReviews} verified reviews</span>
                <span class="tag">${workplace.salaryReports} salary reports</span>
                <span class="tag">${escapeHtml(workplace.beginnerSignal)}</span>
              </div>
            </aside>
          </div>
        </section>

        <section class="section container reveal in-view">
          <div class="section-head">
            <h2>Category breakdown</h2>
            <p>A simple first look at the signals that shape this workplace score.</p>
          </div>
          <div class="grid cards-3">
            ${workplace.categories
              .map(
                (category) => `
                  <article class="card metric-card">
                    <span class="score-pill">${category.value}/100</span>
                    <h3>${escapeHtml(category.label)}</h3>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>

        <section class="section container reveal in-view">
          <div class="section-head">
            <h2>Recent verified review snippets</h2>
            <p>Short examples of the kind of workplace context this product is meant to surface.</p>
          </div>
          <div class="grid cards-3">
            ${workplace.reviews
              .map(
                (review) => `
                  <article class="card review-card">
                    <h3>${escapeHtml(review.title)}</h3>
                    <p>${escapeHtml(review.snippet)}</p>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      `;
    } catch (_error) {
      mount.innerHTML =
        '<section class="section container"><article class="card"><h2>Workplace not found</h2><p>This shared page will fill in automatically when that company exists in the database.</p></article></section>';
    }
  };

  const renderReviewPage = async () => {
    const form = document.querySelector("[data-review-form]");
    const select = document.querySelector("[data-workplace-select]");
    const status = document.querySelector("[data-form-status]");
    if (!form || !select || !status) return;

    try {
      const data = await fetchJson(apiBase);
      const workplaces = data.workplaces || [];
      const requestedSlug = params.get("slug");

      workplaces.forEach((workplace) => {
        const option = document.createElement("option");
        option.value = workplace.slug;
        option.textContent = `${workplace.name} (${workplace.location})`;
        if (requestedSlug && workplace.slug === requestedSlug) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    } catch (_error) {
      status.textContent = "Could not load the workplace list. You can still enter a workplace name manually.";
      status.className = "form-status is-warning";
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      status.className = "form-status";

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        const data = await fetchJson(reviewApiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        form.reset();
        if (params.get("slug")) {
          select.value = params.get("slug");
        }
        status.textContent = `Review submitted for ${data.submission.workplaceName}. It is now pending review.`;
        status.className = "form-status is-success";
      } catch (error) {
        status.textContent = error.message;
        status.className = "form-status is-error";
      }
    });
  };

  const renderAdminPage = async () => {
    const mount = document.querySelector("[data-admin-queue]");
    const status = document.querySelector("[data-admin-status]");
    const logoutButton = document.querySelector("[data-admin-logout]");
    if (!mount || !status) return;

    const loadQueue = async () => {
      status.textContent = "";
      status.className = "queue-status";

      try {
        const data = await fetchJson(`${adminReviewApiBase}?status=pending`);
        const submissions = data.submissions || [];

        if (!submissions.length) {
          mount.innerHTML = emptyStateMarkup("No pending reviews", "The queue is clear right now.");
          return;
        }

        mount.innerHTML = submissions
          .map(
            (submission) => `
              <article class="card admin-card" data-submission-id="${submission.id}">
                <div class="admin-card-head">
                  <div>
                    <p class="score-pill">Pending</p>
                    <h3>${escapeHtml(submission.reviewTitle)}</h3>
                    <p>${escapeHtml(submission.workplaceName)} | ${escapeHtml(submission.reviewerRole)} | ${escapeHtml(submission.reviewerLocation)}</p>
                  </div>
                  <div class="signal-row">
                    <span class="signal">${escapeHtml(submission.employmentType)}</span>
                    ${submission.salaryAmount ? `<span class="signal">${escapeHtml(String(submission.salaryAmount))} ${escapeHtml(submission.salaryPeriod || "")}</span>` : ""}
                  </div>
                </div>
                <div class="ratings-inline">
                  <span class="tag">Pay ${submission.payRating}/5</span>
                  <span class="tag">Management ${submission.managementRating}/5</span>
                  <span class="tag">Environment ${submission.environmentRating}/5</span>
                  <span class="tag">Growth ${submission.growthRating}/5</span>
                  <span class="tag">Reliability ${submission.reliabilityRating}/5</span>
                </div>
                <p class="admin-body">${escapeHtml(submission.reviewBody)}</p>
                <div class="cta-actions">
                  <button class="btn btn-primary" type="button" data-decision="approve" data-id="${submission.id}">Approve</button>
                  <button class="btn btn-soft" type="button" data-decision="reject" data-id="${submission.id}">Reject</button>
                </div>
              </article>
            `
          )
          .join("");
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        mount.innerHTML = emptyStateMarkup("Could not load moderation queue", "Start the backend server to use the review queue.");
      }
    };

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await fetchJson(adminLogoutApiBase, { method: "POST" });
        } catch (_error) {
        } finally {
          window.location.href = "admin-login.html";
        }
      });
    }

    mount.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-decision]");
      if (!button) return;

      const decision = button.getAttribute("data-decision");
      const id = button.getAttribute("data-id");
      button.disabled = true;
      status.textContent = "";
      status.className = "queue-status";

      try {
        await fetchJson(`${adminReviewApiBase}/${encodeURIComponent(id)}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision })
        });

        status.textContent =
          decision === "approve"
            ? "Review approved and applied to the workplace."
            : "Review rejected and removed from the pending queue.";
        status.className = "queue-status is-success";
        await loadQueue();
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        button.disabled = false;
        status.textContent = error.message;
        status.className = "queue-status is-error";
      }
    });

    await loadQueue();
  };

  const renderAdminLoginPage = () => {
    const form = document.querySelector("[data-admin-login-form]");
    const status = document.querySelector("[data-admin-login-status]");
    if (!form || !status) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      status.className = "form-status";

      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      try {
        await fetchJson(adminLoginApiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        status.textContent = "Login successful. Redirecting...";
        status.className = "form-status is-success";
        window.location.href = "admin.html";
      } catch (error) {
        status.textContent = error.message;
        status.className = "form-status is-error";
      }
    });
  };

  const renderAdminLedgerPage = async () => {
    const body = document.querySelector("[data-ledger-body]");
    const status = document.querySelector("[data-ledger-status]");
    const filter = document.querySelector("[data-ledger-filter]");
    const exportButton = document.querySelector("[data-export-ledger]");
    const logoutButton = document.querySelector("[data-admin-logout]");
    if (!body || !status || !filter || !exportButton) return;

    let currentRows = [];

    const loadLedger = async () => {
      status.textContent = "";
      status.className = "queue-status";

      try {
        const data = await fetchJson(`${adminReviewApiBase}?status=${encodeURIComponent(filter.value)}`);
        const submissions = data.submissions || [];
        currentRows = submissions;

        if (!submissions.length) {
          body.innerHTML = '<tr><td colspan="8" class="ledger-empty">No reviews match this filter.</td></tr>';
          return;
        }

        body.innerHTML = submissions
          .map(
            (submission) => `
              <tr>
                <td><span class="tag">${escapeHtml(submission.publicStatus)}</span></td>
                <td>${escapeHtml(submission.workplaceName)}</td>
                <td>${escapeHtml(submission.reviewerRole)}</td>
                <td>${escapeHtml(submission.reviewerLocation)}</td>
                <td>${submission.payRating}/${submission.managementRating}/${submission.environmentRating}/${submission.growthRating}/${submission.reliabilityRating}</td>
                <td class="ledger-title-cell">
                  <strong>${escapeHtml(submission.reviewTitle)}</strong>
                  <span>${escapeHtml(submission.reviewBody)}</span>
                </td>
                <td>${escapeHtml(submission.createdAt)}</td>
                <td>
                  <div class="ledger-actions">
                    ${submission.publicStatus === "published" ? `<button class="btn btn-soft" type="button" data-remove-review data-id="${submission.id}">Remove</button>` : ""}
                    ${submission.workplaceSlug ? `<a class="btn btn-soft" href="company.html?slug=${encodeURIComponent(submission.workplaceSlug)}">Open</a>` : ""}
                  </div>
                </td>
              </tr>
            `
          )
          .join("");
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        body.innerHTML = '<tr><td colspan="8" class="ledger-empty">Could not load the review ledger.</td></tr>';
      }
    };

    filter.addEventListener("change", loadLedger);

    exportButton.addEventListener("click", () => {
      const rows = [
        ["status", "workplace", "role", "location", "employment_type", "pay_rating", "management_rating", "environment_rating", "growth_rating", "reliability_rating", "salary_amount", "salary_period", "review_title", "review_body", "created_at"],
        ...currentRows.map((submission) => [
          submission.publicStatus,
          submission.workplaceName,
          submission.reviewerRole,
          submission.reviewerLocation,
          submission.employmentType,
          submission.payRating,
          submission.managementRating,
          submission.environmentRating,
          submission.growthRating,
          submission.reliabilityRating,
          submission.salaryAmount ?? "",
          submission.salaryPeriod ?? "",
          submission.reviewTitle,
          submission.reviewBody,
          submission.createdAt
        ])
      ];
      downloadCsv(rows, `novicehall-review-ledger-${filter.value}.csv`);
    });

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await fetchJson(adminLogoutApiBase, { method: "POST" });
        } catch (_error) {
        } finally {
          window.location.href = "admin-login.html";
        }
      });
    }

    body.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-remove-review]");
      if (!button) return;

      button.disabled = true;
      status.textContent = "";
      status.className = "queue-status";

      try {
        await fetchJson(`${adminReviewApiBase}/${encodeURIComponent(button.getAttribute("data-id"))}/remove`, {
          method: "POST"
        });
        status.textContent = "Published review removed from the public workplace page. The original submission remains in the ledger.";
        status.className = "queue-status is-success";
        await loadLedger();
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        button.disabled = false;
        status.textContent = error.message;
        status.className = "queue-status is-error";
      }
    });

    await loadLedger();
  };

  const renderAdminWorkplacesPage = async () => {
    const form = document.querySelector("[data-workplace-form]");
    const body = document.querySelector("[data-workplace-body]");
    const status = document.querySelector("[data-workplace-status]");
    const resetButton = document.querySelector("[data-workplace-reset]");
    const exportButton = document.querySelector("[data-workplace-export]");
    if (!form || !body || !status || !resetButton || !exportButton) return;

    let currentRows = [];

    const resetForm = () => {
      form.reset();
      form.elements.id.value = "";
      status.textContent = "";
      status.className = "form-status";
    };

    const loadWorkplaces = async () => {
      try {
        const data = await fetchJson(adminWorkplaceApiBase);
        const workplaces = data.workplaces || [];
        currentRows = workplaces;

        if (!workplaces.length) {
          body.innerHTML = '<tr><td colspan="7" class="ledger-empty">No workplaces yet.</td></tr>';
          return;
        }

        body.innerHTML = workplaces
          .map(
            (workplace) => `
              <tr>
                <td>${escapeHtml(workplace.name)}</td>
                <td>${escapeHtml(workplace.slug)}</td>
                <td>${escapeHtml(workplace.industry)}</td>
                <td>${escapeHtml(workplace.location)}</td>
                <td>${workplace.score} (${escapeHtml(workplace.band)})</td>
                <td>${workplace.verifiedReviews}</td>
                <td>
                  <div class="ledger-actions">
                    <button class="btn btn-soft" type="button" data-edit-workplace data-id="${workplace.id}">Edit</button>
                    <a class="btn btn-soft" href="company.html?slug=${encodeURIComponent(workplace.slug)}">Open</a>
                  </div>
                </td>
              </tr>
            `
          )
          .join("");
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        body.innerHTML = '<tr><td colspan="7" class="ledger-empty">Could not load workplaces.</td></tr>';
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.textContent = "";
      status.className = "form-status";

      const payload = Object.fromEntries(new FormData(form).entries());
      const id = payload.id;
      delete payload.id;

      try {
        await fetchJson(id ? `${adminWorkplaceApiBase}/${encodeURIComponent(id)}` : adminWorkplaceApiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        status.textContent = id ? "Workplace metadata updated." : "Workplace created.";
        status.className = "form-status is-success";
        resetForm();
        await loadWorkplaces();
      } catch (error) {
        if (error.message === "Unauthorized") {
          window.location.href = "admin-login.html";
          return;
        }
        status.textContent = error.message;
        status.className = "form-status is-error";
      }
    });

    body.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-workplace]");
      if (!button) return;
      const id = Number(button.getAttribute("data-id"));
      const workplace = currentRows.find((item) => item.id === id);
      if (!workplace) return;

      form.elements.id.value = workplace.id;
      form.elements.name.value = workplace.name;
      form.elements.slug.value = workplace.slug;
      form.elements.industry.value = workplace.industry;
      form.elements.location.value = workplace.location;
      form.elements.tagline.value = workplace.tagline;
      form.elements.summary.value = workplace.summary;
      status.textContent = `Editing ${workplace.name}.`;
      status.className = "form-status is-warning";
      window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
    });

    resetButton.addEventListener("click", resetForm);

    exportButton.addEventListener("click", () => {
      const rows = [
        ["id", "name", "slug", "industry", "location", "tagline", "summary", "score", "band", "verified_reviews", "salary_reports", "beginner_signal"],
        ...currentRows.map((workplace) => [
          workplace.id,
          workplace.name,
          workplace.slug,
          workplace.industry,
          workplace.location,
          workplace.tagline,
          workplace.summary,
          workplace.score,
          workplace.band,
          workplace.verifiedReviews,
          workplace.salaryReports,
          workplace.beginnerSignal
        ])
      ];
      downloadCsv(rows, "novicehall-workplaces.csv");
    });

    await loadWorkplaces();
  };

  if (path.endsWith("workplace-score.html")) renderHomeCards();
  if (path.endsWith("companies.html")) renderCompaniesPage();
  if (path.endsWith("company.html")) renderCompanyPage();
  if (path.endsWith("review-workplace.html")) renderReviewPage();
  if (path.endsWith("admin.html")) renderAdminPage();
  if (path.endsWith("admin-data.html")) renderAdminLedgerPage();
  if (path.endsWith("admin-workplaces.html")) renderAdminWorkplacesPage();
  if (path.endsWith("admin-login.html")) renderAdminLoginPage();
})();
