if (!customElements.get('product-modal')) {
  customElements.define(
    'product-modal',
    class ProductModal extends ModalDialog {
      constructor() {
        super();
        this.setupNavigation();
      }

      setupNavigation() {
        const prevBtn = this.querySelector('[data-modal-nav="prev"]');
        const nextBtn = this.querySelector('[data-modal-nav="next"]');
        
        if (prevBtn) {
          prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            this.navigateMedia(-1);
          }, true);
          
          prevBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
          }, true);
        }
        
        if (nextBtn) {
          nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
            this.navigateMedia(1);
          }, true);
          
          nextBtn.addEventListener('pointerup', (e) => {
            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();
          }, true);
        }
        
        // Keyboard navigation
        this.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            this.navigateMedia(-1);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            this.navigateMedia(1);
          }
          if (e.key === 'Escape') {
            this.hide();
          }
        });
        
        // Update counter on navigation
        this.updateCounter();
      }

      navigateMedia(direction) {
        const allMedia = Array.from(this.querySelectorAll('[data-media-id]'));
        const activeMedia = this.querySelector('[data-media-id].active');
        
        if (!activeMedia || allMedia.length <= 1) return;
        
        const currentIndex = allMedia.indexOf(activeMedia);
        let nextIndex = currentIndex + direction;
        
        // Wrap around
        if (nextIndex < 0) nextIndex = allMedia.length - 1;
        if (nextIndex >= allMedia.length) nextIndex = 0;
        
        const nextMedia = allMedia[nextIndex];
        
        // Fade out current, fade in next for smoother transition
        activeMedia.style.opacity = '0';
        
        setTimeout(() => {
          // Remove active class from all
          allMedia.forEach(media => {
            media.classList.remove('active');
            media.style.opacity = '1';
          });
          
          // Add active class to next
          nextMedia.classList.add('active');
          nextMedia.style.opacity = '0';
          
          // Fade in
          setTimeout(() => {
            nextMedia.style.opacity = '1';
          }, 10);
          
          // Load deferred media if needed
          const deferredMedia = nextMedia.querySelector('.deferred-media');
          if (deferredMedia) deferredMedia.loadContent(false);
          
          // Update counter
          this.updateCounter();
        }, 150);
      }
      
      updateCounter() {
        const counter = this.querySelector('.product-media-modal__counter');
        if (!counter) return;
        
        const allMedia = Array.from(this.querySelectorAll('[data-media-id]'));
        const activeMedia = this.querySelector('[data-media-id].active');
        
        if (activeMedia && allMedia.length > 0) {
          const currentIndex = allMedia.indexOf(activeMedia) + 1;
          counter.textContent = `${currentIndex} / ${allMedia.length}`;
        }
      }

      hide() {
        super.hide();
      }

      show(opener) {
        super.show(opener);
        this.showActiveMedia();
      }

      showActiveMedia() {
        this.querySelectorAll(
          `[data-media-id]:not([data-media-id="${this.openedBy.getAttribute('data-media-id')}"])`
        ).forEach((element) => {
          element.classList.remove('active');
        });
        const activeMedia = this.querySelector(`[data-media-id="${this.openedBy.getAttribute('data-media-id')}"]`);
        const activeMediaTemplate = activeMedia.querySelector('template');
        const activeMediaContent = activeMediaTemplate ? activeMediaTemplate.content : null;
        activeMedia.classList.add('active');
        activeMedia.scrollIntoView();

        const container = this.querySelector('[role="document"]');
        container.scrollLeft = (activeMedia.width - container.clientWidth) / 2;

        if (
          activeMedia.nodeName == 'DEFERRED-MEDIA' &&
          activeMediaContent &&
          activeMediaContent.querySelector('.js-youtube')
        )
          activeMedia.loadContent();
        
        // Initialize counter
        this.updateCounter();
      }
    }
  );
}
