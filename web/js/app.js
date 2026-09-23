/* ============================================================
   VELOURA — frontend client for the EXISTING JAX-RS API.
   Backend is read-only from here. Base URL:
   /Veloura/api/cosmetics
   Field ORDER is significant (backend parses positionally):
   POST: cosmeticId, cosmeticName, category, brand, price,
         quantity, expiryDate
   PUT:  cosmeticName, category, brand, price, quantity,
         expiryDate (id in URL path)
   PATCH: {"quantity": N} only
   ============================================================ */
'use strict';

var API_URL = '/Veloura/api/cosmetics';

/* ---------- state ---------- */
var allCosmetics = [];
var filters = { search: '', category: 'all', stock: 'all', sort: 'id-asc' };
var pendingDeleteId = null;
var stockTargetId = null;

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initials(name) {
  var p = String(name || '?').trim().split(/\s+/);
  return ((p[0] ? p[0].charAt(0) : '?') + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
}

function fmtPrice(n) {
  var v = Number(n);
  return isNaN(v) ? '—' : '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  var dt = new Date(d);
  return isNaN(dt.getTime()) ? esc(d)
    : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysToExpiry(d) {
  if (!d) return null;
  var dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return null;
  var now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((dt - now) / 86400000);
}

function stockStatus(qty) {
  var q = Number(qty);
  if (q === 0) return { key: 'out', label: 'OUT OF STOCK' };
  if (q <= 10) return { key: 'low', label: 'LOW STOCK' };
  return { key: 'in', label: 'IN STOCK' };
}

function expiryStatus(d) {
  var days = daysToExpiry(d);
  if (days === null) return { key: 'neutral', label: '—' };
  if (days < 0) return { key: 'exp', label: 'Expired' };
  if (days <= 90) return { key: 'soon', label: days === 0 ? 'Expiring today' : 'Expiring in ' + days + 'd' };
  return { key: 'ok', label: 'Valid' };
}

function findById(id) {
  for (var i = 0; i < allCosmetics.length; i++) {
    if (String(allCosmetics[i].cosmeticId) === String(id)) return allCosmetics[i];
  }
  return null;
}

/* ---------- product photos: YOUR images first, CSS fallback behind ----------
   Save per-product PNGs as:  web/images/products/{cosmeticId}.png  (e.g. 101.png)
   Optional generics: web/images/p1.png, p2.png, p3.png (used as 2nd try) */
function pgVariant(p) {
  var id = Math.abs(Number(p && p.cosmeticId) || 0);
  return id % 4;
}

function photoImgHTML(p) {
  var id = esc(p && p.cosmeticId);
  var v = pgVariant(p);
  return '<div class="pg-art v' + v + '"><div class="pg-mini"></div>' +
    '<span class="pg-mono">' + esc(initials(p && p.cosmeticName)) + '</span></div>' +
    '<img class="p-photo" src="images/products/' + id + '.png" ' +
    'data-v="' + v + '" alt="" loading="lazy" ' +
    'onerror="this.onerror=null;this.src=\'images/p\' + ((Number(this.getAttribute(\'data-v\')) % 3) + 1) + \'.png\';' +
    'this.onerror=function(){this.remove();};">';
}

/* ---------- toasts ---------- */
function toast(type, title, msg) {
  var box = $('toasts');
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'info');
  var icon = type === 'success' ? '✓' : type === 'error' ? '!' : '✦';
  el.innerHTML = '<div><b>' + esc(title) + '</b><span>' + esc(msg) + '</span></div>' +
    '<button aria-label="Dismiss">&times;</button>';
  el.querySelector('button').onclick = function () { dismiss(); };
  box.appendChild(el);
  var t = setTimeout(dismiss, 4200);
  function dismiss() {
    clearTimeout(t);
    el.classList.add('out');
    setTimeout(function () { el.remove(); }, 320);
  }
}

/* ---------- modals ---------- */
function openModal(id) { $(id).classList.add('open'); }
function closeModal(id) { $(id).classList.remove('open'); }

/* ---------- API ---------- */
function loadCosmetics() {
  setCollectionState('loading');
  setShowcaseState('loading');
  setStatsLoading();
  setApiStatus(false);
  var rb = $('btnRefresh'); if (rb) rb.disabled = true;

  return fetch(API_URL, { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      if (!Array.isArray(data)) {
        throw new Error((data && (data.error || data.message)) || 'Unexpected API response');
      }
      allCosmetics = data;
      setApiStatus(true);
      hideApiError();
      buildCategoryOptions();
      updateStats();
      renderShowcase();
      renderCollection();
      renderHeroChip();
    })
    .catch(function (err) {
      allCosmetics = [];
      setApiStatus(false);
      showApiError(err);
      setCollectionState('error');
      setShowcaseState('error');
      setStatsEmpty();
      renderHeroChip();
    })
    .then(function () { if (rb) rb.disabled = false; });
}

/* ---------- renders (all from live GET data) ---------- */
function filteredCosmetics() {
  var q = filters.search.toLowerCase();
  var out = [];
  for (var i = 0; i < allCosmetics.length; i++) {
    var p = allCosmetics[i];
    var hay = ((p.cosmeticName || '') + ' ' + (p.brand || '') + ' ' + (p.category || '') + ' ' + (p.cosmeticId || '')).toLowerCase();
    if (q && hay.indexOf(q) === -1) continue;
    if (filters.category !== 'all' && String(p.category) !== filters.category) continue;
    var st = stockStatus(p.quantity).key;
    if (filters.stock === 'in' && st !== 'in') continue;
    if (filters.stock === 'low' && st !== 'low') continue;
    if (filters.stock === 'out' && st !== 'out') continue;
    out.push(p);
  }
  out.sort(sortFn(filters.sort));
  return out;
}

function sortFn(mode) {
  switch (mode) {
    case 'name-asc': return function (a, b) { return String(a.cosmeticName || '').localeCompare(String(b.cosmeticName || '')); };
    case 'price-asc': return function (a, b) { return Number(a.price) - Number(b.price); };
    case 'price-desc': return function (a, b) { return Number(b.price) - Number(a.price); };
    case 'stock-asc': return function (a, b) { return Number(a.quantity) - Number(b.quantity); };
    case 'exp-asc': return function (a, b) { return String(a.expiryDate || '').localeCompare(String(b.expiryDate || '')); };
    default: return function (a, b) { return Number(a.cosmeticId) - Number(b.cosmeticId); };
  }
}

function renderShowcase() {
  var grid = $('showGrid');
  if (!allCosmetics.length) { setShowcaseState('empty'); return; }
  var list = allCosmetics.slice(0, 3);
  var shapes = ['s1', 's2', 's3'];
  var html = '';
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    var st = stockStatus(p.quantity);
    html += '<article class="show-card ' + shapes[i % 3] + '">' +
      '<div class="show-visual">' + photoImgHTML(p) +
      '<span class="show-cat">' + esc((p.category || 'VELOURA').toUpperCase()) + '</span>' +
      '<span class="show-glow"></span></div>' +
      '<div class="show-body">' +
      '<div class="show-brand">' + esc(p.brand) + '</div>' +
      '<h4>' + esc(p.cosmeticName) + '</h4>' +
      '<div class="show-meta"><span class="show-price">' + fmtPrice(p.price) + '</span>' +
      '<span class="show-units">' + esc(p.quantity) + ' units · ' + st.label + '</span></div>' +
      '<button class="glass-btn" onclick="viewCosmetic(' + p.cosmeticId + ')">Details</button>' +
      '</div></article>';
  }
  grid.innerHTML = html;
  grid.style.display = '';
  $('showEmpty').style.display = 'none';
}

function renderCollection() {
  var rows = filteredCosmetics();
  $('resultCount').textContent = 'Showing ' + rows.length + ' of ' + allCosmetics.length + ' creations';
  if (!rows.length) { setCollectionState('empty'); return; }

  var html = '';
  for (var i = 0; i < rows.length; i++) {
    var p = rows[i];
    var st = stockStatus(p.quantity);
    var ex = expiryStatus(p.expiryDate);
    html += '<article class="coll-card">' +
      '<div class="coll-visual">' + photoImgHTML(p) +
      '<span class="coll-id">N° ' + esc(p.cosmeticId) + '</span>' +
      '<span class="coll-status"><span class="pill ' + st.key + '">' + st.label + '</span></span></div>' +
      '<div class="coll-body">' +
      '<div class="coll-brand">' + esc(p.brand) + '</div>' +
      '<h4>' + esc(p.cosmeticName) + '</h4>' +
      '<div class="kv-mini"><span>Category</span><b>' + esc(p.category) + '</b></div>' +
      '<div class="kv-mini"><span>Price</span><b>' + fmtPrice(p.price) + '</b></div>' +
      '<div class="kv-mini"><span>Quantity</span><b>' + esc(p.quantity) + ' units</b></div>' +
      '<div class="kv-mini"><span>Expiry</span><b>' + fmtDate(p.expiryDate) + '</b></div>' +
      '<div class="coll-pills"><span class="pill ' + ex.key + '">' + esc(ex.label) + '</span></div>' +
      '<div class="coll-actions">' +
      '<button class="mini-btn" onclick="viewCosmetic(' + p.cosmeticId + ')">View</button>' +
      '<button class="mini-btn" onclick="openEdit(' + p.cosmeticId + ')">Edit</button>' +
      '<button class="mini-btn" onclick="openStock(' + p.cosmeticId + ')">Stock</button>' +
      '<button class="mini-btn danger" onclick="openDelete(' + p.cosmeticId + ')">Delete</button>' +
      '</div></div></article>';
  }
  $('collGrid').innerHTML = html;
  $('collGrid').style.display = '';
  $('collEmpty').style.display = 'none';
}

function updateStats() {
  var total = allCosmetics.length;
  var units = 0, low = 0, out = 0, expiring = 0;
  for (var i = 0; i < allCosmetics.length; i++) {
    var p = allCosmetics[i];
    var q = Number(p.quantity) || 0;
    units += q;
    if (q === 0) out++;
    else if (q <= 10) low++;
    var d = daysToExpiry(p.expiryDate);
    if (d !== null && d >= 0 && d <= 90) expiring++;
  }
  $('statTotal').textContent = total;
  $('statUnits').textContent = units.toLocaleString('en-IN');
  $('statLow').textContent = low + out;
  $('statExp').textContent = expiring;
  $('statLowSub').textContent = low + ' low · ' + out + ' out';
}

function renderHeroChip() {
  var el = $('heroChipBody');
  if (!allCosmetics.length) {
    return;
  }
  var lows = allCosmetics.slice().sort(function (a, b) { return Number(a.quantity) - Number(b.quantity); })[0];
  var st = stockStatus(lows.quantity);
  el.innerHTML = '<b>' + esc(lows.cosmeticName) + '</b>' +
    '<span>' + esc(lows.brand) + ' · ' + esc(lows.quantity) + ' units · ' + st.label + '</span>';
}

/* ---------- mutations ---------- */
function addCosmetic(e) {
  if (e) e.preventDefault();
  if (!validateAddForm()) return;

  var payload =
    '{"cosmeticId":' + parseInt($('f-id').value, 10) +
    ',"cosmeticName":' + JSON.stringify($('f-name').value.trim()) +
    ',"category":' + JSON.stringify($('f-category').value.trim()) +
    ',"brand":' + JSON.stringify($('f-brand').value.trim()) +
    ',"price":' + parseFloat($('f-price').value) +
    ',"quantity":' + parseInt($('f-qty').value, 10) +
    ',"expiryDate":' + JSON.stringify($('f-expiry').value) + '}';

  var btn = $('btnAdd');
  btn.classList.add('loading'); btn.disabled = true;

  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    })
    .then(function () {
      toast('success', 'Added to the collection', $('f-name').value.trim() + ' is now curated by Veloura.');
      $('addForm').reset();
      closeModal('modalAdd');
      return loadCosmetics();
    })
    .catch(function (err) { toast('error', 'Add failed', 'Could not add cosmetic. ' + err.message); })
    .then(function () { btn.classList.remove('loading'); btn.disabled = false; });
}

function editCosmetic(e) {
  if (e) e.preventDefault();
  var id = $('e-id').value;
  if (!id) return;

  var name = $('e-name').value.trim();
  var cat = $('e-category').value.trim();
  var brand = $('e-brand').value.trim();
  var price = parseFloat($('e-price').value);
  var qty = parseInt($('e-qty').value, 10);
  var exp = $('e-expiry').value;
  if (!name || !cat || !brand || isNaN(price) || price < 0 || isNaN(qty) || qty < 0 || !exp) {
    toast('error', 'Validation', 'Please fill every field with valid values.');
    return;
  }

  var payload =
    '{"cosmeticName":' + JSON.stringify(name) +
    ',"category":' + JSON.stringify(cat) +
    ',"brand":' + JSON.stringify(brand) +
    ',"price":' + price +
    ',"quantity":' + qty +
    ',"expiryDate":' + JSON.stringify(exp) + '}';

  var btn = $('btnSaveEdit');
  btn.classList.add('loading'); btn.disabled = true;

  fetch(API_URL + '/' + encodeURIComponent(id), {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: payload
  })
    .then(function (res) {
      if (res.status === 404) throw new Error('Product not found (404).');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    })
    .then(function () {
      toast('success', 'Changes saved', 'Creation N° ' + id + ' was updated.');
      closeModal('modalEdit');
      return loadCosmetics();
    })
    .catch(function (err) { toast('error', 'Update failed', err.message); })
    .then(function () { btn.classList.remove('loading'); btn.disabled = false; });
}

function updateStock() {
  if (stockTargetId === null) return;
  var qty = parseInt($('stockInput').value, 10);
  if (isNaN(qty) || qty < 0) {
    toast('error', 'Invalid quantity', 'Quantity must be a number ≥ 0.');
    return;
  }

  var payload = '{"quantity":' + qty + '}';
  var btn = $('btnSaveStock');
  btn.classList.add('loading'); btn.disabled = true;

  fetch(API_URL + '/' + encodeURIComponent(stockTargetId), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: payload
  })
    .then(function (res) {
      if (res.status === 404) throw new Error('Product not found (404).');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    })
    .then(function () {
      toast('success', 'Stock updated', 'Quantity set to ' + qty + ' for N° ' + stockTargetId + '.');
      closeModal('modalStock');
      return loadCosmetics();
    })
    .catch(function (err) { toast('error', 'Stock update failed', err.message); })
    .then(function () { btn.classList.remove('loading'); btn.disabled = false; });
}

function deleteCosmetic() {
  if (pendingDeleteId === null) return;
  var id = pendingDeleteId;
  var btn = $('btnConfirmDelete');
  btn.classList.add('loading'); btn.disabled = true;

  fetch(API_URL + '/' + encodeURIComponent(id), { method: 'DELETE' })
    .then(function (res) {
      if (res.status === 404) throw new Error('Product not found (404).');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json().catch(function () { return {}; });
    })
    .then(function () {
      toast('success', 'Removed', 'Creation N° ' + id + ' left the collection.');
      pendingDeleteId = null;
      closeModal('modalDelete');
      return loadCosmetics();
    })
    .catch(function (err) { toast('error', 'Delete failed', err.message); })
    .then(function () { btn.classList.remove('loading'); btn.disabled = false; });
}

function viewCosmetic(id) {
  fetch(API_URL + '/' + encodeURIComponent(id), { headers: { Accept: 'application/json' } })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (p) {
      if (!p || p.cosmeticId === undefined) {
        var local = findById(id);
        if (local) { fillDetailModal(local); openModal('modalView'); }
        else toast('error', 'Not found', 'Creation N° ' + id + ' was not found.');
        return;
      }
      fillDetailModal(p);
      openModal('modalView');
    })
    .catch(function (err) {
      var local = findById(id);
      if (local) { fillDetailModal(local); openModal('modalView'); }
      else toast('error', 'View failed', err.message);
    });
}

/* ---------- states ---------- */
function setCollectionState(state) {
  var grid = $('collGrid'), box = $('collEmpty');
  grid.style.display = 'none'; box.style.display = '';
  if (state === 'loading') {
    box.innerHTML = '<div class="state-ico">◌</div><h4>Curating your collection…</h4>' +
      '<p>Fetching live creations from the Veloura REST API.</p>' +
      '<div style="max-width:520px;margin:0 auto;text-align:left;">' +
      '<div class="skel" style="margin-bottom:10px;"></div>' +
      '<div class="skel" style="width:85%;margin-bottom:10px;"></div>' +
      '<div class="skel" style="width:70%;"></div></div>';
  } else if (state === 'error') {
    box.innerHTML = '<div class="state-ico">!</div><h4>Unable to connect to Veloura REST API.</h4>' +
      '<p>Make sure GlassFish is running and the app is deployed.</p>' +
      '<button class="pill-btn pill-dark" onclick="loadCosmetics()">RETRY CONNECTION</button>';
  } else {
    box.innerHTML = '<div class="state-ico">○</div><h4>No creations found</h4>' +
      '<p>Try adjusting search or filters — or add a new cosmetic.</p>' +
      '<button class="pill-btn pill-dark" onclick="openModal(\'modalAdd\')">+ ADD COSMETIC</button>';
  }
}

function setShowcaseState(state) {
  var grid = $('showGrid'), empty = $('showEmpty');
  grid.style.display = 'none'; empty.style.display = '';
  if (state === 'loading') {
    empty.innerHTML = '<div class="state-box"><div class="state-ico">◌</div><h4>Preparing the showcase…</h4><p>Selecting live creations from the API.</p></div>';
  } else if (state === 'error') {
    empty.innerHTML = '<div class="state-box"><div class="state-ico">!</div><h4>Unable to connect to Veloura REST API.</h4>' +
      '<p>The showcase appears once the API is reachable.</p>' +
      '<button class="pill-btn pill-dark" onclick="loadCosmetics()">RETRY</button></div>';
  } else {
    empty.innerHTML = '<div class="state-box"><div class="state-ico">○</div><h4>The pedestals await</h4>' +
      '<p>Add your first cosmetic and it will shine here.</p>' +
      '<button class="pill-btn pill-dark" onclick="openModal(\'modalAdd\')">+ ADD COSMETIC</button></div>';
  }
}

function setStatsLoading() {
  $('statTotal').textContent = '…'; $('statUnits').textContent = '…';
  $('statLow').textContent = '…'; $('statExp').textContent = '…';
  $('statLowSub').textContent = 'loading…';
}

function setStatsEmpty() {
  $('statTotal').textContent = '0'; $('statUnits').textContent = '0';
  $('statLow').textContent = '0'; $('statExp').textContent = '0';
  $('statLowSub').textContent = 'api unreachable';
}

/* ---------- dialogs ---------- */
function fillDetailModal(p) {
  var st = stockStatus(p.quantity);
  var ex = expiryStatus(p.expiryDate);
  var days = daysToExpiry(p.expiryDate);
  var expNote = days === null ? '—' : days < 0 ? 'Expired ' + Math.abs(days) + ' days ago'
    : days === 0 ? 'Expires today' : 'Expires in ' + days + ' days';
  $('detailHero').innerHTML =
    '<div class="d-mono">' + esc(initials(p.cosmeticName)) + '</div>' +
    '<div><b>' + esc(p.cosmeticName) + '</b><span>' + esc(p.brand) + ' · ' + esc(p.category) + ' · N° ' + esc(p.cosmeticId) + '</span></div>' +
    '<div style="margin-left:auto;display:flex;flex-direction:column;gap:6px;align-items:flex-end;">' +
    '<span class="pill ' + st.key + '" style="background:rgba(255,255,255,.22);color:#fff;">' + st.label + '</span>' +
    '<span class="pill ' + ex.key + '" style="background:rgba(255,255,255,.22);color:#fff;">' + esc(ex.label) + '</span></div>';
  $('detailGrid').innerHTML =
    cell('Brand', p.brand) + cell('Category', p.category) +
    cell('Price', fmtPrice(p.price)) +
    cell('Quantity', Number(p.quantity).toLocaleString('en-IN') + ' units') +
    cell('Expiry date', fmtDate(p.expiryDate)) + cell('Expiry status', expNote);
  function cell(k, v) {
    return '<div class="detail-cell"><span>' + k + '</span><b>' + esc(v) + '</b></div>';
  }
}

function openEdit(id) {
  var p = findById(id);
  if (!p) { toast('error', 'Not found', 'Creation N° ' + id + ' was not found.'); return; }
  $('e-id').value = p.cosmeticId;
  $('e-id-show').value = p.cosmeticId;
  $('e-name').value = p.cosmeticName || '';
  $('e-category').value = p.category || '';
  $('e-brand').value = p.brand || '';
  $('e-price').value = p.price;
  $('e-qty').value = p.quantity;
  $('e-expiry').value = (p.expiryDate || '').substring(0, 10);
  $('editSubtitle').textContent = p.cosmeticName + ' · N° ' + p.cosmeticId;
  openModal('modalEdit');
}

function openStock(id) {
  var p = findById(id);
  if (!p) { toast('error', 'Not found', 'Creation N° ' + id + ' was not found.'); return; }
  stockTargetId = p.cosmeticId;
  $('stockInput').value = p.quantity;
  $('stockSubtitle').textContent = p.cosmeticName + ' · now ' + p.quantity + ' units';
  openModal('modalStock');
}

function stockStep(delta) {
  var v = parseInt($('stockInput').value, 10);
  if (isNaN(v)) v = 0;
  $('stockInput').value = Math.max(0, v + delta);
}

function openDelete(id) {
  pendingDeleteId = id;
  var p = findById(id);
  $('deleteText').textContent = p
    ? 'Remove "' + p.cosmeticName + '" (N° ' + p.cosmeticId + ') from the collection? This cannot be undone.'
    : 'Remove creation N° ' + id + '? This cannot be undone.';
  openModal('modalDelete');
}

/* ---------- misc UI ---------- */
function buildCategoryOptions() {
  var sel = $('filterCategory');
  var cur = sel.value || 'all';
  var s = {};
  for (var i = 0; i < allCosmetics.length; i++) s[allCosmetics[i].category] = 1;
  var keys = Object.keys(s).sort();
  sel.innerHTML = '<option value="all">All Categories</option>';
  for (var j = 0; j < keys.length; j++) {
    var o = document.createElement('option');
    o.value = keys[j]; o.textContent = keys[j];
    sel.appendChild(o);
  }
  sel.value = (cur === 'all' || s[cur]) ? cur : 'all';
  filters.category = sel.value;
}

function validateAddForm() {
  var ok = true;
  function check(id, valid) {
    var f = $(id).closest('.field');
    if (f) f.classList.toggle('invalid', !valid);
    if (!valid) ok = false;
  }
  var idV = parseInt($('f-id').value, 10);
  check('f-id', !isNaN(idV) && idV > 0);
  check('f-name', $('f-name').value.trim().length >= 2);
  check('f-category', $('f-category').value.trim().length >= 2);
  check('f-brand', $('f-brand').value.trim().length >= 1);
  var pr = parseFloat($('f-price').value);
  check('f-price', !isNaN(pr) && pr >= 0);
  var q = parseInt($('f-qty').value, 10);
  check('f-qty', !isNaN(q) && q >= 0);
  check('f-expiry', !!$('f-expiry').value);
  if (!ok) toast('error', 'Check the form', 'Please correct the highlighted fields.');
  return ok;
}

function setApiStatus(online) {
  var label = $('apiLabel');
  if (label) label.textContent = online ? 'API Connected' : 'API Offline';
}

function showApiError(err) {
  $('apiError').style.display = '';
  $('apiErrorMsg').innerHTML = 'Unable to connect to Veloura REST API.<br><span style="font-size:12px;">' +
    esc(err.message || err) + ' · The maison stays open; retry once GlassFish is running.</span>';
}

function hideApiError() { $('apiError').style.display = 'none'; }

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', function () {
  var overlays = ['modalAdd', 'modalView', 'modalEdit', 'modalStock', 'modalDelete'];
  overlays.forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('click', function (e) { if (e.target === el) closeModal(id); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') overlays.forEach(closeModal);
  });

  var ham = $('hamburger');
  if (ham) ham.addEventListener('click', function () { document.body.classList.toggle('menu-open'); });
  document.querySelectorAll('.nav-links a').forEach(function (a) {
    a.addEventListener('click', function () {
      document.body.classList.remove('menu-open');
    });
  });

  function on(id, evt, fn) { var el = $(id); if (el) el.addEventListener(evt, fn); }
  on('tableSearch', 'input', function () { filters.search = this.value; renderCollection(); });
  on('filterCategory', 'change', function () { filters.category = this.value; renderCollection(); });
  on('filterStock', 'change', function () { filters.stock = this.value; renderCollection(); });
  on('sortSelect', 'change', function () { filters.sort = this.value; renderCollection(); });
  on('btnRefresh', 'click', loadCosmetics);
  on('addForm', 'submit', addCosmetic);
  on('editForm', 'submit', editCosmetic);

  var revealEls = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(function (el) { io.observe(el); });
  }

  loadCosmetics();
});
