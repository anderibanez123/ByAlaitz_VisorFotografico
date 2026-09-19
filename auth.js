/**
 * Acceso local del visor, el admin y la guia.
 *
 * Sustituye a Supabase Auth. La contrasena no se guarda en ningun sitio.
 *
 * Como funciona
 * -------------
 * Al entrar se pasa lo tecleado por PBKDF2-SHA256 con la sal de abajo. El
 * resultado (el "testigo") no se publica: de el solo se publica su SHA-256,
 * en TOKEN_CHECK. Para dar por buena la clave se compara SHA-256(testigo) con
 * TOKEN_CHECK. Para recordar la sesion se guarda el testigo en localStorage.
 *
 * Asi, quien lea este archivo no puede fabricarse una sesion: de TOKEN_CHECK
 * no se puede volver al testigo sin conocer la contrasena.
 *
 * LIMITE IMPORTANTE
 * -----------------
 * La comprobacion ocurre entera en el navegador. Es un candado disuasorio para
 * el dispositivo del stand, NO seguridad real: quien sepa usar las
 * herramientas de desarrollo puede saltarse la pantalla sin la clave, y quien
 * se lleve este archivo puede probar contrasenas sin limite contra TOKEN_CHECK.
 * Para proteccion de verdad hace falta un servidor que valide la contrasena y
 * que solo entregue el contenido si es correcta.
 *
 * Cambiar la contrasena
 * ---------------------
 *   node -e "const c=require('crypto');const s=c.randomBytes(16);
 *   const t=c.pbkdf2Sync('LA_NUEVA',s,250000,32,'sha256');
 *   console.log('salt:',s.toString('base64'));
 *   console.log('check:',c.createHash('sha256').update(t).digest('base64'))"
 *
 * Pegar los dos valores en CREDENTIALS. Las sesiones abiertas se invalidan
 * solas, porque el testigo guardado deja de cuadrar con TOKEN_CHECK.
 */
(function (global) {
  "use strict";

  const CREDENTIALS = {
    username: "admin",
    algorithm: "PBKDF2-SHA256",
    iterations: 250000,
    keyLength: 32,
    salt: "aIr9E1WzOq+0vLzd6epJpA==",
    tokenCheck: "xWtEckgE11qVVYnjbLlMuPal8qqVzAyjH5Rj5Vo9TQo="
  };

  const SESSION_KEY = "byalaitz.auth.session";

  function base64ToBytes(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function bytesToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function isAvailable() {
    return Boolean(global.crypto && global.crypto.subtle);
  }

  /** Testigo derivado de la contrasena. Nunca se publica. */
  async function deriveToken(password) {
    const keyMaterial = await global.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );
    const bits = await global.crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: base64ToBytes(CREDENTIALS.salt),
        iterations: CREDENTIALS.iterations,
        hash: "SHA-256"
      },
      keyMaterial,
      CREDENTIALS.keyLength * 8
    );
    return bytesToBase64(bits);
  }

  async function checksumOf(token) {
    const digest = await global.crypto.subtle.digest("SHA-256", base64ToBytes(token));
    return bytesToBase64(digest);
  }

  // Comparacion sin salida temprana: no aporta mucho en cliente, pero evita
  // regalar informacion por el tiempo de respuesta.
  function sameHash(a, b) {
    if (a.length !== b.length) {
      return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
      diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
  }

  function isValidUser(username) {
    return String(username || "").trim().toLowerCase() === CREDENTIALS.username;
  }

  async function tokenIsValid(token) {
    if (!token) {
      return false;
    }
    try {
      return sameHash(await checksumOf(token), CREDENTIALS.tokenCheck);
    } catch (error) {
      return false;
    }
  }

  /** Comprueba usuario y contrasena sin abrir sesion. */
  async function verify(username, password) {
    if (!isAvailable() || !isValidUser(username) || !password) {
      return false;
    }
    try {
      return tokenIsValid(await deriveToken(password));
    } catch (error) {
      return false;
    }
  }

  /** Verifica y, si es correcto, deja la sesion abierta en este navegador. */
  async function login(username, password) {
    if (!isAvailable() || !isValidUser(username) || !password) {
      return false;
    }
    let token;
    try {
      token = await deriveToken(password);
    } catch (error) {
      return false;
    }
    if (!await tokenIsValid(token)) {
      return false;
    }
    try {
      localStorage.setItem(SESSION_KEY, token);
    } catch (error) {
      // Sin localStorage la sesion dura solo lo que dure la pagina.
    }
    return true;
  }

  /**
   * Sesion guardada y valida para la contrasena actual.
   * Es asincrono porque hay que rehacer el resumen del testigo.
   */
  async function hasSession() {
    if (!isAvailable()) {
      return false;
    }
    try {
      return await tokenIsValid(localStorage.getItem(SESSION_KEY));
    } catch (error) {
      return false;
    }
  }

  function logout() {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (error) {
      // Nada que limpiar.
    }
  }

  global.ByAlaitzAuth = {
    isAvailable,
    verify,
    login,
    hasSession,
    logout,
    username: CREDENTIALS.username
  };
})(window);
