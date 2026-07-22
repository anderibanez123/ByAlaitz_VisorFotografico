(function () {
  "use strict";

  const SETTINGS_KEY = "superrutas.viewer.settings";
  const CONFIG_URL = "../config.json";
  const DEFAULT_DRIVE_FOLDER_ID = "12yEeMDnOLoU2h4vDtqDD2ICxJEm1xSqQ";
  const DEFAULT_DRIVE_QR = "../assets/drive-upload-qr.png";
  const LOGIN_ALIASES = {
    admin: ["anderibanez123", "gmail.com"].join("@")
  };
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
    supabase: {
      url: "https://ixhydcablbjkkzchyjbq.supabase.co",
      publishableKey: "sb_publishable_lyR6MvOSNxbqdD21XN23fQ_w8jXqgtq"
    },
    gallery: {
      rootSectionTitle: "Fotos recientes",
      emptyMessage: "Todavia no hay eventos publicados.",
      sections: []
    },
    background: {
      mode: "default",
      color: "#050505",
      imageDataUrl: "",
      imageBrightness: 70,
      imageOpacity: 100,
      imageBlur: 0,
      imageSaturation: 100
    },
    contactBar: {
      enabled: true,
      mode: "fixed",
      speed: 28,
      items: [
        { type: "instagram", label: "Instagram", value: "@tu_instagram", url: "" },
        { type: "tiktok", label: "TikTok", value: "@tu_tiktok", url: "" },
        { type: "phone", label: "Contacto", value: "+34 600 000 000", url: "" }
      ]
    }
  };

  const lockPanel = document.getElementById("lockPanel");
  const settingsPanel = document.getElementById("settingsPanel");
  const unlockForm = document.getElementById("unlockForm");
  const emailInput = document.getElementById("emailInput");
  const passwordInput = document.getElementById("passwordInput");
  const authStatus = document.getElementById("authStatus");
  const form = document.getElementById("settingsForm");
  const saveButton = document.getElementById("saveButton");
  const exportConfigButton = document.getElementById("exportConfigButton");
  const resetButton = document.getElementById("resetButton");
  const logoutButton = document.getElementById("logoutButton");
  const currentUserEmail = document.getElementById("currentUserEmail");
  const saveStatus = document.getElementById("saveStatus");
  const contactItems = document.getElementById("contactItems");
  const addContactItem = document.getElementById("addContactItem");
  const driveQrCard = document.getElementById("driveQrCard");
  const driveQrImage = document.getElementById("driveQrImage");
  const driveFolderLink = document.getElementById("driveFolderLink");
  const refreshGalleryImages = document.getElementById("refreshGalleryImages");
  const addGallerySection = document.getElementById("addGallerySection");
  const galleryAdminStatus = document.getElementById("galleryAdminStatus");
  const gallerySectionsEditor = document.getElementById("gallerySectionsEditor");
  const backgroundImageStatus = document.getElementById("backgroundImageStatus");
  const removeBackgroundImage = document.getElementById("removeBackgroundImage");
  let autosaveId = null;
  let currentBackgroundImageDataUrl = "";
  let currentGalleryImages = [];
  let supabaseClient = null;
  let currentSupabaseConfig = { ...DEFAULT_SETTINGS.supabase };

  const fields = {
    intervalSeconds: document.getElementById("intervalSeconds"),
    transitionMs: document.getElementById("transitionMs"),
    transitionType: document.getElementById("transitionType"),
    playOrder: document.getElementById("playOrder"),
    decorativeBackground: document.getElementById("decorativeBackground"),
    sourceType: document.getElementById("sourceType"),
    manifestUrl: document.getElementById("manifestUrl"),
    driveFolderId: document.getElementById("driveFolderId"),
    uploadTargetUrl: document.getElementById("uploadTargetUrl"),
    driveApiKey: document.getElementById("driveApiKey"),
    pollSeconds: document.getElementById("pollSeconds"),
    backgroundMode: document.getElementById("backgroundMode"),
    backgroundColor: document.getElementById("backgroundColor"),
    backgroundImageInput: document.getElementById("backgroundImageInput"),
    backgroundBrightness: document.getElementById("backgroundBrightness"),
    backgroundOpacity: document.getElementById("backgroundOpacity"),
    backgroundBlur: document.getElementById("backgroundBlur"),
    backgroundSaturation: document.getElementById("backgroundSaturation"),
    contactBarEnabled: document.getElementById("contactBarEnabled"),
    contactBarMode: document.getElementById("contactBarMode"),
    contactBarSpeed: document.getElementById("contactBarSpeed")
  };

  const outputs = {
    intervalSeconds: document.getElementById("intervalOutput"),
    transitionMs: document.getElementById("transitionOutput"),
    pollSeconds: document.getElementById("pollOutput"),
    backgroundBrightness: document.getElementById("backgroundBrightnessOutput"),
    backgroundOpacity: document.getElementById("backgroundOpacityOutput"),
    backgroundBlur: document.getElementById("backgroundBlurOutput"),
    backgroundSaturation: document.getElementById("backgroundSaturationOutput"),
    contactBarSpeed: document.getElementById("contactBarSpeedOutput")
  };

  unlockForm.addEventListener("submit", handleLogin);
  logoutButton.addEventListener("click", handleLogout);

  form.addEventListener("input", () => {
    updateOutputs();
    scheduleAutosave();
  });
  form.addEventListener("change", scheduleAutosave);
  fields.backgroundImageInput.addEventListener("change", handleBackgroundImageChange);
  removeBackgroundImage.addEventListener("click", () => {
    currentBackgroundImageDataUrl = "";
    fields.backgroundImageInput.value = "";
    updateOutputs();
    scheduleAutosave();
  });
  contactItems.addEventListener("click", handleContactItemClick);
  gallerySectionsEditor.addEventListener("input", scheduleAutosave);
  gallerySectionsEditor.addEventListener("change", scheduleAutosave);
  gallerySectionsEditor.addEventListener("click", handleGalleryEditorClick);
  refreshGalleryImages.addEventListener("click", loadGalleryImages);
  addGallerySection.addEventListener("click", () => {
    const section = { id: createSectionId(), title: "Nuevo evento", imageIds: [] };
    gallerySectionsEditor.appendChild(createGallerySectionRow(section));
    scheduleAutosave();
  });
  addContactItem.addEventListener("click", () => {
    const item = createContactRow({ type: "other", label: "Red social", value: "", url: "" });
    contactItems.appendChild(item);
    item.querySelector("[data-contact-field='value']").focus();
    scheduleAutosave();
  });
  saveButton.addEventListener("click", saveSettings);
  exportConfigButton.addEventListener("click", exportConfig);
  resetButton.addEventListener("click", () => {
    writeSettings(DEFAULT_SETTINGS);
    populate(DEFAULT_SETTINGS);
    report("MVP restaurado.");
  });

  initAuth();

  async function initAuth() {
    const settings = await readSettings();
    setupSupabase(settings.supabase);

    if (!supabaseClient) {
      showLock("No se pudo cargar Supabase. Revisa la conexion.");
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      showLock("No se pudo comprobar la sesion.");
      return;
    }

    if (data.session) {
      showSettings(settings, data.session.user);
    } else {
      showLock();
    }

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (session) {
        showSettings(null, session.user);
      } else {
        showLock();
      }
    });
  }

  function setupSupabase(config) {
    currentSupabaseConfig = {
      ...DEFAULT_SETTINGS.supabase,
      ...(config || {})
    };

    if (!window.supabase || !currentSupabaseConfig.url || !currentSupabaseConfig.publishableKey) {
      supabaseClient = null;
      return;
    }

    supabaseClient = window.supabase.createClient(
      currentSupabaseConfig.url,
      currentSupabaseConfig.publishableKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      }
    );
  }

  function showLock(message = "") {
    lockPanel.classList.remove("hidden");
    settingsPanel.classList.add("hidden");
    authStatus.textContent = message;
  }

  async function showSettings(settings = null, user = null) {
    lockPanel.classList.add("hidden");
    settingsPanel.classList.remove("hidden");
    currentUserEmail.textContent = "";
    populate(settings || await readSettings());
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
      },
      supabase: {
        ...DEFAULT_SETTINGS.supabase,
        ...(saved.supabase || {})
      },
      gallery: {
        ...DEFAULT_SETTINGS.gallery,
        ...(saved.gallery || {}),
        sections: Array.isArray(saved.gallery?.sections) ? saved.gallery.sections : DEFAULT_SETTINGS.gallery.sections
      },
      background: {
        ...DEFAULT_SETTINGS.background,
        ...(saved.background || {})
      }
    };
  }

  function populate(settings) {
    fields.intervalSeconds.value = settings.intervalSeconds;
    fields.transitionMs.value = settings.transitionMs;
    fields.transitionType.value = settings.transitionType;
    fields.playOrder.value = settings.playOrder;
    fields.decorativeBackground.checked = settings.decorativeBackground;
    fields.sourceType.value = settings.sourceType;
    fields.manifestUrl.value = settings.manifestUrl;
    fields.driveFolderId.value = settings.driveFolderId;
    fields.uploadTargetUrl.value = settings.uploadTargetUrl || "";
    fields.driveApiKey.value = settings.driveApiKey;
    fields.pollSeconds.value = settings.pollSeconds;
    fields.backgroundMode.value = settings.background.mode;
    fields.backgroundColor.value = settings.background.color;
    currentBackgroundImageDataUrl = settings.background.imageDataUrl || "";
    fields.backgroundBrightness.value = settings.background.imageBrightness;
    fields.backgroundOpacity.value = settings.background.imageOpacity;
    fields.backgroundBlur.value = settings.background.imageBlur;
    fields.backgroundSaturation.value = settings.background.imageSaturation;
    fields.contactBarEnabled.checked = settings.contactBar.enabled;
    fields.contactBarMode.value = settings.contactBar.mode;
    fields.contactBarSpeed.value = settings.contactBar.speed;
    renderContactRows(settings.contactBar.items);
    renderGallerySections(settings.gallery.sections);
    updateOutputs();
  }

  function collect() {
    return {
      intervalSeconds: Number(fields.intervalSeconds.value),
      transitionMs: Number(fields.transitionMs.value),
      transitionType: fields.transitionType.value,
      playOrder: fields.playOrder.value,
      decorativeBackground: fields.decorativeBackground.checked,
      sourceType: fields.sourceType.value,
      manifestUrl: fields.manifestUrl.value.trim() || "manifest.json",
      driveFolderId: getDriveFolderId(fields.driveFolderId.value),
      uploadTargetUrl: fields.uploadTargetUrl.value.trim(),
      driveApiKey: fields.driveApiKey.value.trim(),
      pollSeconds: Number(fields.pollSeconds.value),
      supabase: currentSupabaseConfig,
      gallery: {
        rootSectionTitle: "Fotos recientes",
        emptyMessage: "Todavia no hay eventos publicados.",
        sections: collectGallerySections()
      },
      background: {
        mode: fields.backgroundMode.value,
        color: fields.backgroundColor.value,
        imageDataUrl: currentBackgroundImageDataUrl,
        imageBrightness: Number(fields.backgroundBrightness.value),
        imageOpacity: Number(fields.backgroundOpacity.value),
        imageBlur: Number(fields.backgroundBlur.value),
        imageSaturation: Number(fields.backgroundSaturation.value)
      },
      contactBar: {
        enabled: fields.contactBarEnabled.checked,
        mode: fields.contactBarMode.value,
        speed: Number(fields.contactBarSpeed.value),
        items: collectContactItems()
      }
    };
  }

  async function handleLogin(event) {
    event.preventDefault();
    if (!supabaseClient) {
      authStatus.textContent = "Supabase no esta disponible.";
      return;
    }

    authStatus.textContent = "Entrando...";
    const loginEmails = getLoginEmails(emailInput.value);
    let error = null;

    for (const email of loginEmails) {
      const result = await supabaseClient.auth.signInWithPassword({
        email,
        password: passwordInput.value
      });
      error = result.error;
      if (!error) {
        break;
      }
    }

    if (error) {
      passwordInput.value = "";
      authStatus.textContent = "Email o contrasena incorrectos.";
      return;
    }

    passwordInput.value = "";
    authStatus.textContent = "";
  }

  function getLoginEmails(value) {
    const login = value.trim().toLowerCase();
    const aliases = LOGIN_ALIASES[login];
    return Array.isArray(aliases) ? aliases : [aliases || login];
  }

  async function handleLogout() {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    showLock("Sesion cerrada.");
  }

  function saveSettings() {
    const settings = collect();
    writeSettings(settings);
    report("Guardado y recordado para el proximo arranque.");
  }

  function exportConfig() {
    const blob = new Blob([JSON.stringify(collect(), null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "config.json";
    link.click();
    URL.revokeObjectURL(url);
    report("config.json exportado. Sustituye el archivo del proyecto para fijarlo para todos.");
  }

  function writeSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveId);
    autosaveId = window.setTimeout(() => {
      writeSettings(collect());
      report("Guardado automaticamente.");
    }, 250);
  }

  function updateOutputs() {
    outputs.intervalSeconds.textContent = `${fields.intervalSeconds.value} s`;
    outputs.transitionMs.textContent = `${fields.transitionMs.value} ms`;
    outputs.pollSeconds.textContent = `${fields.pollSeconds.value} s`;
    outputs.backgroundBrightness.textContent = `${fields.backgroundBrightness.value}%`;
    outputs.backgroundOpacity.textContent = `${fields.backgroundOpacity.value}%`;
    outputs.backgroundBlur.textContent = `${fields.backgroundBlur.value}px`;
    outputs.backgroundSaturation.textContent = `${fields.backgroundSaturation.value}%`;
    backgroundImageStatus.textContent = currentBackgroundImageDataUrl ? "Imagen personalizada cargada" : "Sin imagen personalizada";
    outputs.contactBarSpeed.textContent = `${fields.contactBarSpeed.value} s por vuelta`;
    updateDriveQr();
  }

  async function handleBackgroundImageChange() {
    const file = fields.backgroundImageInput.files?.[0];
    if (!file) {
      return;
    }
    try {
      currentBackgroundImageDataUrl = await resizeImageFile(file, 1920);
      fields.backgroundMode.value = "image";
      updateOutputs();
      scheduleAutosave();
      report("Imagen de fondo cargada.");
    } catch (error) {
      fields.backgroundImageInput.value = "";
      report("No se pudo cargar la imagen de fondo.");
    }
  }

  function resizeImageFile(file, maxSide) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const image = new Image();
        image.onload = () => {
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.86));
        };
        image.onerror = reject;
        image.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function updateDriveQr() {
    const targetUrl = getUploadTargetUrl();
    driveQrCard.classList.toggle("is-hidden", !targetUrl);

    if (!targetUrl) {
      driveQrImage.removeAttribute("src");
      driveFolderLink.href = "#";
      return;
    }

    const folderId = getDriveFolderId(fields.driveFolderId.value);
    const qrUrl = targetUrl === getDriveFolderUrl(DEFAULT_DRIVE_FOLDER_ID)
      ? DEFAULT_DRIVE_QR
      : `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=8&data=${encodeURIComponent(targetUrl)}`;

    if (driveQrImage.src !== new URL(qrUrl, window.location.href).href) {
      driveQrImage.src = qrUrl;
    }
    driveFolderLink.href = targetUrl;
    driveFolderLink.textContent = fields.uploadTargetUrl.value.trim() ? "Abrir subida" : "Abrir carpeta";
  }

  function getUploadTargetUrl() {
    const uploadUrl = fields.uploadTargetUrl.value.trim();
    if (uploadUrl) {
      return uploadUrl;
    }
    const folderId = getDriveFolderId(fields.driveFolderId.value);
    return folderId ? getDriveFolderUrl(folderId) : "";
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

  function getDriveFolderUrl(folderId) {
    return `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}`;
  }

  function renderContactRows(items) {
    contactItems.replaceChildren(...items.map(createContactRow));
  }

  function createContactRow(item) {
    const row = document.createElement("div");
    row.className = "contact-row";
    row.innerHTML = `
      <label>
        Tipo
        <select data-contact-field="type">
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="email">Correo</option>
          <option value="phone">Telefono</option>
          <option value="web">Web</option>
          <option value="other">Otra red</option>
        </select>
      </label>
      <label>
        Nombre visible
        <input data-contact-field="label" type="text" maxlength="28">
      </label>
      <label>
        Usuario, correo o telefono
        <input data-contact-field="value" type="text" maxlength="80">
      </label>
      <label>
        Enlace opcional
        <input data-contact-field="url" type="url" maxlength="180" placeholder="https://...">
      </label>
      <label class="switch-row row-enabled">
        <input data-contact-field="enabled" type="checkbox">
        Visible
      </label>
      <button class="secondary-button small-button remove-contact" type="button">Quitar</button>
    `;
    row.querySelector("[data-contact-field='type']").value = item.type || "other";
    row.querySelector("[data-contact-field='label']").value = item.label || "";
    row.querySelector("[data-contact-field='value']").value = item.value || "";
    row.querySelector("[data-contact-field='url']").value = item.url || "";
    row.querySelector("[data-contact-field='enabled']").checked = item.enabled !== false;
    return row;
  }

  function collectContactItems() {
    return Array.from(contactItems.querySelectorAll(".contact-row"))
      .map((row) => ({
        type: row.querySelector("[data-contact-field='type']").value,
        label: row.querySelector("[data-contact-field='label']").value.trim(),
        value: row.querySelector("[data-contact-field='value']").value.trim(),
        url: row.querySelector("[data-contact-field='url']").value.trim(),
        enabled: row.querySelector("[data-contact-field='enabled']").checked
      }))
      .filter((item) => item.value);
  }

  function handleContactItemClick(event) {
    const button = event.target.closest(".remove-contact");
    if (!button) {
      return;
    }
    button.closest(".contact-row").remove();
    scheduleAutosave();
  }

  async function loadGalleryImages() {
    galleryAdminStatus.textContent = "Cargando fotos del Drive...";
    try {
      currentGalleryImages = await fetchDriveImagesForGallery();
      galleryAdminStatus.textContent = `${currentGalleryImages.length} fotos disponibles para la galeria.`;
      renderGallerySections(collectGallerySections());
    } catch (error) {
      galleryAdminStatus.textContent = "No se pudieron cargar las fotos. Revisa Drive, permisos y API key.";
    }
  }

  async function fetchDriveImagesForGallery() {
    const folderId = getDriveFolderId(fields.driveFolderId.value);
    const apiKey = fields.driveApiKey.value.trim();
    if (!folderId || !apiKey) {
      throw new Error("Falta folder ID o API key.");
    }

    const query = `'${folderId}' in parents and trashed=false and mimeType contains 'image/'`;
    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,mimeType,modifiedTime,createdTime)",
      orderBy: "createdTime desc",
      pageSize: "1000",
      key: apiKey
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Google Drive HTTP ${response.status}`);
    }
    const payload = await response.json();
    return (payload.files || []).map((file) => ({
      id: file.id,
      title: cleanImageTitle(file.name),
      thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w360`
    }));
  }

  function renderGallerySections(sections) {
    gallerySectionsEditor.replaceChildren(...(sections || []).map(createGallerySectionRow));
    if (!(sections || []).length) {
      galleryAdminStatus.textContent = galleryAdminStatus.textContent || "Sin galerias manuales. La pagina publica usara el modo automatico por carpetas.";
    }
  }

  function createGallerySectionRow(section) {
    const row = document.createElement("section");
    row.className = "gallery-section-row";
    row.dataset.gallerySectionId = section.id || createSectionId();
    row.dataset.selectedImageIds = JSON.stringify(section.imageIds || []);

    const selectedIds = new Set(section.imageIds || []);
    const choices = currentGalleryImages.length
      ? currentGalleryImages.map((image) => createGalleryImageChoice(image, selectedIds)).join("")
      : `<p class="field-note">Pulsa "Cargar fotos" para seleccionar imagenes. Seleccionadas ahora: ${selectedIds.size}.</p>`;

    row.innerHTML = `
      <div class="gallery-section-row-header">
        <label>
          Nombre de la galeria
          <input data-gallery-field="title" type="text" maxlength="80" value="${escapeHtml(section.title || "")}">
        </label>
        <button class="secondary-button small-button remove-gallery-section" type="button">Quitar</button>
      </div>
      <div class="gallery-image-picker">${choices}</div>
    `;
    return row;
  }

  function createGalleryImageChoice(image, selectedIds) {
    const checked = selectedIds.has(image.id) ? " checked" : "";
    return `
      <label class="gallery-image-choice">
        <input data-gallery-image-id="${escapeHtml(image.id)}" type="checkbox"${checked}>
        <img src="${escapeHtml(image.thumbnailUrl)}" alt="">
        <span>${escapeHtml(image.title)}</span>
      </label>
    `;
  }

  function collectGallerySections() {
    return Array.from(gallerySectionsEditor.querySelectorAll(".gallery-section-row"))
      .map((row) => ({
        id: row.dataset.gallerySectionId || createSectionId(),
        title: row.querySelector("[data-gallery-field='title']").value.trim(),
        imageIds: collectGallerySectionImageIds(row)
      }))
      .filter((section) => section.title);
  }

  function collectGallerySectionImageIds(row) {
    const checked = Array.from(row.querySelectorAll("[data-gallery-image-id]:checked")).map((input) => input.dataset.galleryImageId);
    if (currentGalleryImages.length || checked.length) {
      return checked;
    }
    try {
      const saved = JSON.parse(row.dataset.selectedImageIds || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function handleGalleryEditorClick(event) {
    const button = event.target.closest(".remove-gallery-section");
    if (!button) {
      return;
    }
    button.closest(".gallery-section-row").remove();
    scheduleAutosave();
  }

  function createSectionId() {
    return `galeria-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function cleanImageTitle(name) {
    return (name || "Fotografia").replace(/\.[a-z0-9]{2,5}$/i, "");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function report(message) {
    saveStatus.textContent = message;
    window.setTimeout(() => {
      if (saveStatus.textContent === message) {
        saveStatus.textContent = "";
      }
    }, 3500);
  }
})();




