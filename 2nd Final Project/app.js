/* ==============================
   CONFIG + GLOBAL STATE
============================== */

const API_BASE = "https://makeup-api.herokuapp.com/api/v1/products.json";

// simple local auth (NO Firebase needed)
let favorites = [];
let currentPage = "home";
let currentUser = null;


/* ==============================
   THEME
============================== */

function toggleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById("themeIcon");

  if (html.getAttribute("data-theme") === "dark") {
    html.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
    if (icon) icon.className = "bi bi-moon-fill";
  } else {
    html.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
    if (icon) icon.className = "bi bi-sun-fill";
  }
}

function loadTheme() {
  const saved = localStorage.getItem("theme") || "light";
  const icon = document.getElementById("themeIcon");
  document.documentElement.setAttribute("data-theme", saved);
  if (icon) icon.className = saved === "dark" ? "bi bi-sun-fill" : "bi bi-moon-fill";
}


/* ==============================
   LOCAL AUTH (USERS + SESSION)
============================== */

function loadUsers() {
  const raw = localStorage.getItem("bb_users");
  return raw ? JSON.parse(raw) : {};
}

function saveUsers(users) {
  localStorage.setItem("bb_users", JSON.stringify(users));
}

function setCurrentUser(email) {
  currentUser = { email };
  localStorage.setItem("bb_current_user", email);
  updateAuthHeader(currentUser);
}

function clearCurrentUser() {
  currentUser = null;
  localStorage.removeItem("bb_current_user");
  updateAuthHeader(null);
}

function restoreSession() {
  const email = localStorage.getItem("bb_current_user");
  if (email) {
    const users = loadUsers();
    const user = users[email];
    if (user) {
      currentUser = { email };
      favorites = Array.isArray(user.favorites) ? user.favorites : [];
      updateAuthHeader(currentUser);
      updateFavoritesBadge();
      return;
    }
  }
  currentUser = null;
  updateAuthHeader(null);
  loadFavoritesLocal();
}

function saveFavoritesForCurrentUser() {
  if (!currentUser) return;
  const users = loadUsers();
  const email = currentUser.email;
  const existing = users[email] || { password: "", favorites: [] };
  existing.favorites = favorites;
  users[email] = existing;
  saveUsers(users);
}


/* ==============================
   FAVORITES (LOCAL + PER USER)
============================== */

function updateFavoritesBadge() {
  const badge = document.getElementById("favBadge");
  if (!badge) return;
  if (favorites.length > 0) {
    badge.textContent = favorites.length;
    badge.classList.remove("d-none");
  } else {
    badge.classList.add("d-none");
  }
}

function loadFavoritesLocal() {
  const saved = localStorage.getItem("favorites_anon");
  favorites = saved ? JSON.parse(saved) : [];
  updateFavoritesBadge();
}

function saveFavoritesLocal() {
  localStorage.setItem("favorites_anon", JSON.stringify(favorites));
  updateFavoritesBadge();
}

function isFavorite(id) {
  return favorites.includes(id);
}

function toggleFavorite(id) {
  const idx = favorites.indexOf(id);
  if (idx > -1) favorites.splice(idx, 1);
  else favorites.push(id);

  if (currentUser) saveFavoritesForCurrentUser();
  else saveFavoritesLocal();

  document
    .querySelectorAll(`[data-product-id="${id}"]`)
    .forEach(btn => btn.classList.toggle("active", isFavorite(id)));

  if (currentPage === "favorites") loadPage("favorites");
}


/* ==============================
   PRODUCTS (CARDS + MODAL)
============================== */

function formatPrice(price) {
  return price ? `$${parseFloat(price).toFixed(2)}` : "Price N/A";
}

function createProductCard(product) {
  const imageUrl = product.image_link || "https://via.placeholder.com/200?text=No+Image";
  const brand = product.brand || "Unknown Brand";
  const name = product.name || "Unnamed Product";
  const price = formatPrice(product.price);
  const type = product.product_type ? product.product_type.replace("_", " ") : "Product";
  const fav = isFavorite(product.id);

  return `
    <div class="col">
      <div class="card">
        <button class="favorite-btn ${fav ? "active" : ""}"
                data-product-id="${product.id}"
                onclick="toggleFavorite(${product.id})">
          <i class="bi bi-heart-fill"></i>
        </button>
        <img src="${imageUrl}" class="card-img-top"
             alt="${name}"
             onclick="showProductDetail(${product.id})"
             onerror="this.src='https://via.placeholder.com/200?text=No+Image'">
        <div class="card-body">
          <p class="product-brand mb-1">${brand}</p>
          <h6 class="card-title" style="cursor:pointer"
              onclick="showProductDetail(${product.id})">
            ${name}
          </h6>
          <p class="text-muted small mb-2">${type}</p>
          <p class="price-tag mb-0">${price}</p>
        </div>
      </div>
    </div>
  `;
}

async function showProductDetail(productId) {
  const modalEl = document.getElementById("productModal");
  const modalBody = document.getElementById("modalBody");
  const modal = new bootstrap.Modal(modalEl);

  modalBody.innerHTML = `
    <div class="text-center my-4">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    </div>
  `;
  modal.show();

  try {
    const response = await fetch(
      `https://makeup-api.herokuapp.com/api/v1/products/${productId}.json`
    );
    const product = await response.json();

    const colors = product.product_colors || [];
    const tags = product.tag_list || [];
    const description = product.description || "No description available.";
    const fav = isFavorite(product.id);

    document.getElementById("modalProductName").textContent =
      product.name || "Product Details";

    modalBody.innerHTML = `
      <div class="row">
        <div class="col-md-5">
          <img src="${product.image_link || "https://via.placeholder.com/400?text=No+Image"}"
               class="img-fluid product-detail-img"
               alt="${product.name || ""}"
               onerror="this.src='https://via.placeholder.com/400?text=No+Image'">
        </div>
        <div class="col-md-7">
          <p class="product-brand mb-2" style="font-size:1rem;">
            ${product.brand || "Unknown Brand"}
          </p>
          <h4 class="mb-3">${product.name || "Unnamed Product"}</h4>
          <h3 class="price-tag mb-4">${formatPrice(product.price)}</h3>

          <div class="mb-3">
            <strong>Type:</strong>
            <span class="badge bg-secondary">
              ${product.product_type ? product.product_type.replace("_", " ") : "N/A"}
            </span>
          </div>

          ${
            product.category
              ? `<div class="mb-3"><strong>Category:</strong> ${product.category}</div>`
              : ""
          }

          ${
            tags.length
              ? `
            <div class="mb-3">
              <strong>Tags:</strong><br>
              ${tags
                .map(tag => `<span class="badge bg-info tag-badge">${tag}</span>`)
                .join("")}
            </div>
          `
              : ""
          }

          ${
            colors.length
              ? `
            <div class="mb-3">
              <strong>Available Colors:</strong> (${colors.length})<br>
              ${colors
                .slice(0, 12)
                .map(
                  color => `
                  <span class="color-swatch"
                        style="background-color:${color.hex_value};"
                        title="${color.colour_name || "Color"}"></span>
                `
                )
                .join("")}
              ${
                colors.length > 12
                  ? `<span class="text-muted small">+${colors.length - 12} more</span>`
                  : ""
              }
            </div>
          `
              : ""
          }

          ${
            product.rating
              ? `
            <div class="mb-3">
              <strong>Rating:</strong>
              ${"⭐".repeat(Math.round(product.rating))} (${product.rating})
            </div>
          `
              : ""
          }

          <div class="mb-3">
            <strong>Description:</strong>
            <p class="mt-2">${description}</p>
          </div>

          ${
            product.product_link
              ? `
            <a href="${product.product_link}" target="_blank" class="btn btn-primary">
              <i class="bi bi-box-arrow-up-right me-2"></i>View on Website
            </a>
          `
              : ""
          }

          <button class="btn ${fav ? "btn-danger" : "btn-outline-danger"} ms-2"
                  onclick="toggleFavorite(${product.id}); showProductDetail(${product.id});">
            <i class="bi bi-heart-fill me-2"></i>
            ${fav ? "Remove from Favorites" : "Add to Favorites"}
          </button>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Error:", error);
    modalBody.innerHTML = `
      <div class="alert alert-danger">
        Failed to load product details. Please try again.
      </div>
    `;
  }
}


/* ==============================
   PAGE NAVIGATION
============================== */

function loadPage(page) {
  currentPage = page;
  const content = document.getElementById("pageContent");

  document
    .querySelectorAll(".nav-link")
    .forEach(link => link.classList.remove("active"));

  if (page === "home") {
    document.querySelectorAll(".nav-link")[0].classList.add("active");

    content.innerHTML = `
      <header class="hero-section text-center py-5">
        <div class="container">
          <h1 class="display-4 mb-3">Discover Your Perfect Products</h1>
          <p class="lead mb-4">Explore thousands of beauty products from top brands</p>
          <button onclick="loadPage('search')" class="btn btn-primary btn-lg">
            Start Browsing
          </button>
        </div>
      </header>
      <div class="container my-5">
        <div class="row mb-4">
          <div class="col">
            <h2 class="section-title">Featured Products</h2>
            <p class="text-muted">A curated selection of popular items</p>
          </div>
        </div>
        <div id="loading" class="text-center my-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3 text-muted">Loading products...</p>
        </div>
        <div id="error" class="alert alert-danger d-none"></div>
        <div id="productGrid"
             class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4"></div>
      </div>
    `;
    loadFeaturedProducts();
  } else if (page === "search") {
    document.querySelectorAll(".nav-link")[1].classList.add("active");

    content.innerHTML = `
      <div class="search-section">
        <div class="container">
          <h1 class="text-center mb-4">Browse Products</h1>
          <div class="row g-3">
            <div class="col-md-5">
              <label class="filter-label">Brand</label>
              <select id="brandSelect" class="form-select">
                <option value="">All Brands</option>
                <option value="maybelline">Maybelline</option>
                <option value="covergirl">CoverGirl</option>
                <option value="nyx">NYX</option>
                <option value="revlon">Revlon</option>
                <option value="l'oreal">L'Oreal</option>
                <option value="essence">Essence</option>
                <option value="wet n wild">Wet n Wild</option>
                <option value="milani">Milani</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="filter-label">Product Type</label>
              <select id="typeSelect" class="form-select">
                <option value="">All Types</option>
                <option value="lipstick">Lipstick</option>
                <option value="lip_liner">Lip Liner</option>
                <option value="foundation">Foundation</option>
                <option value="eyeliner">Eyeliner</option>
                <option value="eyeshadow">Eyeshadow</option>
                <option value="mascara">Mascara</option>
                <option value="blush">Blush</option>
                <option value="bronzer">Bronzer</option>
                <option value="nail_polish">Nail Polish</option>
              </select>
            </div>
            <div class="col-md-2 d-flex align-items-end">
              <button class="btn btn-primary w-100" onclick="searchProducts()">
                <i class="bi bi-search me-2"></i>Search
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="container my-5">
        <div id="loading" class="text-center my-5 d-none">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3 text-muted">Searching products...</p>
        </div>
        <div id="error" class="alert alert-danger d-none"></div>
        <div id="resultsInfo" class="mb-3 d-none">
          <p class="text-muted"><span id="resultCount">0</span> products found</p>
        </div>
        <div id="productGrid"
             class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4"></div>
      </div>
    `;
  } else if (page === "favorites") {
    document.querySelectorAll(".nav-link")[2].classList.add("active");

    content.innerHTML = `
      <div class="container my-5">
        <div class="row mb-4">
          <div class="col">
            <h2 class="section-title">My Favorites</h2>
            <p class="text-muted">Your personalized shopping list</p>
          </div>
        </div>
        <div id="loading" class="text-center my-5">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-3 text-muted">Loading favorites...</p>
        </div>
        <div id="error" class="alert alert-danger d-none"></div>
        <div id="emptyMessage" class="text-center my-5 d-none">
          <i class="bi bi-heart" style="font-size:4rem; color:var(--text-muted);"></i>
          <h3 class="mt-3">No favorites yet</h3>
          <p class="text-muted">Start adding products to your shopping list!</p>
          <button onclick="loadPage('search')" class="btn btn-primary">
            Browse Products
          </button>
        </div>
        <div id="productGrid"
             class="row row-cols-1 row-cols-md-3 row-cols-lg-4 g-4"></div>
      </div>
    `;
    loadFavoritesPage();
  }
}


/* ==============================
   DATA LOADING
============================== */

function loadFeaturedProducts() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const grid = document.getElementById("productGrid");

  fetch(`${API_BASE}?brand=maybelline`)
    .then(res => res.json())
    .then(data => {
      loading.classList.add("d-none");

      if (!data || data.length === 0) {
        error.textContent = "No products found.";
        error.classList.remove("d-none");
        return;
      }

      const filtered = data.filter(p => {
        const hasImage = p.image_link && p.image_link.trim() !== "";
        const hasPrice = p.price && p.price !== "0.0" && p.price !== 0;
        return hasImage && hasPrice;
      });

      const products = filtered.slice(0, 12);
      if (!products.length) {
        error.textContent = "No products found.";
        error.classList.remove("d-none");
        return;
      }

      grid.innerHTML = products.map(createProductCard).join("");
    })
    .catch(err => {
      console.error("Error:", err);
      loading.classList.add("d-none");
      error.textContent = "Failed to load products. Please try again later.";
      error.classList.remove("d-none");
    });
}

function searchProducts() {
  const brand = document.getElementById("brandSelect").value;
  const type = document.getElementById("typeSelect").value;
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const grid = document.getElementById("productGrid");
  const resultsInfo = document.getElementById("resultsInfo");
  const resultCount = document.getElementById("resultCount");

  let url = API_BASE;
  const params = [];
  if (brand) params.push(`brand=${encodeURIComponent(brand)}`);
  if (type) params.push(`product_type=${encodeURIComponent(type)}`);
  if (params.length > 0) url += "?" + params.join("&");

  loading.classList.remove("d-none");
  error.classList.add("d-none");
  resultsInfo.classList.add("d-none");
  grid.innerHTML = "";

  fetch(url)
    .then(res => res.json())
    .then(data => {
      loading.classList.add("d-none");

      if (!data || data.length === 0) {
        error.textContent =
          "No products found matching your criteria. Try different filters.";
        error.classList.remove("d-none");
        return;
      }

      const filtered = data.filter(p => {
        const hasImage = p.image_link && p.image_link.trim() !== "";
        const hasPrice = p.price && p.price !== "0.0" && p.price !== 0;
        return hasImage && hasPrice;
      });

      if (!filtered.length) {
        error.textContent =
          "No products found matching your criteria. Try different filters.";
        error.classList.remove("d-none");
        return;
      }

      resultCount.textContent = filtered.length;
      resultsInfo.classList.remove("d-none");
      grid.innerHTML = filtered.map(createProductCard).join("");
    })
    .catch(err => {
      console.error("Error:", err);
      loading.classList.add("d-none");
      error.textContent = "Failed to load products. Please try again later.";
      error.classList.remove("d-none");
    });
}

async function loadFavoritesPage() {
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const grid = document.getElementById("productGrid");
  const emptyMessage = document.getElementById("emptyMessage");

  if (!favorites.length) {
    loading.classList.add("d-none");
    emptyMessage.classList.remove("d-none");
    return;
  }

  try {
    const products = await Promise.all(
      favorites.map(id =>
        fetch(`https://makeup-api.herokuapp.com/api/v1/products/${id}.json`)
          .then(r => r.json())
          .catch(() => null)
      )
    );

    loading.classList.add("d-none");
    const valid = products.filter(p => p !== null);

    if (!valid.length) {
      emptyMessage.classList.remove("d-none");
      return;
    }

    grid.innerHTML = valid.map(createProductCard).join("");
  } catch (err) {
    console.error("Error:", err);
    loading.classList.add("d-none");
    error.textContent = "Failed to load favorites. Please try again later.";
    error.classList.remove("d-none");
  }
}


/* ==============================
   AUTH UI
============================== */

function setupAuthUI() {
  const checkbox = document.getElementById("isRegister");
  const title = document.getElementById("authModalTitle");
  const btn = document.getElementById("authSubmitBtn");
  const form = document.getElementById("authForm");

  if (checkbox && title && btn) {
    checkbox.addEventListener("change", () => {
      const isRegister = checkbox.checked;
      title.textContent = isRegister ? "Register" : "Sign In";
      btn.textContent = isRegister ? "Register" : "Sign In";
    });
  }

  if (form) {
    form.addEventListener("submit", handleAuthSubmit);
  }
}

function updateAuthHeader(user) {
  const label = document.getElementById("authUserLabel");
  const signOutBtn = document.getElementById("signOutBtn");
  if (!label || !signOutBtn) return;

  if (user) {
    label.textContent = (user.email || "").split("@")[0];
    signOutBtn.classList.remove("d-none");
  } else {
    label.textContent = "Sign in";
    signOutBtn.classList.add("d-none");
  }
}

function handleAuthSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const isRegister = document.getElementById("isRegister").checked;
  const errorBox = document.getElementById("authError");
  const modalEl = document.getElementById("authModal");
  const modal = bootstrap.Modal.getInstance(modalEl);

  errorBox.classList.add("d-none");
  errorBox.textContent = "";

  if (!email || !password) {
    errorBox.textContent = "Please enter email and password.";
    errorBox.classList.remove("d-none");
    return;
  }

  const users = loadUsers();

  if (isRegister) {
    if (users[email]) {
      errorBox.textContent = "An account with this email already exists.";
      errorBox.classList.remove("d-none");
      return;
    }
    users[email] = { password, favorites: [] };
    saveUsers(users);
    favorites = [];
    setCurrentUser(email);
  } else {
    const user = users[email];
    if (!user || user.password !== password) {
      errorBox.textContent = "Invalid email or password.";
      errorBox.classList.remove("d-none");
      return;
    }
    favorites = Array.isArray(user.favorites) ? user.favorites : [];
    setCurrentUser(email);
  }

  updateFavoritesBadge();
  if (currentPage === "favorites") loadPage("favorites");

  if (modal) modal.hide();
  document.getElementById("authForm").reset();
  document.getElementById("isRegister").checked = false;
  document.getElementById("authModalTitle").textContent = "Sign In";
  document.getElementById("authSubmitBtn").textContent = "Sign In";
}

function handleSignOut() {
  clearCurrentUser();
  loadFavoritesLocal();
  if (currentPage === "favorites") loadPage("favorites");
}


/* ==============================
   INIT
============================== */

function initPage() {
  loadTheme();
  setupAuthUI();
  restoreSession();
  loadPage("home");
}
