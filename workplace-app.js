(function () {
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const apiBase = "/api/workplaces";

  const cardMarkup = (workplace) => `
    <article class="card company-card">
      <div class="company-head">
        <div>
          <h3>${workplace.name}</h3>
          <p>${workplace.tagline}</p>
        </div>
        <div class="company-score" aria-label="Workplace score ${workplace.score} out of 100">
          <strong>${workplace.score}</strong>
          <span>${workplace.band}</span>
        </div>
      </div>
      <div class="signal-row">
        <span class="signal">${workplace.verifiedReviews} verified reviews</span>
        <span class="signal">${workplace.salaryReports} salary reports</span>
        <span class="signal">${workplace.beginnerSignal}</span>
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

  const fetchJson = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
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
        mount.innerHTML = emptyStateMarkup(
          "No workplaces yet",
          "Company cards will appear here once workplace data starts coming in."
        );
        return;
      }

      mount.innerHTML = workplaces.slice(0, 3).map(cardMarkup).join("");
    } catch (_error) {
      mount.innerHTML = emptyStateMarkup(
        "Workplaces are loading soon",
        "The shared workplace cards will appear here once the API is running."
      );
    }
  };

  const renderCompaniesPage = async () => {
    const mount = document.querySelector("[data-companies-grid]");
    if (!mount) return;

    try {
      const data = await fetchJson(apiBase);
      const workplaces = data.workplaces || [];

      if (!workplaces.length) {
        mount.innerHTML = emptyStateMarkup(
          "No workplaces yet",
          "Company cards will appear here once data starts coming in."
        );
        return;
      }

      mount.innerHTML = workplaces.map(cardMarkup).join("");
    } catch (_error) {
      mount.innerHTML = emptyStateMarkup(
        "Could not load workplaces",
        "Start the backend server to turn this list into a live company feed."
      );
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
              <p class="eyebrow">${workplace.industry} | ${workplace.location}</p>
              <h1>${workplace.name}</h1>
              <p class="hero-copy">${workplace.summary}</p>
              <div class="hero-actions">
                <a class="btn btn-primary" href="companies.html">Browse more workplaces</a>
                <a class="btn btn-soft" href="workplace-score.html#trust">How trust works</a>
              </div>
            </div>
            <aside class="search-preview">
              <p class="mini-caption">Current workplace signal</p>
              <div class="company-score company-score-large" aria-label="Workplace score ${workplace.score} out of 100">
                <strong>${workplace.score}</strong>
                <span>${workplace.band}</span>
              </div>
              <div class="tag-row">
                <span class="tag">${workplace.verifiedReviews} verified reviews</span>
                <span class="tag">${workplace.salaryReports} salary reports</span>
                <span class="tag">${workplace.beginnerSignal}</span>
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
                    <h3>${category.label}</h3>
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
                    <h3>${review.title}</h3>
                    <p>${review.snippet}</p>
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

  if (path.endsWith("workplace-score.html")) renderHomeCards();
  if (path.endsWith("companies.html")) renderCompaniesPage();
  if (path.endsWith("company.html")) renderCompanyPage();
})();
