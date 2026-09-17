# Especificación de Feature: Fundamentos Angular, White-label, Autenticación y Catálogo

**Rama**: `feature/011-angular-foundation-auth-catalog`  
**Fecha**: 2026-09-17  
**Estado**: Aprobada para implementación  
**Aplicación**: `frontend/` Angular 22 standalone

## 1. Objetivo

Construir la primera experiencia web real de ImpulsoSocial: una tienda de
servicios para redes sociales clara, confiable, responsive y orientada a
conversión, sin copiar la interfaz densa de un panel SMM tradicional.

Esta feature establece una base reutilizable para múltiples tenants y entrega:

1. configuración white-label en tiempo de ejecución;
2. tema claro y oscuro configurable;
3. español de México e inglés con cambio de idioma sin recargar;
4. sitio público comercial;
5. registro, inicio de sesión, renovación y cierre de sesión reales;
6. catálogo público y detalle de servicio conectados al backend existente;
7. navegación y componentes adaptados a móvil, tableta y escritorio;
8. estados de carga, vacío, error y sesión expirada accesibles.

El resultado debe parecer una tienda moderna de crecimiento digital, no una
tabla técnica de proveedor. El proveedor BulkFollows jamás se menciona ni se
expone al cliente.

## 2. Resultado de negocio

Al terminar esta feature, una persona podrá:

```text
entrar a ImpulsoSocial
→ entender qué se vende y por qué confiar
→ explorar servicios públicos de Instagram
→ alternar tema e idioma
→ registrarse o iniciar sesión
→ conservar/renovar su sesión dentro de la pestaña
→ consultar el detalle seguro de un servicio
```

La compra, wallet, historial de órdenes y depósitos se implementarán en la
siguiente feature sobre esta base. Los enlaces correspondientes pueden verse
como navegación futura únicamente si están deshabilitados y etiquetados como
"Próximamente"; no pueden simular acciones exitosas.

## 3. Audiencia prioritaria

La V1 debe funcionar para dos públicos sin crear dos productos:

- creadores, emprendedores y pequeños negocios que buscan una compra sencilla;
- agencias y revendedores que necesitan consultar servicios rápidamente.

La experiencia predeterminada es sencilla y comercial. No se muestran IDs del
proveedor, payloads técnicos, costos internos ni controles administrativos.

## 4. Principios de experiencia

- **Ventas antes que densidad**: jerarquía visual, beneficios y llamadas a la
  acción antes que tablas gigantes.
- **Claridad antes que promesas**: no usar frases como "viral garantizado",
  "resultados garantizados" o métricas inventadas.
- **Progresión natural**: explorar sin autenticación; autenticar sólo cuando una
  acción protegida lo requiera.
- **Mobile first**: ninguna funcionalidad depende de hover o de una tabla ancha.
- **Datos reales**: los servicios vienen del backend; los mocks existen sólo en
  tests y configuración de presentación.
- **White-label real**: ningún componente conoce colores, logos, teléfono,
  moneda, enlaces o textos específicos de ImpulsoSocial.
- **Accesibilidad**: navegación por teclado, foco visible, contraste suficiente,
  semántica HTML y reducción de movimiento.

## 5. Alcance funcional

### 5.1 Rutas públicas

Las rutas no se traducen para mantener enlaces estables:

| Ruta | Propósito |
|---|---|
| `/` | Landing comercial |
| `/services` | Catálogo público paginado |
| `/services/:id` | Detalle público de servicio |
| `/about` | Quiénes somos |
| `/faq` | Preguntas frecuentes |
| `/auth/login` | Inicio de sesión |
| `/auth/register` | Registro |

Una ruta desconocida muestra una página 404 con CTA de regreso, sin redirigir
silenciosamente.

### 5.2 Landing comercial

La página principal incluye, en este orden:

1. header responsive con marca, navegación, idioma, tema y acciones de sesión;
2. hero con propuesta de valor, CTA primario a catálogo y CTA secundario a FAQ;
3. selector visual de red social; sólo Instagram está activo en V1;
4. categorías de presentación para seguidores, likes, views y reposts;
5. servicios destacados obtenidos del catálogo real;
6. proceso de compra en tres pasos;
7. beneficios y señales de confianza verificables;
8. métodos de pago configurados por tenant;
9. preguntas frecuentes destacadas;
10. bloque de quiénes somos;
11. CTA final y footer;
12. accesos flotantes opcionales a WhatsApp y TikTok.

Los métodos PayPal, Mercado Pago y tarjeta se muestran como
`Próximamente` mientras no exista integración backend. Transferencia y
criptomoneda pueden mostrarse como métodos de revisión manual. Ninguna tarjeta
de pago inicia, aprueba o finge una transacción en esta feature.

### 5.3 Redes y categorías

- Instagram es la única red habilitada inicialmente.
- La lista se obtiene de `TenantUiConfig.catalog.networks`, nunca de condicionales
  escritos dentro de componentes.
- Cada categoría de presentación contiene clave estable, icono, traducción,
  orden y `backendCategoryId` opcional.
- Si existe `backendCategoryId`, navegar a la categoría filtra el catálogo con
  `categoryId`.
- Si no existe, la categoría sigue siendo contenido comercial, pero no envía un
  filtro falso ni inventa resultados.
- Una categoría desconocida del backend se representa con una etiqueta genérica
  traducida; no rompe la página.

### 5.4 Catálogo público

Consume exclusivamente:

```http
GET /v1/catalog/services?page=1&limit=20&socialNetwork=Instagram&categoryId=<id>
GET /v1/catalog/services/:id
```

Cada elemento usa exactamente:

```ts
interface PublicCatalogService {
  id: string;
  title: string;
  description: string;
  socialNetwork: string;
  categoryId: string;
  sellingPrice: {
    amount: number;   // unidades monetarias menores
    currency: string; // ISO
  };
}
```

Reglas:

- paginación con URL como fuente de verdad;
- `page` mínimo 1 y `limit` fijo en 20 para la V1;
- filtros admitidos únicamente por contrato actual;
- skeleton durante carga inicial y cambio de página;
- estado vacío con acción para limpiar filtros;
- error recuperable con botón de reintento;
- 404 uniforme para detalle inexistente/no visible;
- precio formateado con `Intl.NumberFormat` según locale y moneda;
- nunca asumir ni mostrar "por 1000", mínimo o máximo: la API actual no expone
  esa semántica;
- nunca renderizar HTML recibido del backend mediante `innerHTML`;
- nunca mostrar campos de proveedor, costo, payload, metadata o procedencia.

El CTA del detalle invita a iniciar sesión o anuncia la próxima experiencia de
compra. La creación de órdenes queda fuera de esta feature porque el contrato
público aún no expone cantidad mínima, máxima ni unidad de precio.

### 5.5 Autenticación

Contratos existentes:

```http
POST /auth/register
POST /auth/login
POST /v1/auth/refresh
POST /v1/auth/logout
```

Registro:

```json
{
  "nombre": "Oscar Navarro",
  "email": "oscar@example.com",
  "password": "Password123!"
}
```

Login:

```json
{
  "email": "oscar@example.com",
  "password": "Password123!"
}
```

Respuesta de registro/login:

```json
{
  "usuario": {
    "id": "user-id",
    "nombre": "Oscar Navarro",
    "email": "oscar@example.com",
    "rol": "cliente",
    "tiendaId": "tenant-id"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

Requisitos:

- formularios reactivos tipados;
- validaciones equivalentes al backend y mensajes traducidos;
- normalizar sólo email con `trim`; no alterar contraseña;
- estado de envío evita doble submit;
- conflicto de registro, credenciales inválidas, sesión expirada y error de red
  tienen mensajes comprensibles sin revelar detalles internos;
- `returnUrl` acepta únicamente rutas internas que comienzan con `/` y no con
  `//`; cualquier otra entrada se reemplaza por `/`;
- el estado de sesión se guarda en `sessionStorage`, no en `localStorage`;
- nunca registrar tokens en consola, errores, analytics o DOM;
- el interceptor sólo adjunta bearer a peticiones del API configurado;
- una respuesta 401 protegida dispara una sola renovación compartida; las
  peticiones concurrentes esperan el mismo resultado;
- refresh/login/logout no entran en bucle de reintento;
- si refresh falla, se limpia la sesión y se navega a login conservando un
  `returnUrl` interno;
- logout intenta revocar el refresh token y siempre limpia estado local;
- el rol del usuario se usa sólo para presentación. El frontend nunca se
  considera una frontera de autorización.

### 5.6 Tema claro y oscuro

- opciones: `light`, `dark`, `system`;
- predeterminado: `system`;
- preferencia guardada en `localStorage` porque no es un secreto;
- cambios sin recargar;
- se aplica `data-theme` en `<html>` antes de pintar contenido significativo;
- tokens de tema se originan en la configuración del tenant;
- todos los componentes consumen variables CSS semánticas, nunca hexadecimales
  de marca locales;
- ambos temas mantienen contraste WCAG AA para texto y acciones esenciales.

### 5.7 Idiomas

- locales iniciales: `es-MX` predeterminado y `en`;
- cambio en runtime sin recargar mediante Transloco;
- locale guardado en `localStorage` si está permitido por el tenant;
- fallback: `es-MX`;
- `lang` del documento se actualiza;
- fechas, números y monedas respetan el locale activo;
- no debe quedar texto visible de negocio escrito directamente en templates;
- errores técnicos desconocidos usan una traducción genérica.

## 6. Configuración white-label

La aplicación carga antes de sus rutas:

```text
/config/tenant-config.json
```

Contrato mínimo:

```ts
type ThemePreference = 'light' | 'dark' | 'system';
type PaymentAvailability = 'manual' | 'comingSoon' | 'disabled';

interface TenantUiConfig {
  version: 1;
  tenantSlug: string;
  apiBaseUrl: string;
  brand: {
    name: string;
    shortName: string;
    taglineKey: string;
    logoLightUrl?: string;
    logoDarkUrl?: string;
    faviconUrl?: string;
  };
  theme: {
    defaultPreference: ThemePreference;
    light: ThemeTokens;
    dark: ThemeTokens;
  };
  localization: {
    defaultLocale: 'es-MX' | 'en';
    supportedLocales: Array<'es-MX' | 'en'>;
  };
  socialLinks: {
    whatsappUrl?: string;
    tiktokUrl?: string;
    instagramUrl?: string;
  };
  catalog: {
    networks: CatalogNetworkConfig[];
    featuredLimit: number;
  };
  payments: PaymentMethodConfig[];
}
```

La validación de configuración rechaza:

- versión desconocida;
- tenant, marca, API o locales vacíos;
- URLs externas que no sean HTTPS, excepto `http://localhost` para desarrollo;
- colores que no puedan convertirse a tokens CSS permitidos;
- locale predeterminado ausente en `supportedLocales`;
- redes, categorías o métodos duplicados;
- métodos de pago marcados como disponibles automáticamente; ese estado no
  existe en esta feature.

Ante configuración inválida se muestra una pantalla de configuración no
disponible, sin lanzar una cascada de errores ni usar valores de otro tenant.

ImpulsoSocial usa inicialmente una identidad limpia basada en violeta, azul y
acentos sociales, con fondos claros neutros y fondo oscuro azul profundo. Si no
hay logo gráfico, se usa un wordmark accesible con el nombre configurado.

## 7. Estados visuales obligatorios

Cada vista asíncrona debe definir:

- carga inicial;
- carga secundaria/reintento;
- éxito;
- vacío;
- validación local;
- 400/401/404/409 conocidos;
- red no disponible;
- error inesperado sanitizado.

No se permite una pantalla en blanco, spinner infinito, alerta nativa del
navegador ni mensaje técnico de NestJS/npm/HTTP mostrado directamente.

## 8. Responsive y accesibilidad

Breakpoints de referencia, sin depender de dispositivos específicos:

| Rango | Comportamiento |
|---|---|
| `< 600px` | una columna, menú compacto, CTAs de ancho completo |
| `600–959px` | grid de dos columnas cuando haya espacio |
| `>= 960px` | navegación completa y grid de tres/cuatro columnas |

Requisitos:

- sin scroll horizontal a 320 px;
- targets táctiles de al menos 44×44 px;
- `header`, `nav`, `main`, `section`, `footer` y headings ordenados;
- skip link a contenido;
- todos los controles tienen nombre accesible;
- mensajes de formulario asociados al campo;
- actualizaciones críticas anunciadas mediante región `aria-live`;
- menús operables con teclado y Escape;
- foco restaurado al cerrar menú/modal;
- `prefers-reduced-motion` elimina animaciones no esenciales;
- imágenes con dimensiones y texto alternativo apropiado;
- iconos decorativos ocultos a lectores de pantalla.

## 9. Requisitos no funcionales

- Angular 22 standalone, TypeScript strict y Vitest.
- Componentes con `ChangeDetectionStrategy.OnPush`.
- Signals para estado de UI; RxJS para HTTP, concurrencia y streams.
- Lazy loading por feature.
- Ningún `any`, `as unknown as`, `eslint-disable` global ni `@ts-ignore`.
- Ningún componente hace HTTP directamente.
- Ninguna suscripción manual sin lifecycle seguro.
- Sin imágenes, fuentes o scripts hotlinkeados.
- Sin secretos ni credenciales de proveedores en `frontend/`.
- Bundle inicial de producción no debe superar el presupuesto actual de error
  configurado por Angular; cualquier incremento extraordinario se reporta.

## 10. Fuera de alcance

- modificar cualquier archivo de `backend/` o Prisma;
- endpoint real de configuración tenant;
- compra/creación de órdenes;
- wallet y movimientos;
- solicitudes o aprobación de depósitos;
- Stripe, PayPal, Mercado Pago o cripto automáticos;
- panel administrativo;
- SSR/SSG/PWA;
- analytics, píxeles publicitarios o cookies de rastreo;
- recuperación/cambio de contraseña;
- login social;
- redes diferentes a Instagram activas;
- búsqueda de texto no soportada por el backend;
- mostrar mínimo, máximo, tiempo promedio o precio por mil no expuestos por API.

## 11. Brechas de contrato registradas

Las siguientes necesidades quedan documentadas para features posteriores; el
frontend no las inventa:

1. `GET /v1/public/tenant-config` para reemplazar el JSON local.
2. Facetas públicas de catálogo con redes y nombres de categorías.
3. Cantidad mínima/máxima, unidad de precio y tipo de servicio públicos.
4. Endpoint `me` para reconstruir usuario actual desde estado servidor.
5. Sesión mediante refresh cookie HttpOnly si se decide endurecer el navegador.
6. Sesiones/webhooks backend para pagos automáticos.

## 12. Criterios de aceptación

- CA-001: build y tests base continúan pasando.
- CA-002: cambiar tenant-config cambia marca, tokens, enlaces, idiomas, redes y
  métodos sin editar componentes.
- CA-003: tema claro/oscuro/system cambia sin recarga y persiste.
- CA-004: español/inglés cambia sin recarga y no deja claves visibles.
- CA-005: landing completa funciona a 320, 768 y 1440 px.
- CA-006: catálogo muestra datos reales, paginación, filtros válidos y estados.
- CA-007: detalle inexistente muestra 404 propio.
- CA-008: registro/login usan contratos exactos y no duplican envíos.
- CA-009: refresh concurrente genera una sola petición.
- CA-010: logout limpia sesión aun si la revocación falla.
- CA-011: ningún token aparece en logs, DOM, URL o almacenamiento local.
- CA-012: ningún campo interno/proveedor aparece en modelos o UI.
- CA-013: enlaces sociales sólo aparecen cuando están configurados.
- CA-014: métodos no integrados indican `Próximamente` y no son accionables.
- CA-015: navegación esencial funciona únicamente con teclado.
- CA-016: no se modifica backend, esquema, migraciones ni specs anteriores.
