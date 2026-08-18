(function () {
  'use strict';

  var STORAGE_KEY = 'itm_wishlist';
  var CDN_BASE    = 'https://assets.itmtools.com.au/products';

  /* ── Storage ── */
  function getAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
    catch (e) {}
  }

  function has(handle) {
    return getAll().some(function (i) { return i.handle === handle; });
  }

  function add(handle, sku, title, price, vid) {
    var list = getAll();
    if (!list.some(function (i) { return i.handle === handle; })) {
      list.push({ handle: handle, sku: sku || '', title: title || '', price: price || '', vid: vid || '' });
      save(list);
      emit();
    }
  }

  function remove(handle) {
    save(getAll().filter(function (i) { return i.handle !== handle; }));
    emit();
  }

  function toggle(handle, sku, title, price, vid) {
    if (has(handle)) { remove(handle); return false; }
    add(handle, sku, title, price, vid);
    return true;
  }

  function emit() {
    document.dispatchEvent(new CustomEvent('itm:wishlist:change', {
      detail: { items: getAll() }
    }));
  }

  window.ITMWishlist = { getAll: getAll, has: has, add: add, remove: remove, toggle: toggle };

  /* ── Badge update ── */
  function syncBadge() {
    var count  = getAll().length;
    var bubble = document.querySelector('[data-lists-count]');
    if (!bubble) return;
    var span = bubble.querySelector('span[aria-hidden="true"]');
    if (span) span.textContent = count < 100 ? String(count) : '99+';
    if (count > 0) bubble.removeAttribute('hidden');
    else bubble.setAttribute('hidden', '');
  }

  /* ── Button sync ── */
  function syncButtons() {
    var list  = getAll();
    var saved = {};
    list.forEach(function (i) { saved[i.handle] = true; });
    document.querySelectorAll('[data-wl-handle]').forEach(function (btn) {
      var handle  = btn.getAttribute('data-wl-handle');
      var isSaved = !!saved[handle];
      btn.classList.toggle('is-saved', isSaved);
      btn.setAttribute('aria-label', isSaved ? 'Remove from list' : 'Save to list');
    });
    syncBadge();
  }

  /* ── Toast ── */
  function showToast(msg, isRemove) {
    var t = document.getElementById('itm-wl-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'itm-wl-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.toggle('is-remove', !!isRemove);
    t.classList.add('is-visible');
    clearTimeout(t._tid);
    t._tid = setTimeout(function () { t.classList.remove('is-visible'); }, 2400);
  }

  /* ── Click delegation: wishlist toggle ── */
  document.addEventListener('click', function (e) {
    /* Header lists icon — open drawer */
    if (e.target.closest('#lists-icon-bubble')) {
      e.preventDefault();
      openDrawer();
      return;
    }
    /* Wishlist save/remove buttons */
    var btn = e.target.closest('[data-wl-handle]');
    if (!btn) return;
    /* Skip if it's the remove button inside the drawer (handled separately) */
    if (btn.classList.contains('itm-wld-remove')) return;
    e.preventDefault();
    var handle = btn.getAttribute('data-wl-handle');
    var sku    = btn.getAttribute('data-wl-sku')   || '';
    var title  = btn.getAttribute('data-wl-title') || '';
    var price  = btn.getAttribute('data-wl-price') || '';
    var vid    = btn.getAttribute('data-wl-vid')   || '';
    var added  = toggle(handle, sku, title, price, vid);
    showToast(added ? 'Added to Favourites List' : 'Removed from Favourites List', !added);
  });

  document.addEventListener('itm:wishlist:change', function () {
    syncButtons();
    if (drawerIsOpen()) renderDrawerContent();
  });

  /* ── CDN image URL ── */
  function cdnImg(sku) {
    if (!sku) return '';
    return CDN_BASE + '/' + sku + '/images/web/' + sku + '.jpg';
  }

  /* ── HTML escape ── */
  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ═══════════════════════════════════════════
     DRAWER
  ═══════════════════════════════════════════ */
  var drawerEl, overlayEl;

  function drawerIsOpen() {
    return drawerEl && drawerEl.classList.contains('is-open');
  }

  function createDrawer() {
    var wrap = document.createElement('div');
    wrap.id  = 'itm-wl-drawer-wrap';
    wrap.innerHTML =
      '<div id="itm-wl-overlay" class="itm-wl-overlay"></div>'
      + '<div id="itm-wl-drawer" class="itm-wl-drawer" role="dialog" aria-modal="true" aria-label="My List">'
      +   '<div class="itm-wld-header">'
      +     '<h2 class="itm-wld-title">My List</h2>'
      +     '<button class="itm-wld-close" type="button" aria-label="Close list">'
      +       '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">'
      +         '<path d="M18 6L6 18M6 6l12 12"/>'
      +       '</svg>'
      +     '</button>'
      +   '</div>'
      +   '<div class="itm-wld-body" id="itm-wld-body"></div>'
      +   '<div class="itm-wld-footer" id="itm-wld-footer"></div>'
      + '</div>';
    document.body.appendChild(wrap);

    drawerEl  = wrap.querySelector('#itm-wl-drawer');
    overlayEl = wrap.querySelector('#itm-wl-overlay');

    overlayEl.addEventListener('click', closeDrawer);
    wrap.querySelector('.itm-wld-close').addEventListener('click', closeDrawer);
  }

  function openDrawer() {
    /* Close the cart drawer if it's open */
    var cartDrawer = document.querySelector('cart-drawer');
    if (cartDrawer && cartDrawer.classList.contains('active')) cartDrawer.close();

    if (!drawerEl) createDrawer();
    renderDrawerContent();
    drawerEl.classList.add('is-open');
    overlayEl.classList.add('is-open');
    document.body.classList.add('itm-wl-drawer-active');
  }

  function closeDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('is-open');
    overlayEl.classList.remove('is-open');
    document.body.classList.remove('itm-wl-drawer-active');
  }

  function renderDrawerContent() {
    var body   = document.getElementById('itm-wld-body');
    var footer = document.getElementById('itm-wld-footer');
    if (!body) return;

    var items = getAll();

    if (items.length === 0) {
      body.innerHTML = '<div class="itm-wld-empty">'
        + '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5" aria-hidden="true">'
        + '<path d="M9 4.5h6a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-.5a1 1 0 0 1 1-1z"/>'
        + '<path d="M8 5.5H6a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5a2 2 0 0 0-2-2h-2"/>'
        + '<path d="M9 11.5h6"/><path d="M9 15.5h6"/>'
        + '</svg>'
        + '<p>Your list is empty</p>'
        + '<a href="/collections/all" class="itm-wld-browse">Browse Products</a>'
        + '</div>';
      if (footer) footer.innerHTML = '';
      return;
    }

    var html = '';
    items.forEach(function (item) {
      var img = cdnImg(item.sku);
      var atcDisabled = item.vid ? '' : ' disabled';
      html +=
        '<div class="itm-wld-item">'
        + '<a class="itm-wld-img" href="/products/' + esc(item.handle) + '">'
        + (img
            ? '<img src="' + esc(img) + '" alt="' + esc(item.title) + '" loading="lazy" width="72" height="72">'
            : '<div class="itm-wld-img-ph"></div>')
        + '</a>'
        + '<div class="itm-wld-item-info">'
        +   '<a class="itm-wld-item-title" href="/products/' + esc(item.handle) + '">' + esc(item.title) + '</a>'
        +   (item.price ? '<div class="itm-wld-item-price">' + esc(item.price) + '</div>' : '')
        +   '<div class="itm-wld-item-actions">'
        +     '<button class="itm-wld-atc" type="button" data-variant-id="' + esc(item.vid) + '"' + atcDisabled + '>Add to Cart</button>'
        +   '</div>'
        + '</div>'
        + '<button class="itm-wld-remove" type="button" data-wl-handle="' + esc(item.handle) + '" aria-label="Remove">'
        +   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">'
        +     '<path d="M18 6L6 18M6 6l12 12"/>'
        +   '</svg>'
        + '</button>'
        + '</div>';
    });
    body.innerHTML = html;

    if (footer) {
      var hasAddable = items.some(function (i) { return i.vid; });
      footer.innerHTML =
        (hasAddable
          ? '<button class="itm-wld-add-all" type="button">Add All to Cart</button>'
          : '')
        + '<a href="/pages/wishlist" class="itm-wld-view-all">View full list</a>';
    }
  }

  /* ── Drawer: remove button clicks ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.itm-wld-remove');
    if (!btn) return;
    var handle = btn.getAttribute('data-wl-handle');
    if (handle) remove(handle);
  });

  /* ── Cart add helper ──
     Uses Dawn's section rendering so the header cart count + cart drawer update live.
     openCart=true → close the list drawer and open the cart drawer (showing the item);
     openCart=false → update count/drawer silently (used on the wishlist page). */
  function wlAddToCart(payload, btn, resetLabel, openCart) {
    var cart = document.querySelector('cart-drawer') || document.querySelector('cart-notification');
    if (cart && cart.getSectionsToRender) {
      payload.sections = cart.getSectionsToRender().map(function (s) { return s.id; });
      payload.sections_url = window.location.pathname;
    }
    fetch('/cart/add.js', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' },
      body:    JSON.stringify(payload)
    }).then(function (r) {
      return r.json().then(function (data) { return { ok: r.ok, data: data }; });
    }).then(function (res) {
      if (!res.ok || res.data.status) {
        btn.textContent = 'Error';
        setTimeout(function () { btn.disabled = false; btn.textContent = resetLabel; }, 2500);
        return;
      }
      if (openCart) {
        closeDrawer();
        if (cart && cart.renderContents) cart.renderContents(res.data);
        else if (cart && cart.open) cart.open();
      } else {
        if (cart && cart.getSectionsToRender && res.data.sections) {
          cart.getSectionsToRender().forEach(function (s) {
            var el   = s.selector ? document.querySelector(s.selector) : document.getElementById(s.id);
            var html = res.data.sections[s.id];
            if (!el || html == null) return;
            var src = new DOMParser().parseFromString(html, 'text/html').querySelector(s.selector || '.shopify-section');
            if (src) el.innerHTML = src.innerHTML;
          });
        }
        btn.textContent = 'Added!';
        setTimeout(function () { btn.disabled = false; btn.textContent = resetLabel; }, 2000);
      }
    }).catch(function () {
      btn.textContent = 'Error';
      setTimeout(function () { btn.disabled = false; btn.textContent = resetLabel; }, 2500);
    });
  }

  /* ── Drawer: ATC ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.itm-wld-atc:not([disabled])');
    if (!btn) return;
    var variantId = btn.getAttribute('data-variant-id');
    if (!variantId) return;
    btn.disabled    = true;
    btn.textContent = 'Adding…';
    wlAddToCart({ id: parseInt(variantId, 10), quantity: 1 }, btn, 'Add to Cart', true);
  });

  /* ── Drawer: Add All to Cart ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.itm-wld-add-all');
    if (!btn) return;
    var addable = getAll().filter(function (i) { return i.vid; });
    if (!addable.length) return;
    btn.disabled    = true;
    btn.textContent = 'Adding…';
    wlAddToCart({ items: addable.map(function (i) { return { id: parseInt(i.vid, 10), quantity: 1 }; }) }, btn, 'Add All to Cart', true);
  });

  /* ── Wishlist page rendering ── */
  function renderPage(container) {
    var items = getAll();
    if (items.length === 0) {
      container.innerHTML = '<div class="itm-wl-empty">'
        + '<p>Your list is empty.</p>'
        + '<a href="/collections/all" class="itm-wl-browse-btn">Browse Products</a>'
        + '</div>';
      return;
    }

    container.innerHTML = '<div class="itm-wl-loading">Loading saved items…</div>';

    Promise.all(items.map(function (item) {
      return fetch('/products/' + item.handle + '.js')
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    })).then(function (products) {
      var cards = [];
      products.forEach(function (p, idx) {
        if (!p) return;
        var stored   = items[idx] || {};
        var sku      = stored.sku || (p.variants && p.variants[0] && p.variants[0].sku) || '';
        var imgUrl   = sku ? cdnImg(sku) : (p.featured_image || '');
        var variant  = p.variants && p.variants[0];
        var priceStr = stored.price || (variant ? '$' + (variant.price / 100).toFixed(2).replace(/\.00$/, '') : '');
        var vid      = stored.vid || (variant ? String(variant.id) : '');
        var handle   = p.handle;

        cards.push(
          '<div class="itm-wl-card">'
          + '<a class="itm-wl-card__img-wrap" href="/products/' + esc(handle) + '">'
          + (imgUrl
              ? '<img class="itm-wl-card__img" src="' + esc(imgUrl) + '" alt="' + esc(p.title) + '" loading="lazy">'
              : '<div class="itm-wl-card__img-ph"></div>')
          + '</a>'
          + '<div class="itm-wl-card__body">'
          + '<a class="itm-wl-card__title" href="/products/' + esc(handle) + '">' + esc(p.title) + '</a>'
          + (priceStr ? '<div class="itm-wl-card__price">' + esc(priceStr) + '</div>' : '')
          + '<div class="itm-wl-card__actions">'
          + (vid && p.available
              ? '<button class="itm-wl-atc-btn" type="button" data-variant-id="' + esc(vid) + '">Add to Cart</button>'
              : '<button class="itm-wl-atc-btn" type="button" disabled>Sold Out</button>')
          + '<button class="itm-wl-remove-btn" type="button" data-wl-handle="' + esc(handle) + '" aria-label="Remove">'
          + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">'
          + '<path d="M18 6L6 18M6 6l12 12"/></svg>'
          + '</button>'
          + '</div>'
          + '</div>'
          + '</div>'
        );
      });

      if (cards.length === 0) {
        container.innerHTML = '<div class="itm-wl-empty"><p>No items found.</p>'
          + '<a href="/collections/all" class="itm-wl-browse-btn">Browse Products</a></div>';
        return;
      }
      container.innerHTML = '<div class="itm-wl-grid">' + cards.join('') + '</div>';
    });
  }

  /* ── Page ATC ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.itm-wl-atc-btn:not([disabled])');
    if (!btn) return;
    var variantId = btn.getAttribute('data-variant-id');
    if (!variantId) return;
    btn.disabled    = true;
    btn.textContent = 'Adding…';
    wlAddToCart({ id: parseInt(variantId, 10), quantity: 1 }, btn, 'Add to Cart', false);
  });

  /* ── Page remove ── */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.itm-wl-remove-btn');
    if (!btn) return;
    var handle = btn.getAttribute('data-wl-handle');
    if (handle) remove(handle);
  });

  /* ── Init ── */
  function init() {
    syncButtons();
    var pageGrid = document.getElementById('itm-wl-grid');
    if (pageGrid) {
      renderPage(pageGrid);
      document.addEventListener('itm:wishlist:change', function () { renderPage(pageGrid); });
    }

    /* Close wishlist when cart drawer opens */
    var cartDrawerEl = document.querySelector('cart-drawer');
    if (cartDrawerEl) {
      new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.attributeName === 'class' && cartDrawerEl.classList.contains('active')) {
            closeDrawer();
          }
        });
      }).observe(cartDrawerEl, { attributes: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
