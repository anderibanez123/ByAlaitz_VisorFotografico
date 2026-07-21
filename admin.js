(function () {
  "use strict";

  const SETTINGS_KEY = "superrutas.viewer.settings";
  const CONFIG_URL = "../config.json";
  const DEFAULT_DRIVE_FOLDER_ID = "12yEeMDnOLoU2h4vDtqDD2ICxJEm1xSqQ";
  const DEFAULT_DRIVE_QR = "../assets/drive-upload-qr.png";
  const DEFAULT_PASSCODE = "stand2026";
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

  const lockPanel = document.getElementById("lockPanel");
  const settingsPanel = document.getElementById("settingsPanel");
  const unlockForm = document.getElementById("unlockForm");
  const passcodeInput = document.getElementById("passcodeInput");
  const form = document.getElementById("settingsForm");
  const saveButton = document.getElementById("saveButton");
  const exportConfigButton = document.getElementById("exportConfigButton");
  const resetButton = document.getElementById("resetButton");
  const saveStatus = document.getElementById("saveStatus");
  const contactItems = document.getElementById("contactItems");
  const addContactItem = document.getElementById("addContactItem");
  const driveQrCard = document.getElementById("driveQrCard");
  const driveQrImage = document.getElementById("driveQrImage");
  const driveFolderLink = document.getElementById("driveFolderLink");
  let autosaveId = null;

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
    contactBarEnabled: document.getElementById("contactBarEnabled"),
    contactBarMode: document.getElementById("contactBarMode"),
    contactBarSpeed: document.getElementById("contactBarSpeed")
  };

  const outputs = {
    intervalSeconds: document.getElementById("intervalOutput"),
    transitionMs: document.getElementById("transitionOutput"),
    pollSeconds: document.getElementById("pollOutput"),
    contactBarSpeed: document.getElementById("contactBarSpeedOutput")
  };

  unlockForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (passcodeInput.value === DEFAULT_PASSCODE) {
      localStorage.setItem("superrutas.admin.unlocked", "true");
      showSettings();
      return;
    }
    passcodeInput.value = "";
    passcodeInput.placeholder = "Clave incorrecta";
  });

  form.addEventListener("input", () => {
    updateOutputs();
    scheduleAutosave();
  });
  form.addEventListener("change", scheduleAutosave);
  contactItems.addEventListener("click", handleContactItemClick);
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

  if (localStorage.getItem("superrutas.admin.unlocked") === "true") {
    showSettings();
  }

  async function showSettings() {
    lockPanel.classList.add("hidden");
    settingsPanel.classList.remove("hidden");
    populate(await readSettings());
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
    fields.contactBarEnabled.checked = settings.contactBar.enabled;
    fields.contactBarMode.value = settings.contactBar.mode;
    fields.contactBarSpeed.value = settings.contactBar.speed;
    renderContactRows(settings.contactBar.items);
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
      contactBar: {
        enabled: fields.contactBarEnabled.checked,
        mode: fields.contactBarMode.value,
        speed: Number(fields.contactBarSpeed.value),
        items: collectContactItems()
      }
    };
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
    outputs.contactBarSpeed.textContent = `${fields.contactBarSpeed.value} s por vuelta`;
    updateDriveQr();
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

  function report(message) {
    saveStatus.textContent = message;
    window.setTimeout(() => {
      if (saveStatus.textContent === message) {
        saveStatus.textContent = "";
      }
    }, 3500);
  }
})();
