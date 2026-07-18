# ImpulsoSocialV2 Constitution

## Core Principles

### I. Especificación antes que implementación

Toda funcionalidad debe iniciar con una Specification aprobada antes de escribir código de producción.

El flujo oficial del proyecto es:

Constitution → Specify → Clarify cuando aplique → Plan → Tasks → Analyze → Implement → Pull Request → Review → Merge.

Los agentes de IA no podrán implementar comportamiento que no esté definido en una Specification aprobada.

Se deberá ejecutar Clarify cuando existan ambigüedades relacionadas con:

- Reglas de negocio.
- Seguridad.
- Dinero.
- Órdenes.
- Proveedores externos.
- Arquitectura.
- Multi-tenancy.
- Aislamiento de datos.
- Contratos públicos de API.

---

### II. La arquitectura es una decisión humana

Los agentes de IA pueden proponer soluciones, pero no pueden introducir silenciosamente:

- Nuevas tecnologías.
- Dependencias importantes.
- Servicios externos.
- Colas.
- Cachés.
- Microservicios.
- Proveedores.
- Patrones arquitectónicos.
- Cambios en el modelo multi-tenant.
- Cambios en contratos públicos.

Toda decisión arquitectónica importante deberá contar con aprobación explícita y documentarse mediante un ADR antes de su implementación.

Se utilizará la arquitectura más simple que satisfaga los requisitos aprobados.

No se introducirán microservicios salvo aprobación explícita.

---

### III. Multi-tenancy y aislamiento de datos

ImpulsoSocialV2 será una plataforma White Label multi-tenant.

Cada subpanel será tratado como un tenant independiente dentro de una aplicación compartida.

Todo dato perteneciente a un tenant deberá identificarse y aislarse mediante un `TenantId` o mecanismo equivalente aprobado.

Ninguna consulta, operación, caché, archivo, evento, log o proceso en segundo plano podrá mezclar información entre tenants.

Las operaciones que accedan a información de un tenant deberán validar explícitamente el contexto del tenant.

El aislamiento entre tenants es un requisito de seguridad no negociable.

Los agentes no podrán eliminar filtros de tenant, crear consultas globales o compartir recursos entre tenants sin aprobación explícita.

---

### IV. Configuración base y personalización White Label

El sistema deberá contar con una configuración base funcional.

Los tenants podrán sobrescribir únicamente las configuraciones autorizadas, incluyendo cuando corresponda:

- Nombre comercial.
- Logotipo.
- Favicon.
- Colores.
- Tipografías.
- Textos públicos.
- Dominio personalizado.
- Catálogo habilitado.
- Precios.
- Márgenes.
- Información de soporte.

Cuando un tenant no tenga un valor personalizado, deberá heredar el valor correspondiente de la configuración base.

La personalización visual no deberá requerir duplicar el código fuente, desplegar una aplicación distinta ni modificar manualmente la aplicación por tenant.

Las excepciones a este modelo deberán documentarse y aprobarse mediante un ADR.

---

### V. Propiedad local del catálogo y del producto

ImpulsoSocialV2 deberá mantener su propio modelo de producto.

El catálogo del proveedor externo nunca deberá exponerse directamente a los usuarios finales.

La aplicación será propietaria de:

- Redes sociales.
- Categorías.
- Servicios.
- Nombres comerciales.
- Descripciones.
- Precios.
- Márgenes.
- Estados.
- Disponibilidad.
- Orden visual.
- Configuración por tenant.

Los servicios externos deberán mapearse a servicios locales mediante identificadores internos.

Los identificadores, nombres, categorías y respuestas del proveedor no deberán convertirse automáticamente en contratos públicos del sistema.

Un cambio de proveedor o de servicio externo no deberá obligar a modificar la experiencia pública del usuario.

---

### VI. Catálogo curado y experiencia controlada

La interfaz no deberá saturarse con todos los servicios disponibles en el proveedor externo.

La aplicación deberá utilizar un catálogo local, curado y configurable.

La selección de servicios podrá considerar criterios como:

- Estado del servicio.
- Red social.
- Categoría.
- Precio del proveedor.
- Cantidad mínima.
- Cantidad máxima.
- Velocidad.
- Refill.
- Calidad.
- Retención.
- Historial de fallos.
- Aprobación administrativa.

El número máximo de servicios mostrados por categoría deberá ser configurable.

La selección automática deberá permitir intervención administrativa.

Un administrador autorizado podrá:

- Incluir servicios.
- Excluir servicios.
- Fijar servicios.
- Cambiar el orden.
- Modificar el límite visible.
- Desactivar temporalmente un servicio.

La selección automática nunca deberá publicar servicios directamente sin pasar por las reglas aprobadas del catálogo local.

Las reglas específicas de selección deberán definirse en una Specification y, cuando afecten la arquitectura o el modelo de datos, en un ADR.

---

### VII. Integración segura con proveedores externos

El frontend nunca deberá comunicarse directamente con BulkFollows ni con ningún otro proveedor externo.

Toda integración externa deberá ejecutarse desde el backend.

Las credenciales del proveedor deberán existir únicamente en configuración segura del backend.

Nunca deberán:

- Guardarse en el repositorio.
- Enviarse al frontend.
- Retornarse en respuestas.
- Escribirse en logs.
- Incluirse en excepciones públicas.

La validación TLS nunca podrá deshabilitarse.

La integración con proveedores deberá aislarse mediante un adapter, client o abstracción equivalente.

La lógica del dominio no deberá depender directamente de los payloads específicos del proveedor.

---

### VIII. Integridad de órdenes y operaciones financieras

Los identificadores internos y los identificadores del proveedor deberán almacenarse por separado.

La aplicación deberá distinguir explícitamente entre:

- Precio del proveedor.
- Precio del cliente.
- Margen.
- Saldo.
- Cargo.
- Reembolso.
- Ajuste.
- Movimiento de wallet.

Los valores monetarios nunca deberán calcularse mediante tipos de punto flotante.

Toda operación financiera deberá ser auditable.

Las operaciones que puedan generar cargos, movimientos de saldo u órdenes externas no deberán reintentarse automáticamente salvo que exista una garantía explícita de idempotencia.

El sistema deberá prevenir la creación accidental de órdenes duplicadas.

Una respuesta desconocida o incompleta del proveedor nunca deberá interpretarse automáticamente como éxito.

---

### IX. Contratos de API y compatibilidad

Todos los endpoints públicos deberán estar versionados.

OpenAPI y Swagger deberán mantenerse sincronizados con la implementación.

Los siguientes elementos deberán documentarse:

- DTOs.
- Enums.
- Validaciones.
- Respuestas exitosas.
- Errores estándar.
- Ejemplos.
- Reglas de autorización.
- Contexto del tenant cuando aplique.

El frontend deberá depender de contratos internos documentados y no de payloads específicos del proveedor.

Todo cambio incompatible en una API pública requerirá:

- Aprobación explícita.
- Documentación.
- Estrategia de migración.
- Actualización de versión cuando corresponda.

---

### X. Calidad antes que velocidad

Todo cambio deberá ser pequeño, revisable y trazable.

Antes de considerar una tarea terminada deberá comprobarse que:

- El proyecto compile correctamente.
- No existan errores de lint.
- El type checking sea exitoso.
- Los tests afectados pasen.
- Swagger permanezca actualizado.
- Las migraciones sean revisables.
- La documentación permanezca alineada.
- El aislamiento multi-tenant no haya sido debilitado.

Nunca se aceptará código únicamente porque aparentemente funciona.

---

### XI. Seguridad por defecto

Toda decisión deberá priorizar la seguridad.

Como mínimo:

- Nunca almacenar secretos en el repositorio.
- Nunca registrar API Keys, JWT, tokens o credenciales.
- Nunca deshabilitar TLS.
- Validar todas las variables de entorno.
- Validar entradas en los límites del sistema.
- Aplicar autorización en el backend.
- Evitar exposición de errores internos.
- Sanitizar logs.
- Limitar información en health checks.
- Proteger el aislamiento entre tenants.

El frontend nunca deberá considerarse una barrera de seguridad.

---

### XII. Simplicidad y mantenibilidad

Se favorecerá la solución más simple que satisfaga los requisitos aprobados.

No se introducirán patrones, capas, abstracciones o infraestructura sin una necesidad demostrable.

El código deberá ser fácil de entender antes que ingenioso.

No se realizarán refactors no relacionados dentro de una feature.

La duplicación temporal y controlada podrá aceptarse cuando sea más segura que una abstracción prematura.

---

## Requisitos Técnicos

### Stack oficial

Backend:

- Node.js.
- TypeScript.
- NestJS.

Persistencia:

- MySQL.
- Prisma ORM.

Frontend:

- Vue.js.

Documentación:

- OpenAPI.
- Swagger.
- Specifications.
- ADRs.

Control de versiones:

- Git.
- GitHub.

Metodología:

- Spec-Driven Development.
- GitHub Spec Kit.

---

### Reglas de arquitectura

- Los controllers deberán ser delgados.
- La lógica de negocio deberá residir en services o componentes de dominio.
- El acceso a datos deberá realizarse mediante Prisma.
- Las integraciones externas deberán aislarse mediante adapters o clients.
- Los DTOs no deberán utilizarse como entidades persistentes.
- Las entidades persistentes no deberán exponerse directamente como respuestas públicas.
- Todo endpoint público deberá documentarse mediante Swagger.
- Toda API pública deberá estar versionada.
- El contexto del tenant deberá resolverse y validarse en el backend.
- Las consultas de datos pertenecientes a tenants deberán estar filtradas por tenant.
- Los procesos en segundo plano deberán conservar explícitamente el contexto del tenant.
- Los archivos y recursos deberán asociarse al tenant correspondiente.
- Las claves de caché, cuando existan, deberán incluir el identificador del tenant.
- Las integraciones externas no deberán filtrar payloads específicos hacia el frontend.

---

### Persistencia y migraciones

- Todas las migraciones deberán estar versionadas.
- Ningún cambio de esquema deberá aplicarse manualmente en producción.
- Las migraciones deberán poder revisarse antes de ejecutarse.
- Las restricciones importantes deberán existir también en la base de datos cuando sea técnicamente viable.
- Las relaciones entre datos de tenants deberán conservar el aislamiento esperado.
- El uso de soft delete deberá documentarse por entidad.
- No se utilizará sincronización automática destructiva del esquema en producción.

---

### Observabilidad y manejo de fallos

Se utilizarán logs estructurados.

Los flujos importantes deberán incluir identificadores de correlación.

Cuando corresponda, los logs deberán incluir de manera segura:

- Tenant.
- Operación.
- Acción del proveedor.
- Duración.
- Resultado.
- Código de error sanitizado.

Nunca deberán incluir credenciales ni payloads sensibles completos.

Las llamadas externas deberán tener:

- Timeout de conexión.
- Timeout de solicitud.
- Manejo controlado de errores.
- Reintentos limitados solo para operaciones seguras.
- Backoff cuando sea apropiado.

Las operaciones no idempotentes no deberán reintentarse ciegamente.

---

## Flujo de Desarrollo

Todo desarrollo deberá seguir este flujo:

1. Constitution.
2. Specification.
3. Clarify, cuando existan ambigüedades.
4. Plan.
5. Tasks.
6. Analyze.
7. Implementación.
8. Pull Request.
9. Review.
10. Merge.

Reglas adicionales:

- No desarrollar directamente sobre `main`.
- Todo cambio deberá realizarse mediante una feature branch.
- Todo Pull Request deberá ser revisado antes de integrarse.
- Todo PR deberá referenciar su Specification.
- No se deberán mezclar funcionalidades no relacionadas en un mismo PR.
- Los agentes deberán generar cambios pequeños y revisables.
- Ningún agente podrá modificar una Specification aprobada para hacer coincidir código incorrecto.
- Los cambios de arquitectura requerirán ADR.
- Los cambios de comportamiento requerirán actualizar la documentación correspondiente.
- No se modificará la infraestructura generada por Spec Kit sin una razón intencional y documentada.

---

## Quality Gates

Antes de aprobar un Pull Request se deberá validar:

- Cumplimiento de la Specification.
- Cumplimiento de la Constitución.
- Cumplimiento de ADRs aplicables.
- Correcto aislamiento entre tenants.
- Ausencia de secretos.
- Ausencia de credenciales en logs.
- Swagger actualizado.
- DTOs y validaciones sincronizados.
- Tests relevantes exitosos.
- Type checking exitoso.
- Lint exitoso.
- Migraciones revisadas.
- Ausencia de refactors no relacionados.
- Manejo seguro de operaciones financieras.
- Manejo seguro de operaciones no idempotentes.

---

## Governance

La Constitución representa la máxima autoridad técnica del proyecto.

Toda Specification, Plan, Task, ADR, implementación y Pull Request deberá respetar los principios definidos en este documento.

Cuando exista un conflicto, esta Constitución tendrá prioridad sobre sugerencias de implementación, decisiones generadas por IA o preferencias de herramientas.

Las modificaciones a esta Constitución requerirán:

- Justificación.
- Revisión.
- Actualización de versión.
- Fecha de modificación.
- Evaluación del impacto sobre Specifications activas.
- Evaluación del impacto sobre ADRs existentes.
- Evaluación del impacto sobre templates de Spec Kit.

El versionado de la Constitución seguirá Semantic Versioning:

- MAJOR: cambios incompatibles en principios o gobernanza.
- MINOR: incorporación de nuevos principios o ampliaciones materiales.
- PATCH: aclaraciones sin cambio de significado.

**Version**: 1.1.0  
**Ratified**: 2026-07-17  
**Last Amended**: 2026-07-17