/**
 * ITM CDN Document Checker
 * Checks if brochure/manual PDFs exist on CDN before displaying download links
 */

class CdnDocumentChecker {
  constructor() {
    this.checkedUrls = new Map(); // Cache results
    this.init();
  }

  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.checkAllLinks());
    } else {
      this.checkAllLinks();
    }
  }

  async checkAllLinks() {
    const links = document.querySelectorAll('a[data-check-exists="true"]');
    
    // Check all links in parallel
    const promises = Array.from(links).map(link => this.checkAndShowLink(link));
    await Promise.all(promises);
  }

  async checkAndShowLink(link) {
    const url = link.href;
    
    console.log('Checking document:', url);
    
    if (!url) return;

    // Check cache first
    if (this.checkedUrls.has(url)) {
      if (this.checkedUrls.get(url)) {
        this.showLink(link);
      }
      return;
    }

    try {
      let exists = await this.fileExists(url);
      
      // If not found, try alternate case sensitivity
      if (!exists) {
        const alternateUrl = this.getAlternateCaseUrl(url);
        if (alternateUrl && alternateUrl !== url) {
          console.log('Trying alternate case:', alternateUrl);
          exists = await this.fileExists(alternateUrl);
          if (exists) {
            // Update link to use the working URL
            link.href = alternateUrl;
          }
        }
      }
      
      console.log('Document exists?', exists ? (link.href === url ? url : alternateUrl) : url, exists);
      this.checkedUrls.set(url, exists);
      
      if (exists) {
        this.showLink(link);
      }
    } catch (error) {
      console.warn('Error checking document:', url, error);
      // Don't show link if there's an error
    }
  }

  getAlternateCaseUrl(url) {
    // Try alternate case for _Brochure.pdf <-> _brochure.pdf and _Manual.pdf <-> _manual.pdf
    if (url.includes('_Brochure.pdf')) {
      return url.replace('_Brochure.pdf', '_brochure.pdf');
    } else if (url.includes('_brochure.pdf')) {
      return url.replace('_brochure.pdf', '_Brochure.pdf');
    } else if (url.includes('_Manual.pdf')) {
      return url.replace('_Manual.pdf', '_manual.pdf');
    } else if (url.includes('_manual.pdf')) {
      return url.replace('_manual.pdf', '_Manual.pdf');
    }
    return null;
  }

  async fileExists(url) {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok; // Returns true for 2xx status codes
    } catch (error) {
      // CORS might block HEAD requests, try GET with range
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Range': 'bytes=0-0' },
          cache: 'no-cache'
        });
        return response.ok || response.status === 206;
      } catch (e) {
        // If CORS blocks us completely, assume file does NOT exist
        // (safer to hide link than show broken link)
        return false;
      }
    }
  }

  showLink(link) {
    link.classList.remove('hidden');
  }
}

// Initialize on page load
new CdnDocumentChecker();
