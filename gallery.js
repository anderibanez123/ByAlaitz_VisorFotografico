(function () {
  "use strict";

  const SETTINGS_KEY = "superrutas.viewer.settings";
  const CONFIG_URL = "config.json";
  const DEFAULT_DRIVE_FOLDER_ID = "12yEeMDnOLoU2h4vDtqDD2ICxJEm1xSqQ";
  const DEFAULT_SETTINGS = {
    driveFolderId: DEFAULT_DRIVE_FOLDER_ID,
    driveApiKey: "",
    gallery: {
      rootSectionTitle: "Fotos recientes",
      emptyMessage: "Todavia no hay eventos publicados.",
      sections: []
    }
  };

  const eventNav = document.getElementById("galleryEventNav");
  const sectionsContainer = document.getElementById("gallerySections");
  const status = document.getElementById("galleryStatus");
  const lightbox = document.getElementById("galleryLightbox");
  const lightboxImage = document.getElementById("lightboxImage");
  const lightboxCaption = document.getElementById("lightboxCaption");
  const lightboxClose = document.getElementById("lightboxClose");
  const lightboxPrevious = document.getElementById("lightboxPrevious");
  const lightboxNext = document.getElementById("lightboxNext");

  let settings = DEFAULT_SETTINGS;
  let galleryImages = [];
  let activeImageIndex = 0;

  init();

  async function init() {
    settings = await readSettings();
    bindLightbox();
    try {
      const sections = await fetchGallerySections();
      renderGallery(sections);
    } catch (error) {
      showStatus("No se pudo cargar la galeria.");
    }
  }

  async function readSettings() {
    const fileSettings = await readFileSettings();
    const localSettings = readLocalSettings();
    return normalizeSettings({ ...fileSettings, ...localSettings });
  }

  async function readFileSettings() {
    try {
      const response = await fetch(CONFIG_URL, { cache: "no-store" });
      if (!response.ok) {
        return {};
      }
      return await response.json();
    } catch (error) {
      return {};
    }
  }

  function readLocalSettings() {
    try {
      return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (error) {
      return {};
    }
  }

  function normalizeSettings(saved) {
    saved = saved || {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      gallery: {
        ...DEFAULT_SETTINGS.gallery,
        ...(saved.gallery || {}),
        sections: Array.isArray(saved.gallery?.sections) ? saved.gallery.sections : DEFAULT_SETTINGS.gallery.sections
      }
    };
  }

  async function fetchGallerySections() {
    const folderId = getDriveFolderId(settings.driveFolderId);
    if (!folderId || !settings.driveApiKey) {
      throw new Error("Falta configuracion de Google Drive.");
    }

    const rootImages = await fetchDriveImages(folderId);
    const configuredSections = buildConfiguredSections(rootImages);
    if (configuredSections.length) {
      return configuredSections;
    }

    const folders = await fetchDriveFolders(folderId);

    const sections = [];
    if (rootImages.length) {
      sections.push({
        id: "recientes",
        title: settings.gallery.rootSectionTitle,
        updatedAt: rootImages[0]?.updatedAt || "",
        images: rootImages
      });
    }

    const eventSections = await Promise.all(
      folders.map(async (folder) => ({
        id: folder.id,
        title: folder.name,
        updatedAt: folder.modifiedTime,
        images: await fetchDriveImages(folder.id)
      }))
    );

    sections.push(...eventSections.filter((section) => section.images.length));
    return sections;
  }

  function buildConfiguredSections(rootImages) {
    const configured = settings.gallery.sections || [];
    if (!configured.length) {
      return [];
    }

    const imageById = new Map(rootImages.map((image) => [image.id, image]));
    return configured
      .map((section) => ({
        id: section.id,
        title: section.title,
        images: (section.imageIds || []).map((imageId) => imageById.get(imageId)).filter(Boolean)
      }))
      .filter((section) => section.title && section.images.length);
  }

  async function fetchDriveFolders(folderId) {
    const query = `'${folderId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder'`;
    const fields = "files(id,name,modifiedTime)";
    const url = createDriveListUrl(query, fields, "name");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Google Drive HTTP ${response.status}`);
    }
    const payload = await response.json();
    return payload.files || [];
  }

  async function fetchDriveImages(folderId) {
    const query = `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`;
    const fields = "files(id,name,mimeType,modifiedTime,createdTime)";
    const url = createDriveListUrl(query, fields, "createdTime desc");
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Google Drive HTTP ${response.status}`);
    }
    const payload = await response.json();
    return (payload.files || []).map((file) => ({
      id: file.id,
      title: cleanImageTitle(file.name),
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w900`,
      fullUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w2400`,
      updatedAt: file.modifiedTime || file.createdTime || ""
    }));
  }

  function createDriveListUrl(query, fields, orderBy) {
    const params = new URLSearchParams({
      q: query,
      fields,
      orderBy,
      key: settings.driveApiKey,
      pageSize: "1000"
    });
    return `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
  }

  function renderGallery(sections) {
    eventNav.replaceChildren();
    sectionsContainer.replaceChildren();
    galleryImages = [];

    if (!sections.length) {
      showStatus(settings.gallery.emptyMessage);
      return;
    }

    hideStatus();
    sections.forEach((section) => renderSection(section));
  }

  function renderSection(section) {
    const sectionId = `evento-${slugify(section.title || section.id)}`;
    const navLink = document.createElement("a");
    navLink.href = `#${sectionId}`;
    navLink.textContent = section.title;
    eventNav.appendChild(navLink);

    const wrapper = document.createElement("section");
    wrapper.id = sectionId;
    wrapper.className = "gallery-section";

    const header = document.createElement("div");
    header.className = "gallery-section-header";

    const title = document.createElement("h2");
    title.textContent = section.title;

    const meta = document.createElement("p");
    meta.textContent = `${section.images.length} ${section.images.length === 1 ? "foto" : "fotos"}`;

    header.append(title, meta);

    const grid = document.createElement("div");
    grid.className = "gallery-grid";
    section.images.forEach((image) => {
      const imageIndex = galleryImages.push({ ...image, sectionTitle: section.title }) - 1;
      grid.appendChild(createPhotoCard(image, imageIndex));
    });

    wrapper.append(header, grid);
    sectionsContainer.appendChild(wrapper);
  }

  function createPhotoCard(image, imageIndex) {
    const button = document.createElement("button");
    button.className = "gallery-photo";
    button.type = "button";
    button.addEventListener("click", () => openLightbox(imageIndex));

    const photo = document.createElement("img");
    photo.loading = "lazy";
    photo.src = image.thumbnailUrl;
    photo.alt = image.title || "Fotografia de evento";

    const caption = document.createElement("span");
    caption.textContent = image.title;

    button.append(photo, caption);
    return button;
  }

  function bindLightbox() {
    lightboxClose.addEventListener("click", closeLightbox);
    lightboxPrevious.addEventListener("click", () => moveLightbox(-1));
    lightboxNext.addEventListener("click", () => moveLightbox(1));
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
    document.addEventListener("keydown", (event) => {
      if (!lightbox.classList.contains("is-open")) {
        return;
      }
      if (event.key === "Escape") {
        closeLightbox();
      }
      if (event.key === "ArrowLeft") {
        moveLightbox(-1);
      }
      if (event.key === "ArrowRight") {
        moveLightbox(1);
      }
    });
  }

  function openLightbox(index) {
    activeImageIndex = index;
    renderLightboxImage();
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.removeAttribute("src");
  }

  function moveLightbox(direction) {
    activeImageIndex = (activeImageIndex + direction + galleryImages.length) % galleryImages.length;
    renderLightboxImage();
  }

  function renderLightboxImage() {
    const image = galleryImages[activeImageIndex];
    lightboxImage.src = image.fullUrl;
    lightboxImage.alt = image.title || "Fotografia de evento";
    lightboxCaption.textContent = `${image.sectionTitle} - ${image.title || "Fotografia"}`;
  }

  function getDriveFolderId(value) {
    const raw = (value || "").trim();
    if (!raw) {
      return "";
    }
    const foldersMatch = raw.match(/\/folders\/([^/?#]+)/);
    if (foldersMatch) {
      return foldersMatch[1];
    }
    const idQueryMatch = raw.match(/[?&]id=([^&#]+)/);
    if (idQueryMatch) {
      return idQueryMatch[1];
    }
    return raw.replace(/[?#].*$/, "");
  }

  function cleanImageTitle(name) {
    return (name || "Fotografia").replace(/\.[a-z0-9]{2,5}$/i, "");
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "evento";
  }

  function showStatus(message) {
    status.textContent = message;
    status.classList.remove("is-hidden");
  }

  function hideStatus() {
    status.classList.add("is-hidden");
  }
})();
