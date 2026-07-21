# ByAlaitz - Visor web de fotografias para stand

## Objetivo

Este proyecto es una aplicacion web estatica para mostrar fotografias en bucle durante un evento de coches. Esta pensada para publicarse en GitHub Pages y funcionar en una tablet, portatil o monitor del stand.

Fecha objetivo indicada por el usuario: sabado 25 de julio de 2026. La idea es dejar margen para probar varios dias antes del evento.

## Estructura

- `index.html`: vista publica del visor. Debe quedar limpia para espectadores.
- `admin/index.html`: panel oculto de configuracion local.
- `styles.css`: estilos compartidos de visor y panel.
- `app.js`: logica de presentacion, polling, transiciones, pantalla completa y cache de imagenes.
- `admin.js`: logica del panel de configuracion.
- `config.json`: configuracion base compartida para cualquier persona que abra la app.
- `assets/drive-upload-qr.png`: QR local para abrir la carpeta de Google Drive configurada.
- `assets/favicon.png` y `assets/favicon-32.png`: iconos de pestana generados desde el logo.
- `manifest.json`: lista local de imagenes de prueba incluida en el repositorio.
- `scripts/optimize_images.py`: conversor local de fotografias a WebP optimizado y regenerador de `manifest.json`.
- `Imagenes/Mesa de trabajo 31.png`: logo/marca de agua.
- `Imagenes/Imagenes Audi A1 de prueba/`: fotografias locales de prueba.
- `Imagenes/Optimized/`: salida generada con imagenes WebP ligeras para el visor.

## Funcionamiento

El visor muestra una imagen a la vez con `object-fit: contain`, por lo que no recorta fotografias. Solo mantiene la foto actual y precarga la siguiente para evitar descargar toda la coleccion al iniciar.

La configuracion se guarda en `localStorage` bajo la clave:

```text
superrutas.viewer.settings
```

El panel admin autoguarda cada cambio en esa clave. El boton `Guardar` sigue existiendo como confirmacion manual, pero no es necesario pulsarlo para que la ultima configuracion sobreviva a cerrar y volver a abrir el navegador en el mismo origen.

La app tambien carga `config.json` como configuracion base compartida. Cualquier ajuste guardado en `localStorage` tiene prioridad en ese navegador. Para fijar una configuracion para todo el mundo, usar `Exportar config.json` desde admin y sustituir el archivo `config.json` del proyecto antes de publicar.

La ultima lista de imagenes valida se guarda en:

```text
superrutas.viewer.images
```

Si falla la conexion con Google Drive o el endpoint configurado, el visor usa esa lista cacheada para seguir funcionando.

La barra superior de contacto forma parte de la misma configuracion local. Cada item tiene `type`, `label`, `value`, `url` y `enabled`. En el visor se muestra como icono + valor, sin etiquetas largas. Si `url` esta vacio, el visor genera automaticamente `mailto:` para correo y `tel:` para telefono.

## Configuracion disponible

Desde `/admin/` se puede ajustar:

- Tiempo entre fotos: 1 a 60 segundos.
- Velocidad de transicion: 150 a 5000 ms.
- Efecto: fundido, deslizamiento horizontal, deslizamiento vertical, zoom suave, barrido lateral, desenfoque, elevacion suave, giro deportivo, volteo 3D o corte directo.
- Orden: secuencial o aleatorio.
- Fondo decorativo: activado o desactivado.
- Fuente de imagenes: manifest local, Google Drive publico o endpoint JSON publico.
- Polling: 30 a 120 segundos.
- Barra superior de contacto: activar/desactivar, texto fijo o deslizante, velocidad del desplazamiento y lista editable de redes/contacto.
- QR de subida: el admin muestra un QR pequeno que abre la URL de subida desde otro dispositivo. Si `URL para QR de subida` esta vacia, abre la carpeta de Drive configurada. Para la carpeta principal actual se usa `assets/drive-upload-qr.png`; si se cambia el destino, el admin intenta generar el QR desde un servicio externo.

La clave local inicial del panel es:

```text
stand2026
```

No es seguridad real de servidor. Solo evita toques accidentales en el dispositivo del stand.

## Fuentes de imagenes

## Optimizacion de imagenes

Las fotografias originales se conservan intactas. Antes de publicar o probar en serio, ejecutar:

```powershell
python scripts/optimize_images.py --max-side 2400 --quality 90
```

Esto crea WebP optimizados en `Imagenes/Optimized/` y actualiza `manifest.json` para que el visor use esos archivos. El ajuste `--quality 90` es visualmente muy fiel para pantalla y reduce mucho el peso. Si hiciera falta conversion sin perdida real de pixeles, usar:

```powershell
python scripts/optimize_images.py --lossless --force
```

La opcion sin perdida genera archivos mas grandes; para una pantalla de stand normalmente conviene `--quality 88` a `--quality 92` y `--max-side 2000` a `--max-side 2400`.

### Manifest local

Usa `manifest.json`. Es ideal para pruebas y para una version offline sencilla. En GitHub Pages se carga como archivo estatico.

Formato:

```json
{
  "images": [
    { "title": "Foto 1", "url": "ruta/foto-1.jpg" }
  ]
}
```

### Google Drive publico

El panel acepta:

- `Google Drive folder ID`
- `Google API key`

La carpeta debe estar compartida publicamente y la API key debe tener habilitada la Google Drive API. El visor llama a `https://www.googleapis.com/drive/v3/files` y usa `https://drive.google.com/thumbnail?id=...&sz=w2400` para mostrar imagenes optimizadas para pantalla.

### Endpoint JSON publico

Alternativa util si Google Drive resulta incomodo. El endpoint debe devolver un array o un objeto con `images`.

Ejemplos validos:

```json
[
  { "title": "Foto 1", "url": "https://example.com/foto.jpg" }
]
```

```json
{
  "images": [
    "https://example.com/foto.webp"
  ]
}
```

## Modo presentacion

En el visor hay un boton discreto de pantalla completa y tambien se puede entrar con doble click o doble toque sobre la fotografia. Al activarlo se ocultan los controles visibles y queda solo la fotografia, el fondo y el logo. La tecla `Esc` sale de pantalla completa. En la esquina inferior derecha queda un boton casi invisible para recuperar el control si hace falta.

El logo de la esquina inferior derecha tambien funciona como acceso discreto a `/admin/`. En el panel admin hay enlaces de vuelta al visor tanto en la pantalla de clave como en la pantalla de configuracion.

El visor muestra una firma discreta abajo a la izquierda: fotografias de ByAlaitz y web por anderibanez_.

## Notas para siguientes iteraciones

- Las fotos locales actuales son pesadas. Para evento real conviene exportarlas a 2000-2400 px de lado largo y calidad 80-85.
- Para GitHub Pages con `/admin/`, mantener la carpeta `admin/index.html`.
- Si se cambia el nombre o ubicacion del logo, actualizar `index.html`, `admin/index.html` y este documento.
- Si se necesita contrasena real, hace falta backend o proveedor externo; GitHub Pages por si solo no protege rutas.
