/**
 * CDN image resolver for ITM product assets.
 *
 * Strategy:
 * - Do not prefetch with HEAD or observe every DOM mutation.
 * - Let the browser try an image URL, then on error try deterministic fallbacks.
 * - Support primary filename variants (sku or sku_1) and multiple formats (jpg/png/webp).
 */

function _cdnHideImage(img) {
  const cdnIndex = img.dataset && img.dataset.cdnIndex ? parseInt(img.dataset.cdnIndex, 10) : 0;

  // Secondary gallery images (index 2+): remove the slide entirely rather than showing a placeholder.
  if (cdnIndex > 1) {
    const slideItem = img.closest('.slider__slide');
    if (slideItem) {
      const mediaId = slideItem.dataset.mediaId || slideItem.dataset.target;
      if (mediaId) {
        if (_cdnRemovedSlides.has(mediaId)) return; // paired image already handled this
        _cdnRemovedSlides.add(mediaId);
      }
      // Remove this slide
      slideItem.remove();
      // Remove the paired slide (main gallery ↔ thumbnail)
      if (slideItem.dataset.mediaId) {
        var thumb = document.querySelector('li[data-target="' + mediaId + '"]');
        if (thumb) thumb.remove();
      } else if (slideItem.dataset.target) {
        var mainSlide = document.querySelector('li[data-media-id="' + mediaId + '"]');
        if (mainSlide) mainSlide.remove();
      }
      // Recount slides and update the gallery counter
      var galleryViewer = document.querySelector('slider-component[id^="GalleryViewer-"]');
      if (galleryViewer) {
        var counterTotal = galleryViewer.querySelector('.slider-counter--total');
        if (counterTotal) {
          var remaining = galleryViewer.querySelectorAll('ul > li.slider__slide').length;
          counterTotal.textContent = remaining;
        }
      }
      return;
    }
  }

  // Primary image (index 1) or non-gallery images: show placeholder fallback.
  const fallbackSrc = (img.dataset && img.dataset.cdnFallbackSrc) || '/assets/image_coming_soon.png';
  if (fallbackSrc && img.dataset.cdnFallbackApplied !== 'true') {
    img.dataset.cdnFallbackApplied = 'true';
    img.classList.add('cdn-fallback-image');
    img.removeAttribute('srcset');
    img.src = fallbackSrc;
    return;
  }

  const container = img.closest('.card__media, .product__media-item, .media, .thumbnail, .product-media-container');
  if (container) {
    container.style.display = 'none';
  } else {
    img.style.display = 'none';
  }
}

function _cdnParseImage(url) {
  const cleanUrl = url.split('?')[0];
  const match = cleanUrl.match(/\/products\/([^\/]+)\/images\/web\/([^\/]+)\.(jpg|jpeg|png|webp)$/i);
  if (!match) return null;

  const sku = match[1];
  const filename = match[2];
  const currentExt = match[3].toLowerCase();
  const suffixMatch = filename.match(/_(\d+)$/);

  let imageNumber = 1;
  if (suffixMatch && suffixMatch[1]) {
    imageNumber = parseInt(suffixMatch[1], 10);
  }

  const basePath = 'https://assets.itmtools.com.au/products/' + sku + '/images/web/';
  return {
    sku,
    filename,
    imageNumber,
    currentExt,
    basePath
  };
}

function _cdnBuildCandidates(parsed) {
  const formats = ['jpg', 'png', 'webp'];
  const candidates = [];
  const seen = new Set();

  function addCandidate(url) {
    if (seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  }

  if (parsed.imageNumber === 1) {
    // Order: for each format, try sku.ext then sku_1.ext immediately.
    // This means sku_1.jpg is tried right after sku.jpg fails,
    // rather than after all other formats of the base name.
    const orderedFormats = [parsed.currentExt].concat(
      formats.filter(function(f) { return f !== parsed.currentExt; })
    );
    orderedFormats.forEach(function(ext) {
      addCandidate(parsed.basePath + parsed.sku + '.' + ext);
      addCandidate(parsed.basePath + parsed.sku + '_1.' + ext);
    });
    return candidates;
  }

  const numberedName = parsed.sku + '_' + parsed.imageNumber;
  addCandidate(parsed.basePath + numberedName + '.' + parsed.currentExt);
  formats.forEach(function(ext) {
    addCandidate(parsed.basePath + numberedName + '.' + ext);
  });
  return candidates;
}

// Cross-image caches reduce retries when gallery/card/modal use the same CDN image key.
const _cdnResolvedByKey = new Map();
const _cdnMissingUrls = new Set();
// Tracks media IDs already removed from the gallery so paired images don't double-process.
const _cdnRemovedSlides = new Set();

function _cdnTryNextCandidate(img) {
  const parsed = _cdnParseImage(img.src);
  if (!parsed) {
    _cdnHideImage(img);
    return;
  }

  const cacheKey = parsed.sku + '|' + parsed.imageNumber;
  const cachedResolved = _cdnResolvedByKey.get(cacheKey);
  const current = img.src.split('?')[0];

  if (cachedResolved && cachedResolved !== current) {
    img.src = cachedResolved;
    return;
  }

  let candidates = img.dataset.cdnCandidates ? img.dataset.cdnCandidates.split('|') : null;
  if (!candidates || !candidates.length) {
    candidates = _cdnBuildCandidates(parsed);
    img.dataset.cdnCandidates = candidates.join('|');
  }

  let tried = img.dataset.cdnTried ? img.dataset.cdnTried.split('|') : [];
  if (tried.indexOf(current) === -1) {
    tried.push(current);
  }
  _cdnMissingUrls.add(current);

  const next = candidates.find(function(url) {
    return tried.indexOf(url) === -1 && !_cdnMissingUrls.has(url);
  });

  if (!next) {
    _cdnHideImage(img);
    return;
  }

  tried.push(next);
  img.dataset.cdnTried = tried.join('|');
  img.src = next;
}

function _cdnIsItmImage(img) {
  return img && img.tagName === 'IMG' && !!img.src && img.src.includes('assets.itmtools.com.au/products/');
}

// Recover from the defer timing gap: if an ITM image already failed before this script ran,
// naturalWidth will be 0 once complete.
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('img[src*="assets.itmtools.com.au/products/"]').forEach(function(img) {
    if (img.complete && img.naturalWidth === 0) {
      _cdnTryNextCandidate(img);
    }
  });
});

// Cache successful resolutions so identical images elsewhere can use the known-good URL directly.
document.addEventListener('load', function(e) {
  const img = e.target;
  if (!_cdnIsItmImage(img)) return;
  const parsed = _cdnParseImage(img.src);
  if (!parsed) return;
  _cdnResolvedByKey.set(parsed.sku + '|' + parsed.imageNumber, img.src.split('?')[0]);
}, true);

// Capture phase catches non-bubbling image error events for initial/lazy/dynamic images.
document.addEventListener('error', function(e) {
  const img = e.target;
  if (!_cdnIsItmImage(img)) return;
  _cdnTryNextCandidate(img);
}, true);
