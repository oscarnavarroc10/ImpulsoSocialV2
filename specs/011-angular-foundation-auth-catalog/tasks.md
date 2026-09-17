# Tareas: Fundamentos Angular, White-label, Autenticación y Catálogo

**Alcance**: implementar exclusivamente T001–T009.  
**Rama**: `feature/011-angular-foundation-auth-catalog`

## Reglas de ejecución

- Leer completamente `spec.md` y `plan.md` antes de editar.
- No ejecutar `/speckit.*`, Spec Kit, agentes de convergencia ni análisis global.
- No modificar backend, base de datos, compose, otras specs o archivos raíz.
- No hacer commit, push ni llamadas reales a servicios de pago.
- No marcar `[x]` hasta que las pruebas nombradas existan y pasen.
- No sustituir pruebas con comentarios, snapshots masivos o fixtures que no
  atraviesen código de producción.
- Detenerse ante cualquier condición obligatoria de parada de `plan.md`.

## Tanda A — Fundación visual

- [ ] **T001 — Dependencia i18n y configuración de desarrollo**: instalar sólo
  `@jsverse/transloco`; configurar proxy `/api` hacia `http://localhost:3000`;
  conservar Angular 22 standalone, strict y Vitest; no agregar otro paquete —
  `frontend/package.json`, `frontend/package-lock.json`,
  `frontend/angular.json`, `frontend/proxy.conf.json`

**Prueba T001**:

- `npm install` queda reproducible con el lockfile.
- `npm run build` y los dos tests base siguen pasando.
- `/api/auth/login` se enruta al backend en desarrollo sin cambiar CORS.

- [ ] **T002 — Configuración white-label y fail-closed**: implementar los tipos,
  loader, validación recursiva, initializer, pantalla de error y configuración
  inicial de ImpulsoSocial exactamente según `spec.md`/`plan.md` —
  `frontend/src/app/core/config/**`,
  `frontend/public/config/tenant-config.json`,
  `frontend/public/branding/impulsosocial/**`

**Prueba T002**:

- config válida queda disponible antes de activar rutas;
- versión, URL, locale, tokens y duplicados inválidos fallan cerrado;
- sólo la allow-list de tokens toca `documentElement.style`;
- ausencia de logo usa wordmark, no imagen rota;
- no hay secretos ni credenciales en config.

- [ ] **T003 — Tema e internacionalización runtime**: implementar tema
  `light/dark/system`, persistencia, media-query y tokens; configurar Transloco,
  loader, selector de idioma, locale del documento, formateadores y traducciones
  completas es-MX/en — `frontend/src/app/core/theme/**`,
  `frontend/src/app/core/i18n/**`, `frontend/public/i18n/**`,
  `frontend/src/styles/**`, `frontend/src/styles.scss`

**Prueba T003**:

- tema efectivo responde al sistema y deja de escucharlo en modo explícito;
- preferencia inválida vuelve a `system`;
- idioma cambia sin recargar y respeta locales permitidos;
- claves es-MX/en tienen paridad recursiva;
- no aparece una clave cruda como texto visible;
- ambos temas respetan estados focus/success/warning/danger.

- [ ] **T004 — Layout y biblioteca UI mínima**: crear layout público responsive,
  header, menú accesible, footer, logo, toggles, skeleton, estados, paginación,
  dinero y acciones flotantes. Usar HTML semántico, SVG local y SCSS propio —
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

- [ ] **T005 — Landing comercial y estados de destacados**: implementar hero,
  redes, categorías, el contenedor visual de destacados, proceso, beneficios,
  métodos, FAQ preview, about preview, CTA y 404. La conexión de destacados al
  catálogo real se completa en T008; T005 no agrega datos falsos de producción.
  Instagram es la única red activa; métodos no integrados muestran
  `Próximamente` y no son accionables —
  `frontend/src/app/features/home/**`,
  `frontend/src/app/features/about/**`,
  `frontend/src/app/features/faq/**`,
  `frontend/src/app/features/not-found/**`

**Prueba T005**:

- orden de secciones y headings es correcto;
- contenido viene de traducciones/config, no está hardcodeado en templates;
- Instagram activo y otras redes inexistentes/deshabilitadas;
- categorías sin `backendCategoryId` no mandan filtros inventados;
- PayPal/Mercado Pago/tarjeta no ejecutan acción;
- destacados representa correctamente loading/empty/error/items mediante
  inputs tipados, sin contener HTTP ni fixtures de producción;
- 404 desconocido conserva navegación y CTA.

### Punto de control A

Al terminar T001–T005, ejecutar build y tests focalizados creados hasta ese
momento. Reportar archivos y resultados. **Detenerse aquí si el prompt solicita
únicamente T001–T005.** No anticipar autenticación ni catálogo completo.

## Tanda B — Integración real

- [ ] **T006 — HTTP, modelos y sesión segura**: implementar API base runtime,
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

- [ ] **T007 — Registro e inicio de sesión**: crear páginas y formularios
  reactivos tipados, estados, mensajes traducidos, autocomplete, toggle de
  password y redirect seguro. Integrarlos con header/sesión —
  `frontend/src/app/features/auth/**`, `frontend/src/app/app.routes.ts`

**Prueba T007**:

- validaciones nombre/email/password reflejan contrato;
- contraseña no se trimea ni registra;
- submit inválido no llama API y doble submit queda bloqueado;
- 401/409/red/500 presentan traducción segura;
- autenticación exitosa actualiza header y navega sólo a returnUrl interno;
- usuario autenticado que abre login/register vuelve a ruta segura.

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
- temas light/dark e idiomas es-MX/en reportados;
- backend disponible y backend detenido reportados;
- no hay errores de consola durante los flujos comprobados.

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
specs/011-angular-foundation-auth-catalog/tasks.md
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
- build, test o `git diff --check` falla;
- se superan 55 archivos de implementación sin assets/traducciones/tasks.
