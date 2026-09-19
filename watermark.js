/**
 * Marca de agua aplicada en el navegador, al cargar cada foto.
 *
 * La imagen se descarga de Google, se dibuja en un canvas con la marca encima
 * y lo que acaba en la pagina es esa version marcada. Asi, arrastrar la foto,
 * guardarla con el menu del raton o compartir el enlace que ve el visitante
 * entrega siempre una imagen con la firma.
 *
 * LIMITE: la marca se pinta aqui, no en el archivo de Google. Quien sepa mirar
 * la pestana de Red del navegador puede llegar al original sin marcar. Esto
 * levanta el liston del camino facil; no sustituye a publicar en Drive copias
 * ya marcadas y reducidas.
 *
 * Requiere que la imagen se sirva con CORS. Por eso se usa el dominio
 * lh3.googleusercontent.com (destino real de drive.google.com/thumbnail), que
 * responde con Access-Control-Allow-Origin. Si la descarga con CORS falla, se
 * devuelve la URL original sin marcar para no dejar la galeria en blanco.
 */
(function (global) {
  "use strict";

  const DEFAULTS = {
    text: "ByAlaitz",
    // Separacion entre repeticiones, como fraccion del lado menor.
    tileGap: 0.32,
    // Tamano de letra, como fraccion del lado menor.
    fontScale: 0.052,
    opacity: 0.2,
    angle: -30,
    quality: 0.9
  };

  const cache = new Map();
  const MAX_CACHE = 80;

  /** Convierte cualquier URL de Drive al dominio que permite CORS. */
  function toCorsUrl(url) {
    const raw = String(url || "");
    const thumb = raw.match(/drive\.google\.com\/thumbnail\?(.*)$/);
    if (thumb) {
      const params = new URLSearchParams(thumb[1]);
      const id = params.get("id");
      const size = params.get("sz") || "w1000";
      if (id) {
        return `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=${size}`;
      }
    }
    return raw;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo cargar con CORS"));
      image.src = url;
    });
  }

  function paint(image, options) {
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);

    const minSide = Math.min(canvas.width, canvas.height);
    const fontSize = Math.max(11, Math.round(minSide * options.fontScale));
    ctx.font = `800 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const stepX = ctx.measureText(options.text).width + minSide * options.tileGap;
    const stepY = fontSize + minSide * options.tileGap;
    const diagonal = Math.hypot(canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((options.angle * Math.PI) / 180);
    ctx.globalAlpha = options.opacity;
    // Sombra fina para que la marca se lea igual sobre cielo o sobre sombra.
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = Math.max(2, Math.round(fontSize * 0.14));
    ctx.fillStyle = "#ffffff";

    for (let y = -diagonal / 2; y <= diagonal / 2; y += stepY) {
      // Filas alternas desplazadas: evita que la marca forme columnas rectas.
      const offset = (Math.round(y / stepY) % 2) * (stepX / 2);
      for (let x = -diagonal / 2; x <= diagonal / 2; x += stepX) {
        ctx.fillText(options.text, x + offset, y);
      }
    }
    ctx.restore();
    return canvas;
  }

  function canvasToUrl(canvas, quality) {
    return new Promise((resolve) => {
      if (!canvas.toBlob) {
        resolve(canvas.toDataURL("image/jpeg", quality));
        return;
      }
      canvas.toBlob(
        (blob) => resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/jpeg", quality)),
        "image/jpeg",
        quality
      );
    });
  }

  function remember(key, promise) {
    cache.set(key, promise);
    if (cache.size > MAX_CACHE) {
      const [oldest] = cache.keys();
      const stale = cache.get(oldest);
      cache.delete(oldest);
      // Libera memoria del blob descartado, ya sin uso en pantalla.
      Promise.resolve(stale).then((url) => {
        if (typeof url === "string" && url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }).catch(() => {});
    }
    return promise;
  }

  /**
   * Devuelve una URL lista para un <img>, con la marca ya aplicada.
   * Si algo falla, devuelve la URL original para no romper la galeria.
   */
  function apply(url, overrides) {
    if (!url) {
      return Promise.reject(new Error("Imagen sin URL."));
    }
    const options = { ...DEFAULTS, ...(overrides || {}) };
    const key = `${url}|${options.text}|${options.opacity}|${options.fontScale}`;
    if (cache.has(key)) {
      return cache.get(key);
    }
    const promise = loadImage(toCorsUrl(url))
      .then((image) => canvasToUrl(paint(image, options), options.quality))
      .catch(() => url);
    return remember(key, promise);
  }

  global.ByAlaitzWatermark = { apply, toCorsUrl, defaults: DEFAULTS };
})(window);
