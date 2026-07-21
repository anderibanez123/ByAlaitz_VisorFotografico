# Publicacion en GitHub Pages

## Archivos a subir

Usar `publicacion-github-pages.zip`. No subir carpetas de fotos locales (`Imagenes/Imagenes Audi A1 de prueba/` ni `Imagenes/Optimized/`), porque la web publicada usara Google Drive como fuente.

## Pasos en GitHub

1. Crear un repositorio nuevo en GitHub.
2. Subir el contenido del ZIP a la raiz del repositorio.
3. Ir a `Settings` -> `Pages`.
4. En `Build and deployment`, elegir:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guardar.
6. Esperar a que GitHub Pages publique la URL.

## Google Drive

`config.json` esta configurado para usar Google Drive como fuente e incluye la `driveApiKey` para listar imagenes desde cualquier navegador. La clave debe estar restringida a Google Drive API y, cuando exista la URL de GitHub Pages, al dominio publicado.

Si no quieres escribir la API key manualmente en `config.json`, puedes abrir `/admin/` en la web publicada, pegarla alli y guardar. Eso solo quedara guardado en ese navegador. Para que funcione igual para todo el mundo, exporta `config.json` desde admin y sube ese archivo al repo.
