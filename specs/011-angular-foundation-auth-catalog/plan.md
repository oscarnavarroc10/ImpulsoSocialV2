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

## 2. Decisiones técnicas

| Área | Decisión |
|---|---|
| Framework | Angular 22 standalone |
| Lenguaje | TypeScript strict |
| Estilos | SCSS propio + variables CSS semánticas |
| UI framework | Ninguno en esta feature |
| Estado local | Angular Signals |
| Asincronía/HTTP | RxJS + `HttpClient` |
| Formularios | Reactive Forms tipados |
| Rutas | Angular Router con lazy loading |
| i18n runtime | `@jsverse/transloco` |
| Tests | Vitest mediante `ng test` |
| Persistencia segura | `sessionStorage` para sesión |
| Preferencias no sensibles | `localStorage` para tema/locale |
| Desarrollo API | Proxy `/api` → `http://localhost:3000` |

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
│       ├── _utilities.scss
│       └── _responsive.scss
├── proxy.conf.json
├── angular.json
├── package.json
└── package-lock.json
```

Nombres equivalentes son aceptables únicamente si conservan las fronteras. No
crear carpetas `services/`, `helpers/` o `components/` globales sin dominio.

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

ImpulsoSocial parte de:

- claro: fondo gris muy claro, superficie blanca, texto azul-negro;
- oscuro: fondo azul profundo, superficies elevadas discretas;
- primario violeta;
- secundario azul;
- acento coral/rosa usado con moderación;
- radios entre 12 y 20 px;
- sombras suaves, nunca glow excesivo;
- tipografía de sistema, sin descarga externa.

Crear wordmark SVG/local o fallback de texto. No descargar ni hotlinkear logos.

## 5. Temas

`ThemeService` expone signals de preferencia y tema efectivo:

```ts
preference: Signal<'light' | 'dark' | 'system'>
effectiveTheme: Signal<'light' | 'dark'>
```

- escuchar `prefers-color-scheme` sólo en modo `system`;
- retirar listener al destruir;
- persistir preferencia validada;
- aplicar tokens del tenant y `data-theme` en `<html>`;
- actualizar `color-scheme`;
- no provocar flash claro antes del oscuro en condiciones normales.

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

El estado autenticado cambia las acciones por saludo/nombre y logout, pero no
crea un dashboard ficticio.

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
  code: 'validation' | 'unauthorized' | 'conflict' | 'notFound' |
        'network' | 'server' | 'unknown';
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
3. tema system/light/dark y persistencia;
4. locales soportados, fallback y paridad de traducciones;
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

No se exige pixel-perfect screenshot testing ni llamadas reales a backend.

## 15. Archivos permitidos

Sólo pueden modificarse:

```text
frontend/**
specs/011-angular-foundation-auth-catalog/tasks.md
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
- la implementación supera 55 archivos creados/modificados sin contar JSON de
  traducciones, assets y `tasks.md`.

Ante una condición de parada, reportar el motivo y los archivos ya cambiados;
no aplicar una solución alternativa fuera de alcance.
