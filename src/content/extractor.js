/**
 * Title text extraction from Netflix DOM elements.
 * Handles browse cards, mini modals, detail modals, and billboards.
 */
NR.extractor = {

  /**
   * Extract title from a browse card element.
   * Tries: aria-label on link → alt on image → fallback text.
   */
  fromCard(cardEl) {
    if (!cardEl) return null;

    // Method 1: aria-label on the card link
    const link = cardEl.querySelector('a[aria-label]');
    if (link) {
      const label = link.getAttribute('aria-label');
      if (label) return NR.helpers.normalizeTitle(label);
    }

    // Method 2: alt text on the poster image
    const img = cardEl.querySelector('.boxart-image, img.boxart-image-in-padded-container, img[class*="boxart"], .boxart-container img');
    if (img) {
      const alt = img.getAttribute('alt');
      if (alt) return NR.helpers.normalizeTitle(alt);
    }

    // Method 3: fallback text element
    const fallback = cardEl.querySelector('p.fallback-text, .fallback-text-container p');
    if (fallback && fallback.textContent) {
      return NR.helpers.normalizeTitle(fallback.textContent);
    }

    return null;
  },

  /**
   * Extract title from a mini modal (hover preview).
   */
  fromMiniModal(modalEl) {
    if (!modalEl) return null;

    // Title treatment image alt text
    const logoImg = modalEl.querySelector('.previewModal--player-titleTreatment-logo img, img.previewModal--boxart');
    if (logoImg) {
      const alt = logoImg.getAttribute('alt');
      if (alt) return NR.helpers.normalizeTitle(alt);
    }

    // Text-based title
    const titleText = modalEl.querySelector(
      'h3.previewModal--section-header strong, ' +
      '.previewModal--metadatAndControls-title-name, ' +
      '.previewModal--section-header'
    );
    if (titleText && titleText.textContent) {
      return NR.helpers.normalizeTitle(titleText.textContent);
    }

    // aria-label on the modal itself
    const ariaLabel = modalEl.getAttribute('aria-label');
    if (ariaLabel) return NR.helpers.normalizeTitle(ariaLabel);

    return null;
  },

  /**
   * Extract title from the detail/jawbone modal.
   */
  fromDetailModal(modalEl) {
    if (!modalEl) return null;

    // About section header
    const aboutTitle = modalEl.querySelector('.about-header h3 strong, .about-header strong');
    if (aboutTitle && aboutTitle.textContent) {
      return NR.helpers.normalizeTitle(aboutTitle.textContent);
    }

    // Preview modal title
    const previewTitle = modalEl.querySelector(
      '.previewModal--player-titleTreatment-logo img'
    );
    if (previewTitle) {
      const alt = previewTitle.getAttribute('alt');
      if (alt) return NR.helpers.normalizeTitle(alt);
    }

    // Title logo aria-label
    const titleLogo = modalEl.querySelector('[data-uia="preview-modal-player-title-treatment"]');
    if (titleLogo) {
      const img = titleLogo.querySelector('img');
      if (img && img.alt) return NR.helpers.normalizeTitle(img.alt);
    }

    return null;
  },

  /**
   * Extract title from the billboard/hero section.
   */
  fromBillboard(billboardEl) {
    if (!billboardEl) return null;

    const titleImg = billboardEl.querySelector('.title-logo img');
    if (titleImg) {
      const alt = titleImg.getAttribute('alt');
      if (alt) return NR.helpers.normalizeTitle(alt);
    }

    const titleText = billboardEl.querySelector('.billboard-title');
    if (titleText && titleText.textContent) {
      return NR.helpers.normalizeTitle(titleText.textContent);
    }

    return null;
  },
};
