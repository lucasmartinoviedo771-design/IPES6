# Gestión de Docentes y Roles

Este documento detalla cómo se gestionan los docentes en el sistema, su vinculación con las cuentas de usuario, los diferentes roles que pueden asumir y las implicaciones de estos roles en términos de permisos y acceso a funcionalidades.

---

## 1. Modelo `Docente`

*   **Propósito:** El modelo `Docente` (`backend/core/models.py`) representa la información personal y académica de un profesor en el sistema.
*   **Campos Principales:**
    *   `nombre`, `apellido`: Nombre y apellido del docente.
    *   `dni`: Número de Documento Nacional de Identidad (único).
    *   `email`: Dirección de correo electrónico (opcional).
    *   `telefono`: Número de teléfono (opcional).
    *   `cuil`: Código Único de Identificación Laboral (único, opcional).
*   **Relación con `User` de Django:** Un registro `Docente` no tiene una clave foránea directa al modelo `User` de Django. Sin embargo, la lógica de la API (`_ensure_user_for_docente` en `backend/core/api.py`) se encarga de:
    *   Crear o actualizar una cuenta `User` de Django para cada `Docente`.
    *   Utilizar el DNI del docente como `username` para la cuenta de usuario.
    *   Sincronizar el `email`, `first_name` y `last_name` del `User` con los datos del `Docente`.
    *   Generar una contraseña temporal inicial si se crea un nuevo usuario.
    Esta vinculación asegura que cada docente tenga una cuenta de usuario para iniciar sesión en el sistema.

---

## 2. Modelo `StaffAsignacion`

*   **Propósito:** El modelo `StaffAsignacion` (`backend/core/models.py`) permite asignar roles específicos de "staff" (personal) a usuarios dentro del contexto de un `Profesorado` determinado. Esto proporciona una granularidad de permisos, permitiendo que un usuario tenga diferentes responsabilidades en distintas carreras.
*   **Campos Principales:**
    *   `user`: Clave foránea al `User` de Django al que se le asigna el rol.
    *   `profesorado`: Clave foránea al `Profesorado` específico donde el rol es aplicable.
    *   `rol`: Un campo `CharField` con opciones predefinidas que representan roles de personal:
        *   `BEDEL`
        *   `COORDINADOR`
        *   `TUTOR`
        *   `CURSO_INTRO`
*   **Relación:** Un `User` puede tener múltiples registros de `StaffAsignacion`, lo que significa que un mismo usuario puede, por ejemplo, ser bedel de un profesorado y coordinador de otro.

---

## 3. Roles de Django (`User` y `Group`)

*   Además de los roles definidos en `StaffAsignacion`, el sistema utiliza los grupos (`Group`) de Django para asignar roles más generales a los `User`s.
*   **Rol "docente":** La función `_ensure_docente_group(user)` en `backend/core/api.py` asegura que cada `User` asociado a un `Docente` sea añadido automáticamente al grupo "docente". Este grupo probablemente otorga permisos básicos para funcionalidades específicas de profesores.
*   **Otros Roles Generales:** Roles como `admin`, `secretaria`, `jefa_aaee`, `jefes`, `consulta`, `alumno` también se gestionan a través de grupos de Django.
*   **`ALL_ROLES`:** Una constante que lista todos los roles posibles en el sistema.
*   **`ROLE_ASSIGN_MATRIX`:** Un diccionario que define qué roles puede asignar un usuario con un rol determinado. Por ejemplo, un `admin` puede asignar cualquier rol, mientras que una `secretaria` puede asignar todos los roles excepto el de `admin`.

---

## 4. Gestión de `Docente`s y Asignación de Roles (Endpoints API)

Los siguientes endpoints en `backend/core/api.py` son responsables de la gestión de los registros de `Docente` y la asignación de sus roles:

*   **`GET /docentes` (Listar Docentes):**
    *   **Permisos:** Requiere roles de vista de estructura (`_ensure_structure_view`), que incluyen `admin`, `secretaria`, `bedel`, `coordinador`, `tutor`, `jefes`, `jefa_aaee`, `consulta`.
    *   Devuelve una lista de todos los docentes registrados, incluyendo su información personal y el `username` de su cuenta de usuario asociada.
*   **`POST /docentes` (Crear Docente):**
    *   **Permisos:** Requiere roles de edición de estructura (`_ensure_structure_edit`), es decir, `admin`, `secretaria`, `bedel`.
    *   Crea un nuevo registro `Docente` en la base de datos.
    *   Automáticamente crea o actualiza una cuenta `User` de Django para este docente y lo asigna al grupo "docente".
    *   Devuelve la información del docente, incluyendo la contraseña temporal si se creó un nuevo usuario.
*   **`GET /docentes/{docente_id}` (Obtener Docente):**
    *   **Permisos:** Requiere roles de vista de estructura (`_ensure_structure_view`).
    *   Devuelve la información detallada de un docente específico.
*   **`PUT /docentes/{docente_id}` (Actualizar Docente):**
    *   **Permisos:** Requiere roles de edición de estructura (`_ensure_structure_edit`).
    *   Actualiza los datos de un registro `Docente` existente.
    *   También actualiza los campos correspondientes (`email`, `first_name`, `last_name`) del `User` de Django asociado.
    *   Asegura que el `User` esté en el grupo "docente".
*   **`POST /docentes/{docente_id}/roles` (Asignar Rol a Docente):**
    *   **Permisos:** El usuario que realiza la solicitud debe tener permiso para asignar el `rol` específico, según lo definido en `_assignable_roles_for_user` y `ROLE_ASSIGN_MATRIX`.
    *   Permite asignar un `rol` (ej. `bedel`, `coordinador`, `tutor`) a un `Docente` (y su `User` asociado) para uno o varios `Profesorado`s.
    *   Si el rol requiere `Profesorado`s (como `bedel`, `coordinador`, `tutor`), se deben especificar los `profesorado_id`s.
    *   Crea o actualiza el `User` de Django para el docente, lo añade al `Group` correspondiente al rol y crea o actualiza registros en `StaffAsignacion` para vincular el `User` con el `Profesorado` y el `rol`.
*   **`DELETE /docentes/{docente_id}` (Eliminar Docente):**
    *   **Permisos:** Requiere roles de edición de estructura (`_ensure_structure_edit`).
    *   Elimina un registro `Docente`.

---

## 5. Implicaciones de los Roles

Los roles asignados a los usuarios (incluidos los docentes) determinan su nivel de acceso y las funcionalidades que pueden utilizar en el sistema:

*   **Roles de Edición de Estructura (`admin`, `secretaria`, `bedel`):** Estos roles tienen permisos para crear, actualizar y eliminar entidades fundamentales del sistema, como `Turno`, `Bloque`, `HorarioCatedra`, `HorarioCatedraDetalle` y los propios registros de `Docente`.
*   **Roles de Gestión Académica (`admin`, `secretaria`, `bedel`):** Estos roles tienen permisos para gestionar `Comision`es y las planillas de notas y regularidades.
*   **Roles de Vista de Estructura (más amplios):** Un conjunto más amplio de roles (que incluye `coordinador`, `tutor`, `jefes`, `jefa_aaee`, `consulta`) tiene permisos para consultar información de la estructura académica.
*   **Roles de `StaffAsignacion` (`bedel`, `coordinador`, `tutor`):** Estos roles están intrínsecamente vinculados a `Profesorado`s específicos. Esto significa que un usuario con uno de estos roles solo tiene autoridad y acceso a la información y funcionalidades relacionadas con los estudiantes y materias de los profesorados a los que está asignado.
*   **Rol "docente":** Este rol, asignado a todos los `Docente`s, probablemente otorga acceso a funcionalidades específicas para docentes, como la visualización de sus comisiones asignadas y la carga de notas en las planillas correspondientes.

---

**Conclusión:**

El sistema implementa un robusto sistema de gestión de docentes y roles. Los docentes se representan como entidades (`Docente`) que están estrechamente vinculadas a cuentas de usuario de Django (`User`). Los roles se asignan a estos usuarios a través de una combinación de grupos de Django (para roles generales) y el modelo `StaffAsignacion` (para roles de personal específicos de un `Profesorado`). Esta combinación permite un control de acceso granular y una gestión clara de las responsabilidades del personal docente y administrativo dentro de la institución.
