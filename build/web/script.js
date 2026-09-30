const nav = document.getElementById("nav");
const toast = document.getElementById("toast");
const searchOverlay = document.getElementById("searchOverlay");
const searchInput = document.getElementById("searchInput");
let cart = 0;

window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 45);
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i * 45, 250)}ms`;
  observer.observe(el);
});

document.getElementById("searchBtn").addEventListener("click", () => {
  searchOverlay.classList.add("open");
  setTimeout(() => searchInput.focus(), 250);
});

document.getElementById("closeSearch").addEventListener("click", () => {
  searchOverlay.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") searchOverlay.classList.remove("open");
});

document.querySelectorAll(".add").forEach((button) => {
  button.addEventListener("click", () => {
    cart++;
    document.getElementById("cartCount").textContent = cart;
    showToast(`${button.dataset.product} added to your bag`);
  });
});

// Delegated handler so dynamically rendered live products also update the bag
document.addEventListener("click", (e) => {
  const btn = e.target.closest ? e.target.closest(".add") : null;
  if (!btn || !btn.dataset.live) return;
  cart++;
  document.getElementById("cartCount").textContent = cart;
  showToast(`${btn.dataset.product} added to your bag`);
});

/* ============================================================
   LIVE BACKEND LAYER — UI -> JAX-RS -> Derby DB
   GET /Veloura/api/cosmetics (CosmeticResource.java -> DatabaseConnection.java)
   ============================================================ */
const API_URL = "/Veloura/api/cosmetics";
let liveProducts = [];
let liveFilter = "";

function escLive(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtPriceLive(n) {
  const v = Number(n);
  return isNaN(v) ? "—" : "₹" + v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function setApiStatusLive(online) {
  const el = document.getElementById("apiStatus");
  if (el) el.textContent = online ? "● live from database" : "○ api offline";
}

function loadLiveProducts() {
  const grid = document.getElementById("productGrid");
  const status = document.getElementById("productStatus");
  if (!grid) return;
  if (status) status.textContent = "Curating live creations from the Veloura API…";
  setApiStatusLive(false);

  fetch(API_URL, { headers: { Accept: "application/json" } })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data)) throw new Error((data && (data.error || data.message)) || "Unexpected API response");
      liveProducts = data;
      setApiStatusLive(true);
      renderLiveProducts();
    })
    .catch((err) => {
      liveProducts = [];
      setApiStatusLive(false);
      if (status) status.textContent = "Unable to connect to Veloura REST API (" + err.message + "). Start GlassFish + Derby, deploy /Veloura, then Refresh.";
      grid.innerHTML = `<article class="product"><div class="product-art"><span>OFFLINE</span></div><div class="product-meta"><div><h3>API unreachable</h3><p>GlassFish not running?</p></div></div><button class="add" id="retryBtn">Retry <b>↻</b></button></article>`;
      const rb = document.getElementById("retryBtn");
      if (rb) rb.addEventListener("click", loadLiveProducts);
    });
}

/* ============================================================
   PRODUCT IMAGE MAP (optional override)
   NEW WORKFLOW: just save web/images/{cosmeticId}.png (e.g. 107.png)
   and it auto-loads — no code change needed.
   Add an entry here ONLY if your filename is custom.
============================================================ */
const productImages = {
  101: "images/lipstick.png",        // Velvet Matte Lipstick
  102: "images/foundation.png",      // Fit Me Foundation
  103: "images/blush.png",           // Cheek Glow Blush
  104: "images/mascara.png",         // Lash Sensational Mascara
  105: "images/sunscreen.jpg",       // sunscreen (N°105)
  106: "images/sunscreen2.jpg",      // sunscreen (N°106)
};

function renderLiveProducts() {
  const grid = document.getElementById("productGrid");
  const status = document.getElementById("productStatus");
  if (!grid) return;
  const q = liveFilter.trim().toLowerCase();
  const rows = liveProducts.filter((p) => {
    if (!q) return true;
    return ((p.cosmeticName || "") + " " + (p.brand || "") + " " + (p.category || "")).toLowerCase().includes(q);
  }).slice(0, 6); // Featured = first 6 live rows

  if (!liveProducts.length) {
    if (status) status.textContent = "No creations yet — add one via POST /Veloura/api/cosmetics.";
    grid.innerHTML = `<article class="product"><div class="product-art"><span>EMPTY</span></div><div class="product-meta"><div><h3>The pedestals await</h3><p>Database table COSMETIC is empty</p></div></div></article>`;
    return;
  }
  if (!rows.length) {
    if (status) status.textContent = `No match for "${liveFilter}".`;
    grid.innerHTML = `<article class="product"><div class="product-art"><span>NO MATCH</span></div><div class="product-meta"><div><h3>Nothing found</h3><p>Try another search</p></div></div></article>`;
    return;
  }
  if (status) status.textContent = `Showing ${rows.length} of ${liveProducts.length} live creations from Derby VelouraDB.`;
  const art = ["p1", "p2", "p3"];
  const badge = ["BESTSELLER", "NEW", "ESSENTIAL"];
  grid.innerHTML = rows.map((p, i) => {
    const stock = Number(p.quantity) === 0 ? "OUT OF STOCK" : Number(p.quantity) <= 10 ? "LOW STOCK · " + p.quantity + " left" : badge[i % 3];
    // Auto: images/{id}.png unless overridden in productImages above.
    // <img onerror> removes itself if file missing -> gradient (p1/p2/p3) shows.
    const imgPath = productImages[Number(p.cosmeticId)] || ("images/" + p.cosmeticId + ".png");
    const artClass = ` ${art[i % 3]}`;
    return `<article class="product">` +
      `<div class="product-art${artClass}">` +
      `<img class="p-photo" src="${imgPath}" alt="" loading="lazy" onerror="this.remove()">` +
      `<span>${escLive(stock)}</span></div>` +
      `<div class="product-meta"><div><h3>${escLive(p.cosmeticName)}</h3><p>${escLive(p.brand)} · ${escLive(p.category)} · N° ${escLive(p.cosmeticId)} · Qty ${escLive(p.quantity)}</p></div><strong>${fmtPriceLive(p.price)}</strong></div>` +
      `<button class="add" data-live="1" data-product="${escLive(p.cosmeticName)}">Add to bag <b>+</b></button>` +
      `<div class="admin-row"><button data-action="view" data-id="${p.cosmeticId}">View</button><button data-action="edit" data-id="${p.cosmeticId}">Edit</button><button data-action="stock" data-id="${p.cosmeticId}">Stock</button><button class="del" data-action="del" data-id="${p.cosmeticId}">Delete</button></div>` +
      `</article>`;
  }).join("");
}

/* ---------- CRUD DEMO: POST / PUT / PATCH / DELETE ---------- */
let stockTargetId = null, deleteTargetId = null;
function openLive(id){ const el=document.getElementById(id); if(el) el.classList.add("open"); }
function closeLive(id){ const el=document.getElementById(id); if(el) el.classList.remove("open"); }
document.addEventListener("click",(e)=>{ const c=e.target.closest?e.target.closest("[data-close]"):null; if(c) closeLive(c.getAttribute("data-close")); });
document.addEventListener("keydown",(e)=>{ if(e.key==="Escape") document.querySelectorAll(".overlay.open").forEach(o=>o.classList.remove("open")); });
function liveToast(msg){ const box=document.getElementById("liveToasts"); if(!box){ showToast(msg); return; } const d=document.createElement("div"); d.className="lt"; d.textContent=msg; box.appendChild(d); setTimeout(()=>d.remove(),3800); }
function findLive(id){ return liveProducts.find(p=>String(p.cosmeticId)===String(id)); }

document.addEventListener("click",(e)=>{
  const b=e.target.closest?e.target.closest("[data-action]"):null; if(!b) return;
  const id=b.getAttribute("data-id"), p=findLive(id);
  if(b.getAttribute("data-action")==="view"){
    const grid=document.getElementById("detailGrid");
    if(p){ document.getElementById("viewTitle").textContent=p.cosmeticName; document.getElementById("viewSub").textContent=`GET /Veloura/api/cosmetics/${p.cosmeticId} · ${p.brand}`;
      grid.innerHTML=`<div class="detail-cell"><span>ID</span><b>${escLive(p.cosmeticId)}</b></div><div class="detail-cell"><span>Price</span><b>${fmtPriceLive(p.price)}</b></div><div class="detail-cell"><span>Brand</span><b>${escLive(p.brand)}</b></div><div class="detail-cell"><span>Category</span><b>${escLive(p.category)}</b></div><div class="detail-cell"><span>Quantity</span><b>${escLive(p.quantity)} units</b></div><div class="detail-cell"><span>Expiry</span><b>${escLive(p.expiryDate)}</b></div>`;
    } else { document.getElementById("viewTitle").textContent="N° "+id; grid.innerHTML="Not in current list — press Refresh."; }
    openLive("modalView");
  }
  if(b.getAttribute("data-action")==="edit"&&p){
    document.getElementById("e-id").value=p.cosmeticId; document.getElementById("e-id-show").value=p.cosmeticId;
    document.getElementById("e-name").value=p.cosmeticName||""; document.getElementById("e-category").value=p.category||"";
    document.getElementById("e-brand").value=p.brand||""; document.getElementById("e-price").value=p.price;
    document.getElementById("e-qty").value=p.quantity; document.getElementById("e-expiry").value=String(p.expiryDate||"").substring(0,10);
    document.getElementById("editSub").textContent=`PUT /Veloura/api/cosmetics/${p.cosmeticId}`; openLive("modalEdit");
  }
  if(b.getAttribute("data-action")==="stock"&&p){
    stockTargetId=p.cosmeticId; document.getElementById("stockInput").value=p.quantity;
    document.getElementById("stockSub").textContent=`PATCH /Veloura/api/cosmetics/${p.cosmeticId} {"quantity":N} · now ${p.quantity}`; openLive("modalStock");
  }
  if(b.getAttribute("data-action")==="del"){
    deleteTargetId=id; document.getElementById("deleteText").textContent=p?`Remove "${p.cosmeticName}" (N° ${p.cosmeticId})? It will disappear from the grid below.`:`Remove N° ${id}?`;
    openLive("modalDelete");
  }
});

const btnOpenAdd=document.getElementById("btnOpenAdd"); if(btnOpenAdd) btnOpenAdd.addEventListener("click",()=>openLive("modalAdd"));
const btnPostmanGet=document.getElementById("btnPostmanGet"); if(btnPostmanGet) btnPostmanGet.addEventListener("click",()=>{ const url=location.origin+API_URL; if(navigator.clipboard) navigator.clipboard.writeText(url); liveToast("Copied for Postman GET: "+url); });
const stockMinus=document.getElementById("stockMinus"); if(stockMinus) stockMinus.addEventListener("click",()=>{ const i=document.getElementById("stockInput"); i.value=Math.max(0,(parseInt(i.value,10)||0)-1); });
const stockPlus=document.getElementById("stockPlus"); if(stockPlus) stockPlus.addEventListener("click",()=>{ const i=document.getElementById("stockInput"); i.value=(parseInt(i.value,10)||0)+1; });

const addForm=document.getElementById("addForm");
if(addForm) addForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const payload='{"cosmeticId":'+parseInt(document.getElementById("f-id").value,10)+',"cosmeticName":'+JSON.stringify(document.getElementById("f-name").value.trim())+',"category":'+JSON.stringify(document.getElementById("f-category").value.trim())+',"brand":'+JSON.stringify(document.getElementById("f-brand").value.trim())+',"price":'+parseFloat(document.getElementById("f-price").value)+',"quantity":'+parseInt(document.getElementById("f-qty").value,10)+',"expiryDate":'+JSON.stringify(document.getElementById("f-expiry").value)+'}';
  fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:payload})
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json().catch(()=>({})); })
    .then(()=>{ closeLive("modalAdd"); addForm.reset(); liveToast("POST ok — new product appears below."); loadLiveProducts(); })
    .catch(err=>liveToast("POST failed: "+err.message));
});

const editForm=document.getElementById("editForm");
if(editForm) editForm.addEventListener("submit",(e)=>{
  e.preventDefault();
  const id=document.getElementById("e-id").value;
  const payload='{"cosmeticName":'+JSON.stringify(document.getElementById("e-name").value.trim())+',"category":'+JSON.stringify(document.getElementById("e-category").value.trim())+',"brand":'+JSON.stringify(document.getElementById("e-brand").value.trim())+',"price":'+parseFloat(document.getElementById("e-price").value)+',"quantity":'+parseInt(document.getElementById("e-qty").value,10)+',"expiryDate":'+JSON.stringify(document.getElementById("e-expiry").value)+'}';
  fetch(API_URL+"/"+encodeURIComponent(id),{method:"PUT",headers:{"Content-Type":"application/json"},body:payload})
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json().catch(()=>({})); })
    .then(()=>{ closeLive("modalEdit"); liveToast("PUT ok — N° "+id+" updated."); loadLiveProducts(); })
    .catch(err=>liveToast("PUT failed: "+err.message));
});

const btnSaveStock=document.getElementById("btnSaveStock");
if(btnSaveStock) btnSaveStock.addEventListener("click",()=>{
  const qty=parseInt(document.getElementById("stockInput").value,10);
  if(isNaN(qty)||qty<0){ liveToast("Quantity must be ≥ 0"); return; }
  fetch(API_URL+"/"+encodeURIComponent(stockTargetId),{method:"PATCH",headers:{"Content-Type":"application/json"},body:'{"quantity":'+qty+'}'})
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json().catch(()=>({})); })
    .then(()=>{ closeLive("modalStock"); liveToast("PATCH ok — N° "+stockTargetId+" stock = "+qty+". See updated qty below."); loadLiveProducts(); })
    .catch(err=>liveToast("PATCH failed: "+err.message));
});

const btnConfirmDelete=document.getElementById("btnConfirmDelete");
if(btnConfirmDelete) btnConfirmDelete.addEventListener("click",()=>{
  fetch(API_URL+"/"+encodeURIComponent(deleteTargetId),{method:"DELETE"})
    .then(r=>{ if(!r.ok) throw new Error("HTTP "+r.status); return r.json().catch(()=>({})); })
    .then(()=>{ closeLive("modalDelete"); liveToast("DELETE ok — N° "+deleteTargetId+" disappears below."); loadLiveProducts(); })
    .catch(err=>liveToast("DELETE failed: "+err.message));
});

// search overlay doubles as live filter
if (searchInput) {
  searchInput.addEventListener("input", () => {
    liveFilter = searchInput.value;
    if (liveProducts.length) renderLiveProducts();
  });
}

const refreshLink = document.getElementById("refreshLink");
if (refreshLink) refreshLink.addEventListener("click", (e) => { e.preventDefault(); loadLiveProducts(); });

loadLiveProducts();

document.getElementById("newsletter").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = e.currentTarget.querySelector("input").value;
  if (email) {
    showToast("Welcome to the Veloura Circle.");
    e.currentTarget.reset();
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
