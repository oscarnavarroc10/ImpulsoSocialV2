# Tareas: Fundamentos Angular, White-label, Autenticación y Catálogo

**Alcance**: implementar exclusivamente T001–T009.  
**Rama**: `feature/011-angular-foundation-auth-catalog`

## Reglas de ejecución

- Leer completamente `spec.md`, `plan.md` y `design-contract.md` antes de editar.
- No ejecutar `/speckit.*`, Spec Kit, agentes de convergencia ni análisis global.
- No modificar backend, base de datos, compose, otras specs o archivos raíz.
- Esta revisión mantiene `spec.md`, `plan.md` y `design-contract.md` alineados
  con Aurora claro, los cuatro presets y las rutas explícitas. Cualquier cambio
  posterior debe actualizar los tres documentos sin contradicciones.
- No hacer commit, push ni llamadas reales a servicios de pago.
- No marcar `[x]` hasta que las pruebas nombradas existan y pasen.
- No sustituir pruebas con comentarios, snapshots masivos o fixtures que no
  atraviesen código de producción.
- Detenerse ante cualquier condición obligatoria de parada de `plan.md`.
- Tratar la implementación actual de T001–T005 como borrador rechazado: conservar
  únicamente piezas que demuestren cumplir los contratos actualizados.
- No considerar `npm run build` suficiente: la aplicación debe arrancar en un
  navegador sin errores de consola y sin pantalla blanca.
- Prohibido dejar `inject()` después de un `await` o dentro de una continuación
  asíncrona que haya perdido el contexto de Angular.

## Tanda A — Fundación visual

- [x] **T001 — Dependencia i18n y configuración de desarrollo**: instalar sólo
      `@jsverse/transloco`; configurar proxy `/api` hacia `http://localhost:3000`;
      conservar Angular 22 standalone, strict y Vitest; no agregar otro paquete —
      `frontend/package.json`, `frontend/package-lock.json`,
      `frontend/angular.json`, `frontend/proxy.conf.json`

**Prueba T001**:

- `npm install` queda reproducible con el lockfile.
- `npm run build` y los dos tests base siguen pasando.
- `/api/auth/login` se enruta al backend en desarrollo sin cambiar CORS.

- [x] **T002 — Configuración white-label y arranque recuperable**: corregir los
      tipos, loader, validación recursiva, initializer y shell para que el arranque
      tenga estados explícitos `loading/ready/configurationError`; resolver todos los
      `inject()` antes del primer `await`; hacer carga/retry idempotentes; mostrar
      error traducido y reintentable sin pantalla blanca; validar URLs, paletas,
      IconKey, redes, categorías, pagos y duplicados según los tres documentos —
      `frontend/src/app/core/config/**`,
      `frontend/public/config/tenant-config.json`,
      `frontend/public/branding/impulsosocial/**`,
      `frontend/src/app/app.config.ts`, `frontend/src/app/app.ts`

**Prueba T002**:

- config válida queda disponible antes de activar rutas;
- initializer real termina sin `NG0203` ni rechazo sin manejar;
- versión, URL, locale, tokens, IconKey y duplicados inválidos fallan cerrado;
- sólo la allow-list de tokens toca `documentElement.style`;
- ausencia de logo usa wordmark, no imagen rota;
- no hay secretos ni credenciales en config.
- config 404/invalid muestra estado legible y su retry posterior puede llegar a
  `ready` sin recargar;
- `load()` repetido no conserva errores viejos ni publica config parcial;
- agregar al menos 8 pruebas focalizadas de T002, incluida una que atraviese el
  initializer real mediante providers de `appConfig`.

- [x] **T003 — Diseño base, tema e internacionalización runtime**: reemplazar la
      paleta violeta/editorial por las paletas exactas del contrato; ImpulsoSocial
      inicia en `light` con preset `spotify`; implementar los presets `spotify`,
      `minimal`, `x` e `instagram` además de `light/dark/system`, persistencia
      separada y namespaced, listener con cleanup e inicialización idempotente;
      configurar Transloco, fallback, selectores, locale del documento,
      formateadores y traducciones completas es-MX/en; dividir el SCSS global en las
      capas obligatorias y retirar serif, gradientes fuera de las superficies
      Aurora aprobadas, estilos de página y valores visuales locales —
      `frontend/src/app/core/theme/**`,
      `frontend/src/app/core/i18n/**`, `frontend/public/i18n/**`,
      `frontend/src/styles/**`, `frontend/src/styles.scss`

**Prueba T003**:

- tema inicial es claro aunque el sistema esté oscuro;
- tema efectivo responde al sistema sólo tras seleccionar `system` y deja de
  escucharlo en modo explícito/destroy;
- los cuatro presets cambian sin recargar y cada uno funciona en claro/oscuro;
- preset inválido o eliminado vuelve a `defaultPreset` sin error;
- preset y modo se guardan en claves distintas con `tenantSlug`;
- el control permite seleccionar los tres modos y anuncia la preferencia real;
- preferencia inválida vuelve al default validado del tenant (`light` para
  ImpulsoSocial);
- fallos de localStorage no rompen tema/idioma y las claves incluyen tenantSlug;
- idioma cambia sin recargar, actualiza `document.lang` y respeta locales;
- idioma secundario fallido usa `es-MX`; doble fallo usa copia crítica legible;
- claves es-MX/en tienen paridad recursiva de rutas, tipos y arrays;
- todas las claves construidas por los templates se resuelven como texto; queda
  prohibido usar índices de arrays como `home.trust.0`;
- no aparece una clave cruda como texto visible;
- ambos temas respetan estados focus/success/warning/danger.
- no existe magenta/naranja fuera del preset Instagram, negro puro, neón, glow,
  gradiente fuera de hero/auth/bienvenida de cuenta o serif;
- ningún componente de página/layout tiene `styles`, `styleUrl`, `<style>` o
  atributo `style`;
- agregar al menos 8 pruebas focalizadas de T003.

- [x] **T004 — Layout comercial y biblioteca UI mínima**: reconstruir layout,
      header, menú, footer, logo, toggles, skeleton, estados, paginación, dinero y
      acciones flotantes conforme al contrato visual. Sustituir todos los emoji y
      símbolos Unicode por SVG locales allow-listed; traducir todo nombre visible y
      accesible; implementar restauración de foco, bloqueo de scroll, Escape y
      estados hover/focus/disabled —
      `frontend/src/app/layouts/**`, `frontend/src/app/shared/**`,
      `frontend/src/app/app.*`, `frontend/src/app/app.config.ts`,
      `frontend/src/app/app.routes.ts`

**Prueba T004**:

- menú abre/cierra por teclado, Escape y click;
- foco regresa al disparador;
- links sociales sólo existen cuando están configurados;
- enlaces externos usan HTTPS y `rel="noopener noreferrer"`;
- dinero MXN/USD se forma desde unidades menores y locale;
- no hay overflow horizontal a 320 px en los componentes base.
- loading, retry, paginación y `aria-label` no contienen inglés hardcodeado;
- el modo de ruta activa no se confunde con foco de teclado;
- no queda ninguno de los caracteres visuales prohibidos enumerados en
  `plan.md`;
- agregar al menos 5 pruebas focalizadas de T004.

- [ ] **T005 — Rediseño completo de landing y rutas informativas**: reemplazar la
      composición actual por el blueprint de `design-contract.md`: hero compacto
      sans-serif con CTA above-the-fold, descubrimiento por Instagram/categorías,
      destacados honestos, proceso, beneficios verificables, pagos informativos en
      tarjetas visuales con icono, descripción y estado,
      FAQ, about, CTA final y 404. Aplicar Aurora claro: superficies limpias, texto
      grafito, verde comercial y un degradado semántico controlado, sin copiar el
      sitio de referencia. Eliminar numeral editorial, hero gigante y espacios
      vacíos. La conexión real se completa en T008 y no se agregan datos falsos.
      Instagram es la única red activa; métodos no integrados son inequívocamente
      no accionables —
      `frontend/src/app/features/home/**`,
      `frontend/src/app/features/about/**`,
      `frontend/src/app/features/faq/**`,
      `frontend/src/app/features/not-found/**`

**Estado T005**: implementación Aurora incluida y validación automatizada
correcta; permanece abierta hasta que se complete la revisión visual manual en
los tres viewports obligatorios después de aplicar el parche.

**Prueba T005**:

- orden de secciones y headings es correcto;
- contenido viene de traducciones/config, no está hardcodeado en templates;
- Instagram activo y otras redes inexistentes/deshabilitadas;
- categorías sin `backendCategoryId` no mandan filtros inventados;
- PayPal/Mercado Pago/tarjeta no ejecutan acción;
- pagos no se presentan como tabla/lista plana y cada método muestra
  disponibilidad inequívoca sin promesas temporales, icono allow-listed y
  descripción traducida;
- destacados representa correctamente loading/empty/error/items mediante
  inputs tipados, sin contener HTTP ni fixtures de producción;
- 404 desconocido conserva navegación y CTA;
- `/services` resuelve explícitamente a un placeholder traducido honesto hasta
  T008; `/login`, `/registro` y `/cuenta` son rutas reales de T007; los aliases
  `/auth/login` y `/auth/register` redirigen y nunca caen en 404;
- wildcard `**` es el último route y sólo captura rutas desconocidas;
- título hero tiene máximo 12 palabras, máximo 64 px y máximo tres líneas a
  320 px;
- CTA principal es visible sin scroll a 1440×900;
- default light, 320×568, 768×1024 y 1440×900 coinciden con el contrato, sin
  scroll horizontal ni errores de consola;
- agregar al menos 6 pruebas focalizadas de T005.

### Punto de control A

Al terminar T001–T005 deben existir al menos 25 pruebas focalizadas reales.
Ejecutar build, suite completa, `git diff --check` y validación manual en los
tres viewports, cuatro presets, tema claro/oscuro, es-MX/en, config válida y
config inválida con retry. La consola debe permanecer sin errores. Reportar
archivos y resultados.
**Detenerse aquí si el prompt solicita únicamente T001–T005.** No anticipar
autenticación ni catálogo completo.

No marcar T001–T005 si la revisión visual no cumple `design-contract.md`, aunque
build y tests pasen.

## Tanda B — Integración real

- [x] **T006 — HTTP, modelos y sesión segura**: implementar API base runtime,
      normalización de errores, modelos exactos de auth/catálogo, almacenamiento de
      sesión validado, AuthService, interceptor single-flight y guard/redirección
      interna segura — `frontend/src/app/core/http/**`,
      `frontend/src/app/core/auth/**`, `frontend/src/app/shared/models/**`

**Prueba T006**:

- URLs de auth coinciden exactamente con backend;
- token sólo se adjunta al API y nunca a config/i18n/assets/URLs externas;
- login/register/refresh/logout no generan ciclos;
- tres 401 concurrentes generan exactamente un refresh;
- petición original se reintenta máximo una vez;
- refresh fallido limpia sesión y navega de forma segura;
- sesión corrupta se elimina;
- logout limpia estado aunque falle la red;
- tokens no aparecen en logs, DOM, URL ni localStorage.

- [x] **T007 — Registro, inicio de sesión y cuenta base**: crear páginas y formularios
      reactivos tipados, estados, mensajes traducidos, autocomplete, toggle de
      password y redirect seguro. Integrarlos con header/sesión y `/cuenta`, sin
      inventar wallet, órdenes o métricas. Preparar Google/Apple sólo como botones
      deshabilitados por configuración hasta que exista OAuth backend —
      `frontend/src/app/features/auth/**`, `frontend/src/app/app.routes.ts`

**Prueba T007**:

- validaciones nombre/email/password reflejan contrato;
- contraseña no se trimea ni registra;
- submit inválido no llama API y doble submit queda bloqueado;
- 401/409/red/500 presentan traducción segura;
- autenticación exitosa actualiza header y navega sólo a returnUrl interno;
- usuario autenticado que abre login/register vuelve a ruta segura.
- login y registro usan una sola tarjeta centrada, sin panel promocional lateral
  ni titular gigante, y caben en 1440×900 sin scroll en estado inicial;
- Google y Apple permanecen deshabilitados y no muestran badges o textos de
  "Próximamente";

- [ ] **T008 — Catálogo y detalle reales**: implementar API, mapper defensivo,
      store signals, rutas lazy, filtros permitidos, query params, paginación,
      skeleton, vacío, error/retry, detalle/404, precio seguro, metadatos de ruta y
      conexión de servicios destacados de la landing al catálogo real —
      `frontend/src/app/features/catalog/**`,
      `frontend/src/app/shared/**`, `frontend/src/app/app.routes.ts`

**Prueba T008**:

- request usa únicamente page/limit/socialNetwork/categoryId válidos;
- cambio rápido cancela carga anterior;
- URL y store permanecen sincronizados;
- respuestas con amount no entero, currency vacía o paginación inválida se
  rechazan sin render parcial;
- precio usa dígitos ISO resueltos por Intl;
- empty/error/retry/paginación funcionan;
- fallo de destacados no oculta el resto de la landing y permite reintento;
- detalle 404 usa pantalla propia;
- no se muestra por-mil, mínimo, máximo, proveedor ni metadata interna.

- [ ] **T009 — Accesibilidad, regresión y reporte final**: completar al menos 40
      pruebas totales nuevas/reemplazadas descritas en `plan.md`; verificar teclado,
      reduced-motion y viewports; ejecutar validación completa; actualizar README
      con arranque frontend/backend; marcar T001–T009 sólo después de éxito y parar —
      `frontend/src/**/*.spec.ts`, `frontend/README.md`,
      `specs/011-angular-foundation-auth-catalog/tasks.md`

**Prueba T009**:

- `npm run build` pasa;
- `npm test -- --watch=false` pasa sin handles abiertos;
- mínimo 40 pruebas nuevas/reemplazadas visibles;
- `git diff --check` pasa;
- sólo archivos permitidos cambiaron;
- validación manual 320×568, 768×1024 y 1440×900 reportada;
- cuatro presets, temas light/dark e idiomas es-MX/en reportados;
- backend disponible y backend detenido reportados;
- no hay errores de consola durante los flujos comprobados.
- ninguna página vuelve a introducir estilos locales, iconos Unicode o texto
  visible/accesible sin traducción.

## Definición de terminado

- ImpulsoSocial tiene storefront profesional, responsive y traducible.
- Marca, temas, enlaces, redes, categorías de presentación y pagos dependen de
  configuración white-label, no de componentes.
- Registro, login, refresh y logout consumen el backend real de forma segura.
- Catálogo y detalle usan sólo contratos públicos reales.
- Ninguna ausencia del backend se rellena con datos inventados.
- La base queda preparada para wallet, compra, órdenes y depósitos.
- Backend y features anteriores permanecen sin modificaciones.

## Archivos permitidos

```text
frontend/**
specs/011-angular-foundation-auth-catalog/**
```

`frontend/node_modules/`, `frontend/dist/` y `frontend/.angular/` deben seguir
ignorados y nunca prepararse en Git.

## Condiciones obligatorias de parada

Detenerse y reportar, sin marcar tareas, si ocurre cualquiera:

- modificación necesaria fuera de los archivos permitidos;
- endpoint/campo/categoría/unidad de precio inexistente requerido;
- pago real o proveedor externo requerido;
- segunda dependencia nueva propuesta;
- se desactiva strict, test o presupuesto;
- se propone guardar tokens en localStorage;
- se requiere `any`, `@ts-ignore`, cast doble o `innerHTML` remoto;
- se habilita una red distinta de Instagram;
- faltan pruebas nombradas o no se alcanza el mínimo;
- el initializer no se prueba atravesando la configuración real de providers;
- aparece pantalla blanca, error de consola o clave de traducción;
- se conserva la dirección visual editorial rechazada, no se implementan los
  cuatro presets o un color de Instagram se filtra a otro preset;
- se usan emoji/Unicode como iconos o estilos locales de página/layout;
- build, test o `git diff --check` falla;
- se superan 55 archivos de implementación sin assets/traducciones/tasks.
