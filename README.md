# Crucero 2027

App offline (PWA) del crucero. Publicada con GitHub Pages.

- Los datos editables están en `data-src/*.json` (esa carpeta **no se sube a GitHub**).
- Para publicar, se cifran con el código del grupo y se genera `data/datos.enc` (ese sí se sube):

  PowerShell: `$env:CRUCERO_CODE="el código"; node build.js`

- Mapas sin conexión en `maps/*.pmtiles`.
- Si cambias datos o código, sube el número de versión de `CACHE` en `sw.js` para que los móviles se actualicen.
