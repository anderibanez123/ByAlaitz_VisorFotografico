(function () {
  "use strict";

  const SETTINGS_KEY = "superrutas.viewer.settings";
  const CACHE_KEY = "superrutas.viewer.images";
  const CONFIG_URL = "config.json";
  const DEFAULT_DRIVE_FOLDER_ID = "12yEeMDnOLoU2h4vDtqDD2ICxJEm1xSqQ";
  const DEFAULT_SETTINGS = {
    intervalSeconds: 5,
    transitionMs: 1200,
    transitionType: "fade",
    playOrder: "sequential",
    decorativeBackground: true,
    sourceType: "manifest",
    manifestUrl: "manifest.json",
    driveFolderId: DEFAULT_DRIVE_FOLDER_ID,
    uploadTargetUrl: "",
    driveApiKey: "",
    pollSeconds: 45,
    contactBar: {
      enabled: true,
      mode: "fixed",
      speed: 28,
      items: [
        { type: "instagram", label: "Instagram", value: "@tu_instagram", url: "" },
        { type: "tiktok", label: "TikTok", value: "@tu_tiktok", url: "" },
        { type: "email", label: "Correo", value: "correo@ejemplo.com", url: "" },
        { type: "phone", label: "Contacto", value: "+34 600 000 000", url: "" }
      ]
    }
  };

  const viewer = document.getElementById("viewer");
  const currentImage = document.getElementById("currentImage");
  const nextImage = document.getElementById("nextImage");
  const status = document.getElementById("status");
  const fullscreenButton = document.getElementById("fullscreenButton");
  const wakeButton = document.getElementById("wakeButton");
  const contactBar = document.getElementById("contactBar");

  let settings = normalizeSettings({});
  let images = [];
  let index = 0;
  let timerId = null;
  let pollId = null;
  let resizeId = null;
  let transitioning = false;
  let lastStageTap = 0;

  init();

  async function init() {
    settings = await readSettings();
    applySettings();
    fullscreenButton.addEventListener("click", enterPresentationMode);
    currentImage.addEventListener("dblclick", enterPresentationMode);
    nextImage.addEventListener("dblclick", enterPresentationMode);
    document.getElementById("stage").addEventListener("touchend", handleStageTouchEnd, { passive: true });
    wakeButton.addEventListener("click", () => viewer.classList.toggle("presentation-mode"));
    document.addEventListener("fullscreenchange", () => {
      viewer.classList.toggle("presentation-mode", Boolean(document.fullscreenElement));
      renderContactBar();
    });
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeId);
      resizeId = window.setTimeout(renderContactBar, 120);
    });
    window.addEventListener("storage", async (event) => {
      if (event.key === SETTINGS_KEY) {
        settings = await readSettings();
        applySettings();
        refreshImages(true);
      }
    });
    refreshImages(false);
  }

  async function readSettings() {
    const fileSettings = await readFileSettings();
    const localSettings = readLocalSettings();
    return mergeSettings(fileSettings, localSettings);
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

  function mergeSettings(fileSettings, localSettings) {
    const contactBar = {
      ...(fileSettings.contactBar || {}),
      ...(localSettings.contactBar || {})
    };
    if (Array.isArray(localSettings.contactBar?.items)) {
      contactBar.items = localSettings.contactBar.items;
    } else if (Array.isArray(fileSettings.contactBar?.items)) {
      contactBar.items = fileSettings.contactBar.items;
    }
    return normalizeSettings({ ...fileSettings, ...localSettings, contactBar });
  }

  function normalizeSettings(saved) {
    saved = saved || {};
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      contactBar: {
        ...DEFAULT_SETTINGS.contactBar,
        ...(saved.contactBar || {}),
        items: Array.isArray(saved.contactBar?.items) ? saved.contactBar.items : DEFAULT_SETTINGS.contactBar.items
      }
    };
  }

  function applySettings() {
    viewer.dataset.effect = settings.transitionType;
    viewer.classList.toggle("no-decor", !settings.decorativeBackground);
    [currentImage, nextImage].forEach((image) => {
      image.style.transitionDuration = `${settings.transitionMs}ms`;
    });
    renderContactBar();
    window.clearInterval(pollId);
    pollId = window.setInterval(() => refreshImages(true), settings.pollSeconds * 1000);
    scheduleNext();
  }

  function renderContactBar() {
    const config = settings.contactBar;
    const items = (config.items || []).filter((item) => item && item.value && item.enabled !== false);
    contactBar.replaceChildren();
    contactBar.classList.toggle("is-hidden", !config.enabled || !items.length);
    contactBar.dataset.mode = config.mode;
    contactBar.style.setProperty("--ticker-duration", `${config.speed || DEFAULT_SETTINGS.contactBar.speed}s`);

    if (!config.enabled || !items.length) {
      return;
    }

    const track = document.createElement("div");
    track.className = "contact-track";
    const group = createContactGroup(items);
    track.appendChild(group);

    if (config.mode === "marquee") {
      window.requestAnimationFrame(() => setupMarqueeTrack(track, group, items));
    }

    contactBar.appendChild(track);
  }

  function setupMarqueeTrack(track, group, items) {
    const barWidth = Math.ceil(contactBar.getBoundingClientRect().width);
    if (!barWidth) {
      return;
    }

    track.append(createRepeatMarker(), createContactGroup(items, true));
    const groups = track.querySelectorAll(".contact-group");
    const tickerDistance = Math.ceil(groups[1].offsetLeft - groups[0].offsetLeft);
    if (!tickerDistance) {
      return;
    }

    const copiesNeeded = Math.max(3, Math.ceil((barWidth + tickerDistance) / tickerDistance) + 1);
    for (let copy = 2; copy < copiesNeeded; copy += 1) {
      track.append(createRepeatMarker(), createContactGroup(items, true));
    }

    track.style.setProperty("--ticker-distance", `${tickerDistance}px`);
    track.classList.add("is-ready");
  }

  function createContactGroup(items, isClone = false) {
    const group = document.createElement("div");
    group.className = "contact-group";
    if (isClone) {
      group.setAttribute("aria-hidden", "true");
    }
    items.forEach((item) => {
      group.appendChild(createContactItem(item));
    });
    return group;
  }

  function createRepeatMarker() {
    const marker = document.createElement("span");
    marker.className = "contact-repeat-marker";
    marker.setAttribute("aria-hidden", "true");
    return marker;
  }

  function createContactItem(item) {
    const wrapper = document.createElement("span");
    wrapper.className = `contact-item contact-${item.type || "other"}`;

    const value = document.createElement("span");
    value.className = "contact-value";
    value.textContent = item.value;

    const href = getContactHref(item);
    const content = href ? document.createElement("a") : document.createElement("span");
    content.setAttribute("aria-label", `${item.label || getContactLabel(item.type)} ${item.value}`);
    if (href) {
      content.href = href;
      content.target = "_blank";
      content.rel = "noreferrer";
    }
    content.append(createContactIcon(item.type), value);
    wrapper.appendChild(content);
    return wrapper;
  }

  function createContactIcon(type) {
    const icon = document.createElement("span");
    icon.className = "contact-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = getContactIconSvg(type);
    return icon;
  }

  function getContactIconSvg(type) {
    const icons = {
      instagram: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg>',
      tiktok: '<svg viewBox="0 0 24 24"><path d="M14 3v10.3a4.4 4.4 0 1 1-4.4-4.4"></path><path d="M14 5.5c1.2 2.4 3 3.7 5.5 3.9"></path></svg>',
      email: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m4 7 8 6 8-6"></path></svg>',
      phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.4 2.1L8.1 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.6 1.9Z"></path></svg>',
      web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18"></path><path d="M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z"></path></svg>',
      other: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"></circle><path d="M8 12h8"></path><path d="M12 8v8"></path></svg>'
    };
    return icons[type] || icons.other;
  }

  function getContactLabel(type) {
    const labels = {
      instagram: "Instagram",
      tiktok: "TikTok",
      email: "Correo",
      phone: "Contacto",
      web: "Web",
      other: "Info"
    };
    return labels[type] || labels.other;
  }

  function getContactHref(item) {
    if (item.url) {
      return item.url.includes("://") ? item.url : `https://${item.url}`;
    }
    if (item.type === "instagram") {
      return `https://www.instagram.com/${item.value.replace(/^@/, "")}`;
    }
    if (item.type === "tiktok") {
      return `https://www.tiktok.com/@${item.value.replace(/^@/, "")}`;
    }
    if (item.type === "email") {
      return `mailto:${item.value}`;
    }
    if (item.type === "phone") {
      return `tel:${item.value.replace(/\s+/g, "")}`;
    }
    return "";
  }

  async function refreshImages(isPolling) {
    try {
      const freshImages = await fetchImages();
      if (!freshImages.length) {
        throw new Error("La fuente no contiene imagenes compatibles.");
      }
      images = freshImages.slice(0, 200);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ images, savedAt: Date.now() }));
      hideStatus();
      if (!currentImage.src) {
        index = pickStartIndex();
        showInitialImage();
      }
    } catch (error) {
      const cached = readCachedImages();
      if (cached.length) {
        images = cached;
        if (!currentImage.src) {
          index = pickStartIndex();
          showInitialImage();
        }
        showStatus("Sin conexion con la fuente. Mostrando la ultima lista guardada.");
      } else {
        showStatus(isPolling ? "No se pudo actualizar la lista de fotos." : "No hay fotos disponibles todavia.");
      }
    }
  }

  async function fetchImages() {
    if (settings.sourceType === "drive") {
      return fetchDriveImages();
    }

    const url = settings.sourceType === "json" ? settings.manifestUrl : settings.manifestUrl || "manifest.json";
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const list = Array.isArray(payload) ? payload : payload.images;
    return normalizeImages(list || [], url);
  }

  async function fetchDriveImages() {
    const folderId = getDriveFolderId(settings.driveFolderId);
    if (!folderId || !settings.driveApiKey) {
      throw new Error("Falta folder ID o API key de Google Drive.");
    }
    const query = encodeURIComponent(`'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`);
    const fields = encodeURIComponent("files(id,name,mimeType,modifiedTime)");
    const url = `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=createdTime desc&fields=${fields}&key=${encodeURIComponent(settings.driveApiKey)}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Google Drive HTTP ${response.status}`);
    }
    const payload = await response.json();
    return (payload.files || []).map((file) => ({
      id: file.id,
      title: file.name,
      url: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w2400`,
      updatedAt: file.modifiedTime
    }));
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

  function normalizeImages(list) {
    return list
      .map((item) => {
        const url = typeof item === "string" ? item : item.url || item.src;
        if (!url) {
          return null;
        }
        return {
          title: item.title || item.name || "",
          url: new URL(url, window.location.href.replace(/[^/]*$/, "")).href
        };
      })
      .filter(Boolean);
  }

  function readCachedImages() {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      return Array.isArray(cached.images) ? cached.images : [];
    } catch (error) {
      return [];
    }
  }

  function pickStartIndex() {
    return settings.playOrder === "random" ? Math.floor(Math.random() * images.length) : 0;
  }

  function showInitialImage() {
    const image = images[index];
    currentImage.src = image.url;
    currentImage.alt = image.title || "Fotografia del evento";
    preloadNext();
    scheduleNext();
  }

  function scheduleNext() {
    window.clearTimeout(timerId);
    if (images.length > 1) {
      timerId = window.setTimeout(advance, settings.intervalSeconds * 1000);
    }
  }

  function advance() {
    if (transitioning || images.length < 2) {
      scheduleNext();
      return;
    }

    const targetIndex = getNextIndex();
    const target = images[targetIndex];
    transitioning = true;
    nextImage.src = target.url;
    nextImage.alt = target.title || "Fotografia del evento";
    nextImage.className = "slide next";
    currentImage.className = "slide current";

    window.requestAnimationFrame(() => {
      viewer.classList.add("is-transitioning");
      window.setTimeout(() => {
        resetToTargetImage(target);
        index = targetIndex;
        transitioning = false;
        preloadNext();
        scheduleNext();
      }, getTransitionDuration() + 60);
    });
  }

  function resetToTargetImage(target) {
    viewer.classList.add("is-resetting");
    currentImage.src = target.url;
    currentImage.alt = target.title || "Fotografia del evento";
    nextImage.removeAttribute("src");
    nextImage.alt = "";
    viewer.classList.remove("is-transitioning");
    void viewer.offsetWidth;
    viewer.classList.remove("is-resetting");
  }

  function getTransitionDuration() {
    return settings.transitionType === "none" ? 1 : settings.transitionMs;
  }

  function getNextIndex() {
    if (settings.playOrder === "random") {
      if (images.length < 3) {
        return index === 0 ? 1 : 0;
      }
      let next = index;
      while (next === index) {
        next = Math.floor(Math.random() * images.length);
      }
      return next;
    }
    return (index + 1) % images.length;
  }

  function preloadNext() {
    if (images.length < 2) {
      return;
    }
    const preloader = new Image();
    preloader.src = images[getNextIndex()].url;
  }

  function enterPresentationMode() {
    viewer.classList.add("presentation-mode");
    if (viewer.requestFullscreen) {
      viewer.requestFullscreen().catch(() => {});
    }
  }

  function handleStageTouchEnd() {
    const now = Date.now();
    if (now - lastStageTap < 320) {
      enterPresentationMode();
    }
    lastStageTap = now;
  }

  function showStatus(message) {
    status.textContent = message;
    status.classList.remove("is-hidden");
  }

  function hideStatus() {
    status.classList.add("is-hidden");
  }
})();
