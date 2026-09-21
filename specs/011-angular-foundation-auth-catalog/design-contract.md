# Contrato de Diseño y Confiabilidad: ImpulsoSocial Storefront

Este documento es normativo para T002–T005 y para cualquier UI construida en
T006–T009. Si una decisión visual o de comportamiento contradice una
preferencia genérica del agente, prevalece este contrato.

## 1. Objetivo perceptual

La interfaz debe sentirse como una tienda digital mexicana moderna, clara y
confiable. Debe ayudar a descubrir y comprar servicios sociales sin parecer:

- un panel SMM técnico;
- una agencia editorial de lujo;
- una aplicación gamer, cripto o de apuestas;
- una plantilla oscura con efectos neón;
- una copia de BulkFollows.

La prioridad visual es: producto, claridad, confianza y conversión.

## 2. Prohibiciones visuales

No se permite:

- violeta o naranja como color del preset predeterminado; el preset Instagram
  puede usar magenta y naranja únicamente mediante tokens configurados;
- negro puro (`#000000`) como fondo o superficie; se usa grafito casi negro;
- glow, neón, glassmorphism intenso o sombras de color;
- degradados en botones, textos, campos o tarjetas ordinarias. Sólo se admite
  el degradado semántico `heroStart` → `heroEnd` en hero, bienvenida de cuenta
  y lienzo de autenticación;
- tipografía serif, display editorial o títulos gigantes;
- títulos principales mayores de 64 px en escritorio;
- numerales decorativos como `01`, líneas editoriales o bloques sin función;
- emoji, caracteres Unicode o fuentes de iconos como iconografía principal;
- datos, testimonios, estadísticas, precios o resultados inventados;
- estilos inline, elementos `<style>` o archivos de estilo propios de páginas;
- colores hexadecimales/rgb/hsl dentro de componentes o templates;
- animaciones que desplacen contenido o compitan con la compra.

Un shimmer neutro de skeleton es la única excepción a la prohibición de
degradados y queda desactivado con `prefers-reduced-motion`.

## 3. Identidad inicial del tenant ImpulsoSocial

### 3.1 Tema claro Aurora predeterminado

ImpulsoSocial inicia en `light`. El usuario puede elegir después `dark` o
`system`. La dirección Aurora toma la claridad de un SaaS comercial y la energía
de Spotify sin copiar interfaces externas. El modo oscuro sigue disponible y
usa exactamente:

| Token             | Valor     | Uso                             |
| ----------------- | --------- | ------------------------------- |
| `primary`         | `#1DB954` | CTA principal y marca           |
| `primaryContrast` | `#041108` | Texto sobre primario            |
| `secondary`       | `#53E389` | Links y acciones secundarias    |
| `accent`          | `#1ED760` | Categorías y detalles discretos |
| `background`      | `#080A09` | Fondo general grafito           |
| `surface`         | `#111513` | Header, tarjetas y formularios  |
| `surfaceElevated` | `#181D1A` | Secciones alternas              |
| `text`            | `#F5F7F6` | Texto principal                 |
| `textMuted`       | `#A7B0AB` | Texto secundario                |
| `border`          | `#29312C` | Bordes y divisores              |
| `success`         | `#34D399` | Confirmaciones                  |
| `warning`         | `#F5C451` | Advertencias                    |
| `danger`          | `#FF7B72` | Errores                         |
| `focus`           | `#73F3A4` | Foco visible                    |

### 3.2 Tema claro inicial

El claro conserva la identidad verde sobre neutros limpios:

| Token             | Valor     |
| ----------------- | --------- |
| `primary`         | `#12843D` |
| `primaryContrast` | `#FFFFFF` |
| `secondary`       | `#0B6B31` |
| `accent`          | `#1DB954` |
| `background`      | `#F3F6F4` |
| `surface`         | `#FFFFFF` |
| `surfaceElevated` | `#E9EFEB` |
| `text`            | `#0A0D0B` |
| `textMuted`       | `#56615A` |
| `border`          | `#D4DDD7` |
| `success`         | `#12843D` |
| `warning`         | `#9A6700` |
| `danger`          | `#B42318` |
| `focus`           | `#0B7A36` |

Estos valores pertenecen a `tenant-config.json`. Los componentes sólo consumen
variables CSS semánticas.

Los cuatro tokens visuales adicionales son `heroStart`, `heroEnd`,
`authSurface` y `authText`. Son obligatorios por preset/modo y no se aceptan
propiedades CSS arbitrarias desde JSON.

### 3.3 Presets visuales white-label

El modo de color (`light`, `dark`, `system`) y el preset visual son preferencias
independientes. ImpulsoSocial configura cuatro presets; cada uno debe tener
paletas completas clara y oscura:

| Clave       | Nombre visible | Dirección                               | Acento distintivo     |
| ----------- | -------------- | --------------------------------------- | --------------------- |
| `spotify`   | Verde          | comercial, energético, grafito          | `#1DB954`             |
| `minimal`   | Minimal        | monocromático, sobrio, radios reducidos | grises neutros        |
| `x`         | Estilo X       | contraste alto y controles redondeados  | `#1D9BF0`             |
| `instagram` | Instagram      | social, cálido y redondeado             | `#E1306C` / `#F77737` |

Reglas vinculantes:

- `spotify` es el preset inicial y `light` el modo inicial;
- la configuración aporta `defaultPreset`, `presets[]`, `labelKey` y las dos
  paletas completas; no hay colores escritos en componentes;
- el selector sólo muestra presets validados y traducidos;
- preset y modo se guardan con claves separadas y namespaced por tenant;
- un preset guardado que ya no existe vuelve a `defaultPreset` sin romper la UI;
- cambiar preset o modo aplica tokens sin recarga ni estado intermedio;
- ningún preset usa gradientes fuera de las tres superficies aprobadas, glow,
  texturas o datos falsos;
- el preset Instagram es la única excepción para magenta/naranja y nunca altera
  colores semánticos de éxito, advertencia o error.

## 4. Tipografía y ritmo

- Familia única: `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI",
sans-serif`.
- Texto base: 16 px, line-height de 1.55 a 1.7.
- Hero: `clamp(2.5rem, 5vw, 4rem)`, line-height mínimo 1.05.
- H2: `clamp(1.75rem, 3vw, 2.75rem)`.
- H3: 1.125–1.375 rem.
- Ancho legible de párrafo: máximo 65 caracteres.
- Escala de espacios: 4, 8, 12, 16, 24, 32, 48, 64 y 80 px.
- Radios: 10 px para controles, 14 px para tarjetas y 18 px para bloques
  destacados. No usar píldoras salvo badges cortos.
- Sombras: neutras y suaves; una sola elevación para header/tarjetas flotantes.

## 5. Arquitectura de estilos

Las páginas y layouts no contienen estilos propios. Todo estilo visual vive en:

```text
frontend/src/styles/
├── _reset.scss
├── _tokens.scss
├── _base.scss
├── _layout.scss
├── _components.scss
├── _pages.scss
├── _utilities.scss
└── _responsive.scss
```

`frontend/src/styles.scss` sólo importa esas capas en ese orden.

Reglas:

- no `styleUrls` ni `styles` en componentes de `features/**` o `layouts/**`;
- no estilos inline;
- selectores por clase, sin depender de profundidad del DOM;
- ningún `!important`, excepto la reducción global de movimiento;
- estados hover/focus/disabled/error están definidos para cada control;
- `:focus-visible` usa un outline de al menos 3 px con `--color-focus`;
- el estado de ruta activa no puede imitar el outline de teclado;
- ningún selector global cambia todos los botones/enlaces a ancho completo; se
  usan modificadores explícitos.

## 6. Iconografía y marca

- Crear SVG locales pequeños y auditables en
  `public/branding/impulsosocial/icons/`.
- Usar `currentColor`, `viewBox` y sin scripts/estilos embebidos.
- La configuración contiene una clave de icono validada, nunca SVG/HTML crudo.
- Claves iniciales: `instagram`, `followers`, `likes`, `views`, `reposts`,
  `comments`, `whatsapp`, `tiktok`, `sun`, `moon`, `system`, `menu`, `close`,
  `arrowRight`, `check`, `alert`.
- Si una clave no pertenece a la allow-list, la configuración es inválida.
- El logo inicial combina una marca geométrica local sencilla con el wordmark
  `ImpulsoSocial`. Si el asset no carga, se muestra el wordmark sin imagen rota.

## 7. Blueprint de la landing

### 7.1 Header

- Altura objetivo: 68–72 px en escritorio, 60–64 px en móvil.
- Marca a la izquierda; navegación simple en el centro; idioma, tema y sesión a
  la derecha.
- Fondo `surface`, borde inferior neutro y sombra mínima al hacer sticky.
- El CTA de login no domina sobre el CTA de catálogo.
- El control de tema permite elegir explícitamente Claro, Oscuro o Sistema; no
  se reduce a un botón ambiguo que alterna sólo dos estados.
- Un control separado permite elegir Verde, Minimal, Estilo X o Instagram. Los
  dos controles conservan etiquetas accesibles completas.
- En móvil, menú accesible; no ocultar idioma y tema sin alternativa.

### 7.2 Hero

- Debe caber junto con sus CTAs en el primer viewport de 768 px de alto.
- Escritorio: dos columnas 56/44; móvil: una columna.
- Título de máximo 12 palabras y máximo tres líneas en 320 px.
- CTA primario `Explorar servicios`; secundario `Cómo funciona` o FAQ.
- La segunda columna muestra una vista de descubrimiento construida únicamente
  con la red y categorías configuradas. No muestra precios, métricas o servicios
  falsos.
- Fondo Aurora con degradado controlado y superficies compactas; sin glow,
  texto degradado ni botones degradados.

### 7.3 Descubrimiento

- Mostrar Instagram como única red habilitada.
- Mostrar seguidores, likes, views y reposts con SVG local, título y microcopy.
- Tarjetas compactas; el contenido importante aparece antes que decoración.
- Una categoría sin `backendCategoryId` no crea un filtro falso.

### 7.4 Servicios destacados

- Antes de T008 muestra un estado vacío honesto y útil, no tarjetas inventadas.
- En T008 consume datos reales.
- Loading, empty y error no cambian drásticamente la altura de la sección.
- Precio, cuando exista, es prominente pero no más que el título del servicio.

### 7.5 Confianza y proceso

- Proceso en tres pasos con texto concreto.
- Beneficios sólo verificables: navegación clara, precios visibles, soporte
  configurado e historial futuro sólo cuando exista.
- No usar contadores, estrellas, clientes o resultados inventados.

### 7.6 Pagos, FAQ y cierre

- Los métodos de pago son informativos.
- Los métodos se presentan como tarjetas visuales con icono allow-listed,
  descripción y disponibilidad visual; no como tabla o lista de filas.
- `comingSoon` no admite click/teclado y no muestra promesas temporales como
  "Próximamente"; la ausencia de acción es suficiente.
- `manual` explica que requiere revisión; no inicia un flujo inexistente.
- FAQ usa `details/summary` accesible.
- CTA final compacto, fondo primario sólido y una única acción principal.
- Footer incluye marca, navegación, legales placeholder no enlazado y redes sólo
  cuando estén configuradas.

### 7.7 Autenticación

- `/login` y `/registro` muestran una sola tarjeta autocontenida y centrada; no
  usan una segunda columna promocional, un titular gigante ni contenido que
  obligue a desplazar la página en un escritorio de 1440×900.
- Ancho objetivo: máximo 560 px para login y 610 px para registro.
- La marca, el regreso a la tienda, el título, proveedores sociales, formulario,
  submit y cambio de ruta deben ser visibles como una sola composición.
- Google y Apple permanecen deshabilitados mientras no exista OAuth real, pero
  no llevan badges, subtítulos ni promesas de fecha o disponibilidad.
- En móvil, la tarjeta ocupa el ancho disponible con 16 px mínimos de margen y
  conserva targets táctiles de al menos 44 px.

## 8. Responsive obligatorio

### 320–599 px

- Una columna; sin scroll horizontal.
- Padding lateral mínimo 16 px.
- CTAs principales de ancho completo sólo cuando sea útil.
- Categorías en una columna o grid de dos si cada tarjeta conserva 144 px.
- Targets táctiles mínimos de 44×44 px.

### 600–959 px

- Dos columnas para categorías y tarjetas.
- Hero puede permanecer en una columna hasta disponer de 840 px efectivos.

### 960 px o más

- Contenedor máximo 1480 px; el contenido textual conserva medidas legibles y
  no se estira sólo por disponer de más ancho.
- Tres o cuatro columnas únicamente cuando cada tarjeta conserva legibilidad.
- El hero no supera aproximadamente 620 px de altura.

La validación manual se realiza en 320×568, 768×1024 y 1440×900, con zoom de
200 % al menos en la ruta principal.

## 9. Internacionalización completa

Los archivos obligatorios son:

```text
frontend/public/i18n/es-MX.json
frontend/public/i18n/en.json
```

Requisitos:

- mismas rutas, tipos y longitudes de arrays en ambos archivos;
- las claves construidas dinámicamente usan nombres estables (`pricing`,
  `explore`, `customization`), nunca índices de arrays como `home.trust.0`;
- ningún texto visible o accesible hardcodeado en templates/TypeScript, incluidos
  `aria-label`, `title`, loading, paginación, navegación y acciones de retry;
- fallback funcional a `es-MX` si falla un idioma secundario;
- un fallo de ambos archivos produce una vista crítica legible, nunca claves
  crudas ni una pantalla en blanco;
- el idioma activo actualiza `document.lang`;
- la preferencia se valida y se guarda con clave namespaced por tenant;
- un error de `localStorage` no interrumpe el cambio de idioma.

## 10. Contrato de confiabilidad en runtime

La aplicación sólo puede estar en uno de estos estados de arranque:

```text
loading → ready
loading → configurationError
```

No existe un estado implícito o una pantalla vacía.

### 10.1 Inicialización

- Todos los `inject()` del initializer se ejecutan sincrónicamente antes del
  primer `await`, callback asíncrono o suscripción.
- `TenantConfigService.load()` es idempotente y siempre resuelve a un resultado
  tipado; no deja rechazos sin manejar.
- Antes de cada carga limpia el error anterior y publica `loading`.
- Config válida se publica de forma atómica antes de iniciar tema/locale.
- Tema y locale no se inicializan sin config válida.
- Un fallo muestra `configurationError` con acción de reintento.
- Reintentar no recarga toda la página ni registra datos sensibles.

### 10.2 Servicios browser

- Acceso a `localStorage`, `sessionStorage`, `matchMedia` y listeners está
  encapsulado y protegido contra excepciones.
- Las claves persistidas incluyen `tenantSlug`.
- Los listeners usan una referencia estable y se eliminan al cambiar de modo o
  destruir el servicio.
- `ThemeService.initialize()` y `LocaleService.initialize()` son idempotentes.
- Preferencias corruptas se descartan sin impedir el arranque.
- Ningún método público deja el estado parcialmente actualizado si falla.

### 10.3 Estados asíncronos

Cada operación expone explícitamente `idle`, `loading`, `success`, `empty` o
`error`, según corresponda. Para todos los errores esperados:

- se captura la causa;
- se guarda sólo información sanitizada;
- se muestra una traducción segura;
- se ofrece retry cuando la operación es repetible;
- se evita spinner infinito, doble submit y actualización posterior a destroy.

Los errores de programación pueden propagarse a desarrollo, pero la shell debe
seguir mostrando una frontera de error comprensible en producción.

## 11. Pruebas que bloquean el punto de control A

T001–T005 no pueden marcarse terminadas hasta que existan y pasen pruebas de:

1. initializer real con `ApplicationInitStatus` o bootstrap equivalente;
2. todos los `inject()` resueltos antes del tramo asíncrono;
3. config válida, inválida, 404 y retry posterior exitoso;
4. ausencia de pantalla blanca en error de configuración;
5. allow-list completa de tokens e iconos;
6. tema light predeterminado, dark, system, cuatro presets, almacenamiento
   corrupto y cleanup;
7. locale predeterminado, cambio, fallback, storage fallido y `document.lang`;
8. paridad recursiva de traducciones, incluidos arrays y tipos;
9. ausencia de texto visible/accesible hardcodeado acordado;
10. menú por teclado, Escape, restauración de foco y bloqueo de scroll;
11. links sociales condicionales y URLs seguras;
12. landing con orden, headings, CTAs, pagos no accionables y sin datos falsos;
13. 320, 768 y 1440 sin overflow horizontal;
14. smoke de navegación de `/`, `/about`, `/faq` y una ruta inexistente;
15. consola sin errores durante el arranque exitoso y el fallo controlado.

El punto de control A requiere al menos 25 pruebas focalizadas reales, además de
build, test completo y `git diff --check` exitosos.

## 12. Criterio visual de aceptación

La implementación se rechaza si sucede cualquiera:

- el tema inicial vuelve a depender del modo del sistema en vez de iniciar claro;
- aparece morado/naranja fuera del preset Instagram, negro puro, glow,
  degradado fuera de las superficies aprobadas o tipografía serif;
- aparece una clave cruda como `home.trust.0` o falla un preset configurado;
- el CTA principal no aparece en 1440×900 sin scroll;
- el título ocupa más de tres líneas en 320 px;
- login o registro muestran un panel promocional lateral o requieren scroll en
  1440×900 sin errores de validación abiertos;
- Google o Apple muestran "Próximamente" o cualquier promesa temporal;
- una acción futura parece habilitada;
- se ve una clave de traducción o texto técnico;
- cualquier error produce pantalla blanca;
- se usan emoji/Unicode como iconos;
- una página contiene estilo local o inline;
- hay errores en consola o scroll horizontal en los viewports obligatorios.
