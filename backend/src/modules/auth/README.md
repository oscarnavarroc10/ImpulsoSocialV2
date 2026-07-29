# Auth Module

Módulo responsable de la autenticación y autorización de usuarios.

## Responsabilidades

- Registro de usuarios.
- Hash y validación de contraseñas.
- Inicio de sesión.
- Generación de access tokens.
- Generación y rotación de refresh tokens.
- Cierre de sesión.
- Administración de sesiones.
- Protección de endpoints.
- Autorización por roles.
- Obtención del usuario autenticado.

## Estructura

- `application`: casos de uso, contratos y DTOs.
- `domain`: entidades y reglas de dominio.
- `infrastructure`: implementaciones de persistencia y seguridad.
- `presentation`: controladores HTTP.
- `security`: guards, decorators y payloads de autenticación.