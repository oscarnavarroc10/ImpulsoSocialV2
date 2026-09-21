# Plan de Implementación: Fundamentos Angular, White-label, Autenticación y Catálogo

**Rama**: `feature/011-angular-foundation-auth-catalog`  
**Especificación**: `specs/011-angular-foundation-auth-catalog/spec.md`

## 1. Estrategia

Construir una aplicación Angular por capas y features verticales, manteniendo
todo el trabajo dentro de `frontend/`. La implementación se divide en dos
tandas verificables:

1. **Fundación visual**: configuración white-label, temas, i18n, layout, landing
   y componentes compartidos.
2. **Integración real**: cliente HTTP, sesión, formularios de autenticación,
   catálogo, pruebas y validación completa.

No se ejecutarán comandos de Spec Kit. Los documentos ya contienen las
decisiones necesarias.

Antes de editar T002–T005 es obligatorio leer completamente
`design-contract.md`. Sus tokens, límites tipográficos, blueprint, prohibiciones
y criterios de confiabilidad no son sugerencias.

## 2. Decisiones técnicas

| Área                      | Decisión                               |
| ------------------------- | -------------------------------------- |
| Framework                 | Angular 22 standalone                  |
| Lenguaje                  | TypeScript strict                      |
| Estilos                   | SCSS propio + variables CSS semánticas |
| UI framework              | Ninguno en esta feature                |
| Estado local              | Angular Signals                        |
| Asincronía/HTTP           | RxJS + `HttpClient`                    |
| Formularios               | Reactive Forms tipados                 |
| Rutas                     | Angular Router con lazy loading        |
| i18n runtime              | `@jsverse/transloco`                   |
| Tests                     | Vitest mediante `ng test`              |
| Persistencia segura       | `sessionStorage` para sesión           |
| Preferencias no sensibles | `localStorage` para tema/locale        |
| Desarrollo API            | Proxy `/api` → `http://localhost:3000` |

No agregar NgRx, Tailwind, Bootstrap, Angular Material, jQuery, librerías de
componentes, carousel, animación o estado. La storefront debe tener identidad
propia y un bundle controlado.

## 3. Arquitectura de carpetas objetivo

```text
frontend/
├── public/
│   ├── config/tenant-config.json
│   ├── i18n/es-MX.json
│   ├── i18n/en.json
│   └── branding/impulsosocial/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── auth/
│   │   │   ├── config/
│   │   │   ├── http/
│   │   │   ├── i18n/
│   │   │   └── theme/
│   │   ├── layouts/
│   │   │   └── public-layout/
│   │   ├── shared/
│   │   │   ├── models/
│   │   │   ├── pipes/
│   │   │   └── ui/
│   │   ├── features/
│   │   │   ├── home/
│   │   │   ├── auth/
│   │   │   ├── catalog/
│   │   │   ├── about/
│   │   │   ├── faq/
│   │   │   └── not-found/
│   │   ├── app.config.ts
│   │   ├── app.routes.ts
│   │   ├── app.ts
│   │   ├── app.html
│   │   └── app.scss
│   └── styles/
│       ├── _reset.scss
│       ├── _tokens.scss
│       ├── _base.scss
│       ├── _layout.scss
│       ├── _components.scss
│       ├── _pages.scss
│       ├── _utilities.scss
│       └── _responsive.scss
├── proxy.conf.json
├── angular.json
├── package.json
└── package-lock.json
```

Nombres equivalentes son aceptables únicamente si conservan las fronteras. No
crear carpetas `services/`, `helpers/` o `components/` globales sin dominio.

`src/styles.scss` sólo importa las capas anteriores. Las páginas y layouts no
pueden declarar `styles`, `styleUrl`, `<style>` ni atributos `style`. Toda marca
usa variables CSS semánticas provenientes de la configuración validada.

## 4. Configuración white-label en runtime

### 4.1 Carga

`TenantConfigService` carga `/config/tenant-config.json` mediante un
`provideAppInitializer`. La aplicación no activa rutas hasta resolver:

- `ready`: configuración válida;
- `failed`: vista de configuración no disponible.

No usar `environment.ts` para marca o contenido. `apiBaseUrl` sí viene del JSON
runtime y en desarrollo vale `/api`.

### 4.2 Validación

Crear tipos estrictos y validadores/guards explícitos. No convertir el JSON con
un cast ciego. Validar recursivamente los campos definidos en `spec.md` y
producir un error interno sanitizado.

Las claves de colores permitidas son semánticas:

```text
primary
primaryContrast
secondary
accent
background
surface
surfaceElevated
text
textMuted
border
success
warning
danger
focus
heroStart
heroEnd
authSurface
authText
```

Convertirlas a variables:

```css
--color-primary
--color-primary-contrast
--color-surface
--color-text
...
```

No insertar nombres de propiedades proporcionados por JSON en CSS. Sólo asignar
la allow-list anterior mediante `style.setProperty`.

### 4.3 Configuración inicial

ImpulsoSocial parte de los cuatro presets documentados en
`design-contract.md`:

- tema inicial `light`, independientemente del tema del sistema;
- preset inicial `spotify`, con la dirección clara Aurora y verde comercial;
- presets `minimal`, `x` e `instagram`, cada uno con paleta clara y oscura;
- magenta/naranja permitido sólo en `instagram`; ningún preset usa negro puro,
  neón, glow o sombras de color. El degradado semántico construido con
  `heroStart`/`heroEnd` se limita a hero, bienvenida de cuenta y lienzo auth;
- radios derivados del preset mediante `data-theme-preset`;
- una escala de sombras neutras y suaves;
- tipografía sans-serif de sistema, sin descarga externa ni serif.

Crear wordmark SVG/local o fallback de texto. No descargar ni hotlinkear logos.

### 4.4 Arranque y recuperación

El initializer resuelve dependencias mediante `inject()` de forma sincrónica
antes de cualquier `await`. Después ejecuta en orden:

1. `TenantConfigService.load()`;
2. si el resultado es válido, `ThemeService.initialize()`;
3. si el resultado es válido, `LocaleService.initialize()`;
4. publicación atómica de estado `ready`.

`TenantConfigService` mantiene un estado discriminado `loading | ready |
configurationError`, es idempotente y permite retry. Ningún error esperado sale
como rechazo sin manejar. La shell representa loading y error; no existe una
rama que renderice vacío.

La prueba no puede limitarse a crear `App`. Debe ejecutar los providers reales
de `appConfig` mediante `ApplicationInitStatus`, bootstrap equivalente o un
harness que atraviese el initializer asíncrono.

## 5. Temas

`ThemeService` expone signals de preferencia, preset y tema efectivo:

```ts
preference: Signal<"light" | "dark" | "system">;
effectiveTheme: Signal<"light" | "dark">;
preset: Signal<string>;
presets: Signal<readonly ThemePresetConfig[]>;
```

- escuchar `prefers-color-scheme` sólo en modo `system`;
- retirar listener al destruir;
- persistir preferencia validada;
- validar, aplicar y persistir el preset por separado;
- volver a `defaultPreset` si el valor almacenado dejó de existir;
- exponer un control accesible para elegir `light`, `dark` o `system`, mostrando
  la preferencia seleccionada y no sólo el tema efectivo;
- exponer un selector accesible con labels traducidos para los presets
  configurados, sin lista hardcodeada dentro del componente;
- aplicar tokens del tenant, `data-theme` y `data-theme-preset` en `<html>`;
- actualizar `color-scheme`;
- no provocar flash claro antes del oscuro en condiciones normales.
- namespaciar storage con `tenantSlug` y tolerar `SecurityError`/storage no
  disponible;
- conservar una referencia estable del listener y eliminarla al cambiar de
  `system` a modo explícito o al destruir el servicio;
- hacer `initialize()` idempotente, sin registrar listeners duplicados.

## 6. Internacionalización

Instalar únicamente la dependencia nueva necesaria:

```bash
npm install @jsverse/transloco
```

Configurar loader HTTP con archivos `/i18n/{lang}.json` y fallback `es-MX`.
Organizar claves por dominio:

```text
common.*
navigation.*
home.*
auth.*
catalog.*
about.*
faq.*
errors.*
payments.*
accessibility.*
```

Ambos archivos deben contener el mismo conjunto de claves. Crear una prueba que
compare recursivamente las rutas de claves. Prohibido mostrar la clave si falta
traducción.

La paridad también compara tipos primitivos y longitudes/estructura de arrays.
Todo texto visible o accesible usa traducciones, incluidos `aria-label`,
`title`, loading, paginación, retry, navegación y estados fatales. El loader
intenta `es-MX` si falla un idioma secundario; si falla también el fallback,
publica una copia crítica mínima y legible en vez de propagar una pantalla
vacía.

`LocaleService` valida la preferencia contra `TenantUiConfig`, actualiza
Transloco y `document.documentElement.lang`, y expone el locale activo para
formatters.

## 7. Sistema visual y componentes compartidos

Crear sólo componentes reutilizados por dos o más features:

- `BrandLogoComponent`;
- `ThemeToggleComponent`;
- `LocaleSwitcherComponent`;
- `AppButtonComponent` o directiva de estilo equivalente;
- `LoadingSkeletonComponent`;
- `EmptyStateComponent`;
- `ErrorStateComponent`;
- `MoneyComponent` o pipe de dinero;
- `FloatingSocialActionsComponent`;
- `PaginationComponent`.

No construir un framework interno. Cada componente tiene API pequeña, inputs
tipados, estado de foco/disabled y prueba del comportamiento importante.

Los iconos deben ser SVG locales pequeños con `currentColor`. No usar emoji como
iconografía principal ni fuentes de iconos externas.

La configuración sólo aporta una `IconKey` validada contra la allow-list de
`design-contract.md`. No acepta markup, URL arbitraria o carácter visual como
icono. Debe eliminarse la iconografía actual basada en `✦`, `◎`, `♡`, `↗`,
`◌`, `♪`, `☼` y equivalentes.

## 8. Layout público

El layout contiene header, `<main>` y footer comunes.

Desktop:

- marca a la izquierda;
- navegación central;
- idioma/tema y login/registro a la derecha;
- ancho máximo de contenido de 1200–1280 px.

Móvil:

- marca, tema y botón de menú;
- navegación colapsada accesible;
- bloquear scroll del body mientras el menú está abierto;
- Escape cierra y devuelve el foco al botón;
- CTA principal visible sin saturar.

El estado autenticado cambia las acciones por cuenta y logout. `/cuenta`
muestra usuario real de la sesión, accesos al catálogo y funciones futuras
deshabilitadas; nunca inventa saldo, órdenes, estadísticas o actividad.

La landing y el layout siguen el blueprint exacto de `design-contract.md`. En
particular, el hero usa sans-serif, máximo 64 px, CTAs dentro del primer viewport
y una segunda columna basada sólo en configuración real. Se eliminan el numeral
decorativo, la composición editorial vacía y cualquier elemento
violeta/naranja/neón. Aurora claro es el modo inicial; el modo oscuro conserva
la misma jerarquía y densidad sin reproducir el panel técnico de un proveedor.

Las rutas canónicas `/login`, `/registro` y `/cuenta` se implementan en T007.
`/auth/login` y `/auth/register` se conservan como redirects compatibles. Hasta
T008, `/services` muestra un placeholder traducido y honesto; nunca se resuelve
mediante el wildcard 404. El wildcard permanece al final del shell público.

## 9. Cliente HTTP

### 9.1 Desarrollo local

`proxy.conf.json`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true,
    "pathRewrite": { "^/api": "" }
  }
}
```

Configurar `ng serve` para usarlo. Todo consumo usa `apiBaseUrl` del tenant;
nunca concatenar URLs en componentes.

### 9.2 Errores

Definir `ApiError` normalizado:

```ts
interface ApiError {
  status: number;
  code:
    | "validation"
    | "unauthorized"
    | "conflict"
    | "notFound"
    | "network"
    | "server"
    | "unknown";
  fieldErrors?: Readonly<Record<string, string>>;
}
```

Los mensajes NestJS sólo se usan para clasificar casos explícitamente seguros;
jamás se imprimen crudos. El mensaje visible procede de traducciones.

## 10. Sesión y autenticación

### 10.1 Modelos

Definir modelos exactos para request/response. Ningún modelo contiene password
fuera del request del formulario. Crear `SessionState` con usuario y tokens.

### 10.2 Almacenamiento

`SessionStorageService`:

- clave versionada y namespaced por tenant;
- parseo y validación segura;
- datos corruptos se eliminan;
- sólo `sessionStorage`;
- método `clear` idempotente;
- ninguna escritura en logs.

### 10.3 AuthService

Signals públicos de sólo lectura:

```text
user
isAuthenticated
isBusy
```

Métodos:

```text
register
login
refresh
logout
restore
```

No decodificar JWT para tomar decisiones de autorización. El usuario de la
respuesta sólo personaliza UI.

### 10.4 Interceptor

Interceptor funcional:

1. ignora assets, config, i18n y URLs externas;
2. no adjunta bearer a login/register/refresh/logout;
3. adjunta access token a rutas protegidas del API;
4. ante 401 inicia o reutiliza una renovación single-flight;
5. reintenta la petición original exactamente una vez;
6. si falla refresh, limpia y navega a login;
7. finaliza correctamente los observables concurrentes;
8. nunca intercepta el propio refresh de forma recursiva.

### 10.5 Formularios

- componentes standalone y lazy;
- labels visibles;
- autocomplete correcto (`name`, `email`, `current-password`,
  `new-password`);
- botón mostrar/ocultar contraseña con nombre accesible;
- requisitos visibles antes del submit;
- error general en `aria-live`;
- redirección interna segura después del éxito.

## 11. Landing

Separar secciones en componentes de feature, no en un único template gigante.
Datos de redes, categorías, pagos y contactos provienen de config. El contenido
editorial proviene de traducciones.

Los servicios destacados llaman al listado real con:

```text
page=1
limit=<featuredLimit, 1..8>
socialNetwork=Instagram
```

Si el backend no está disponible, el resto de la landing sigue visible y sólo
el bloque de servicios presenta un error recuperable.

## 12. Catálogo

### 12.1 Capa de datos

`CatalogApiService` es el único consumidor HTTP. Un mapper/type guard valida:

- strings requeridos no vacíos;
- `sellingPrice.amount` entero seguro y no negativo;
- moneda no vacía;
- paginación con enteros coherentes;
- items siempre array.

Respuesta inválida se convierte en error genérico y nunca se renderiza
parcialmente.

### 12.2 Estado de feature

`CatalogStore` basado en signals mantiene:

```text
items
pagination
filters
loading
error
```

No crear un store global. Cancelar peticiones anteriores al cambiar rápidamente
de filtros/página. La URL refleja `page`, `socialNetwork`, `categoryId`.

### 12.3 Dinero

`MoneyFormatter` determina los dígitos fraccionarios con
`Intl.NumberFormat(...).resolvedOptions()` y divide las unidades menores por la
potencia correspondiente. No usa `toFixed`, concatenación de símbolos ni mapa
manual USD/MXN.

## 13. SEO básico sin SSR

Cada ruta configura título y descripción mediante `Title`/`Meta`:

- Inicio — ImpulsoSocial;
- Servicios;
- Detalle del servicio;
- Quiénes somos;
- Preguntas frecuentes;
- Login/registro con `robots=noindex`.

Actualizar título del detalle sólo después de validar el servicio. SSR/SSG se
decidirá en otra feature; no añadirlo silenciosamente.

## 14. Pruebas obligatorias

Usar Vitest y TestBed. Mínimo 40 pruebas nuevas/reemplazadas, repartidas entre:

1. validación y fallo cerrado de tenant config;
2. aplicación de tokens permitidos;
3. tema system/light/dark, presets, fallback y persistencia;
4. locales soportados, fallback, paridad y resolución de toda clave dinámica;
5. almacenamiento de sesión corrupto/normal/vacío;
6. auth login/register/logout/refresh y errores;
7. interceptor: alcance de host, exclusiones, bearer, single-flight, retry único
   y refresh fallido;
8. protección contra `returnUrl` externo;
9. mapper de catálogo y rechazo de respuestas inválidas;
10. listado: query, paginación, filtros, loading, empty y retry;
11. detalle: éxito y 404;
12. landing: config dinámica, métodos próximamente y links condicionales;
13. navegación/menú accesible y contenido esencial.

El punto de control A exige al menos 25 de esas pruebas antes de T006. Debe
incluir el initializer real, error/retry de configuración, tema/storage/listener,
locale/fallback/paridad, shell/menú y landing. Las tres pruebas starter actuales
no satisfacen este requisito.

No se exige pixel-perfect screenshot testing ni llamadas reales a backend.

## 15. Archivos permitidos

Sólo pueden modificarse:

```text
frontend/**
specs/011-angular-foundation-auth-catalog/**
```

`frontend/node_modules/`, `frontend/dist/` y `frontend/.angular/` deben seguir
ignorados y nunca prepararse en Git. No modificar `backend/`, `compose.yml`,
`.specify/`, la `.github/` raíz, otra spec o
archivos raíz, salvo que una tarea lo autorice expresamente. No se autoriza tal
excepción en esta feature.

## 16. Validación

Desde `frontend/`:

```bash
npm run build
npm test -- --watch=false
```

Desde la raíz:

```bash
git diff --check
git status --short
git diff --stat
```

Validación manual mínima con backend local:

```text
320×568
768×1024
1440×900
tema claro
tema oscuro
es-MX
en
backend disponible
backend detenido
initializer exitoso sin errores de consola
config 404/invalid y retry exitoso
zoom de navegador al 200 % en la ruta principal
```

## 17. Condiciones obligatorias de parada

El agente debe detenerse sin improvisar si:

- necesita modificar backend, Prisma, compose o specs anteriores;
- propone guardar secretos o tokens en código/localStorage;
- necesita inventar un endpoint o campo de respuesta;
- pretende mostrar categoría backend sin nombre disponible;
- pretende mostrar precio por mil, mínimo, máximo o tiempo no expuesto;
- intenta integrar un pago real o simular un pago aprobado;
- intenta habilitar otra red además de Instagram;
- necesita agregar más dependencias además de Transloco;
- requiere `any`, `@ts-ignore`, cast doble o deshabilitar strict;
- necesita `innerHTML` para contenido remoto;
- pretende desactivar tests, presupuestos de bundle o validación;
- build, tests o `git diff --check` falla;
- se modifican archivos fuera de la allow-list;
- se deja cualquier `inject()` después de un `await`/callback asíncrono en el
  initializer;
- un fallo esperado produce pantalla blanca, clave de traducción o error técnico;
- se usan magenta/naranja fuera de Instagram, negro puro, neón, glow, gradiente
  en botones/texto/formularios o serif;
- una clave de traducción dinámica aparece cruda en pantalla;
- se introduce estilo inline/local de página o iconografía Unicode/emoji;
- el tema inicial depende de `prefers-color-scheme` en lugar de iniciar claro;
- faltan los 25 tests del punto de control A o la validación manual requerida;
- la implementación supera 55 archivos creados/modificados sin contar JSON de
  traducciones, assets y `tasks.md`.

Ante una condición de parada, reportar el motivo y los archivos ya cambiados;
no aplicar una solución alternativa fuera de alcance.
