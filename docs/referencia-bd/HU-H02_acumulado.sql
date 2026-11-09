-- ============================================================
-- SCRIPT PARA BASE DE DATOS NUEVA: HU-U01 + HU-U02 + HU-S01 + HU-S02 + HU-S03 + HU-H01 + HU-H02
-- Sistema Web de Reservas FISI — Grupo 5
-- Motor: PostgreSQL
-- Versión: SOLO ESTRUCTURA (Atributos + Restricciones)
-- Ejecutar completo, de arriba a abajo, en una base de datos vacía.
--   Parte 1: HU-U01 (alineada al modelo completo v4 + bloqueo/OTP)
--   Parte 2: HU-U02
--   Parte 3: HU-S01
--   Parte 4: HU-S02
--   Parte 5: HU-S03
--   Parte 6: HU-H01
--   Parte 7: HU-H02 (nueva)
-- La lógica (triggers, vistas, cálculos) la maneja el backend.
-- ============================================================


-- ############################################################
-- PARTE 1 — HU-U01
-- ############################################################

-- ============================================================
-- HU-U01: Registro e inicio de sesión de usuario
-- ============================================================
-- Cambios respecto a la v2 entregada:
--   - fecha_registro pasa a fecha_creacion + fecha_actualizacion
--     (convención del modelo completo v4).
--   - El correo es único SIN distinguir mayúsculas (índice LOWER).
--   - Se quitan los índices simples sobre codigo_dni y correo:
--     los UNIQUE ya crean su propio índice.
--   - Se agregan atributos de bloqueo y recuperación OTP, que el
--     Informe Técnico reporta como implementados (CA-03, CA-04, CA-05).
-- ============================================================
-- Criterios de aceptación cubiertos por la estructura:
-- 1. Registro con código/DNI, nombre, correo y contraseña
--    -> columnas codigo_dni, nombre, correo, password_hash
-- 2. El código/DNI (y el correo) no puede estar ya registrado
--    -> UNIQUE sobre codigo_dni y sobre LOWER(correo)
-- 3-4. Inicio de sesión / error por credenciales incorrectas
--    -> intentos_fallidos y bloqueado (bloqueo al 3er intento)
-- 5. El sistema reconoce al usuario con su rol
--    -> columna rol
-- Recuperación de contraseña (Informe Técnico CA-04/CA-05)
--    -> otp_hash y otp_expira (OTP de 6 dígitos, 15 min de vigencia)
-- ============================================================

-- ------------------------------------------------------------
-- TIPO ENUMERADO PARA EL ROL
-- ------------------------------------------------------------
CREATE TYPE rol_usuario AS ENUM (
    'alumno',
    'docente',
    'administrativo',
    'foraneo',
    'externo'
);


-- ============================================================
-- ATRIBUTOS  (tabla usuarios)
-- ============================================================
CREATE TABLE usuarios (
    id                   SERIAL,
    codigo_dni           VARCHAR(20)   NOT NULL,
    nombre               VARCHAR(150)  NOT NULL,
    correo               VARCHAR(150)  NOT NULL,
    password_hash        VARCHAR(255)  NOT NULL,   -- nunca se guarda la contraseña en texto plano
    rol                  rol_usuario   NOT NULL DEFAULT 'alumno',

    -- Bloqueo por intentos fallidos (Informe Técnico CA-03)
    intentos_fallidos    SMALLINT      NOT NULL DEFAULT 0,
    bloqueado            BOOLEAN       NOT NULL DEFAULT FALSE,

    -- Recuperación de contraseña por OTP (Informe Técnico CA-05).
    -- Se guarda el hash del código, no el código en texto plano.
    otp_hash             VARCHAR(255),
    otp_expira           TIMESTAMP,

    fecha_creacion       TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP     NOT NULL DEFAULT NOW(),

    -- ========================================================
    -- RESTRICCIONES
    -- ========================================================
    CONSTRAINT pk_usuarios PRIMARY KEY (id),

    -- Criterio 2: el código/DNI no puede repetirse
    CONSTRAINT uq_usuarios_codigo_dni UNIQUE (codigo_dni),

    -- Validación básica de formato del código/DNI (alfanumérico, 6-20 caracteres)
    CONSTRAINT chk_usuarios_codigo_dni_formato CHECK (codigo_dni ~ '^[A-Za-z0-9]{6,20}$'),

    -- Validación básica de formato de correo (algo@algo.algo)
    CONSTRAINT chk_usuarios_correo_formato CHECK (correo ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

    CONSTRAINT chk_usuarios_intentos CHECK (intentos_fallidos >= 0),

    -- El OTP y su vencimiento van siempre juntos
    CONSTRAINT chk_usuarios_otp CHECK (
        (otp_hash IS NULL AND otp_expira IS NULL)
        OR (otp_hash IS NOT NULL AND otp_expira IS NOT NULL)
    )
);

-- El correo también funciona como validador: único sin distinguir mayúsculas
CREATE UNIQUE INDEX uq_usuarios_correo ON usuarios (LOWER(correo));



-- ############################################################
-- PARTE 2 — HU-U02
-- ############################################################

-- ============================================================
-- HU-U02: Registro y validación de personal administrativo
-- ============================================================
-- No se crea una tabla nueva: HU-U02 reutiliza la tabla usuarios.
-- Se agregan columnas que solo se usan cuando rol = 'administrativo'
-- y quedan en NULL para los demás roles.
--
-- Criterios de aceptación cubiertos:
-- 1. Documento/código que acredita el cargo
--    -> columna documento_validacion (obligatoria para administrativos)
-- 2. Cuenta en estado pendiente hasta la validación
--    -> columna estado_validacion ('pendiente' al registrarse)
-- 3. Un administrador aprueba o rechaza el registro
--    -> columna validado_por: RELACIÓN AUTO-REFERENCIAL (FK a usuarios)
-- 4. Rol administrativo efectivo una vez aprobado
--    -> rol = 'administrativo' AND estado_validacion = 'aprobado'
-- 5. Notificación con el motivo si es rechazado
--    -> columna comentario_validacion (obligatoria si se rechaza)
-- ============================================================

-- ------------------------------------------------------------
-- TIPO ENUMERADO PARA EL ESTADO DE VALIDACIÓN
-- ------------------------------------------------------------
CREATE TYPE estado_validacion_usuario AS ENUM (
    'pendiente',
    'aprobado',
    'rechazado'
);


-- ------------------------------------------------------------
-- ATRIBUTOS NUEVOS
-- ------------------------------------------------------------
ALTER TABLE usuarios
    ADD COLUMN documento_validacion   VARCHAR(100),
    ADD COLUMN estado_validacion      estado_validacion_usuario,
    ADD COLUMN comentario_validacion  TEXT,
    ADD COLUMN fecha_validacion       TIMESTAMP,
    ADD COLUMN validado_por           INTEGER;   -- admin que aprobó o rechazó


-- ------------------------------------------------------------
-- RESTRICCIONES
-- ------------------------------------------------------------

-- Criterio 3: relación auto-referencial (un admin valida a otro).
ALTER TABLE usuarios
    ADD CONSTRAINT fk_usuarios_validado_por
    FOREIGN KEY (validado_por) REFERENCES usuarios (id) ON DELETE SET NULL;

-- Criterios 1 y 2: los datos de validación van atados al rol.
ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_admin_validacion CHECK (
        (rol = 'administrativo'
            AND documento_validacion IS NOT NULL
            AND estado_validacion IS NOT NULL)
        OR
        (rol <> 'administrativo'
            AND estado_validacion IS NULL)
    );

-- Criterio 5: un rechazo siempre lleva motivo
ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_rechazo_con_motivo CHECK (
        estado_validacion IS DISTINCT FROM 'rechazado'
        OR comentario_validacion IS NOT NULL
    );

-- Si ya fue aprobado o rechazado, debe tener fecha de validación
ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_validacion_con_fecha CHECK (
        estado_validacion IS NULL
        OR estado_validacion = 'pendiente'
        OR fecha_validacion IS NOT NULL
    );

-- Nadie se valida a sí mismo
ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuarios_no_autovalidacion
    CHECK (validado_por <> id);


-- ------------------------------------------------------------
-- ÍNDICE
-- ------------------------------------------------------------
-- Panel de administración: listar rápido los registros pendientes
CREATE INDEX idx_usuarios_validacion_pendiente
    ON usuarios (fecha_creacion)
    WHERE estado_validacion = 'pendiente';



-- ############################################################
-- PARTE 3 — HU-S01
-- ############################################################

-- ============================================================
-- HU-S01: Enviar solicitud de reserva de espacio
-- ============================================================
-- Tablas nuevas: lugares, horarios, solicitudes, reservas.
--   - lugares: completa, como en el modelo v4.
--   - horarios: versión mínima, solo para espacios (id_lugar).
--       HU-S02 agrega id_objeto; HU-H01 el control de cruces;
--       HU-H02 el motivo de no disponible.
--   - solicitudes: sin atendido_por / fecha_atencion (llegan con HU-A01).
--   - reservas: como en el modelo v4.
-- Los tipos enumerados se crean completos desde ya, para no tener
-- que modificarlos en cada entrega.
--
-- Criterios de aceptación cubiertos:
-- 1. Seleccionar espacio, fecha y horario disponible
--    -> reservas.id_lugar + reservas.id_horario (horarios.fecha,
--       hora_inicio, hora_fin). FK compuesta: el horario debe ser
--       de ese mismo lugar.
-- 2. Indicar el motivo
--    -> solicitudes.motivo (obligatorio)
-- 3. Estado inicial 'pendiente' y prioridad 'normal'
--    -> solicitudes.estado y solicitudes.prioridad con esos defaults
-- 4. No se pueden elegir horarios no disponibles u ocupados
--    -> horarios.estado (el backend filtra por 'disponible')
-- 5. Confirmación de envío
--    -> se resuelve en backend/frontend; la solicitud queda
--       registrada con fecha_creacion
-- ============================================================


-- ------------------------------------------------------------
-- TIPOS ENUMERADOS
-- ------------------------------------------------------------
-- Estado general de un espacio (y de los equipos en HU-S02)
CREATE TYPE estado_recurso AS ENUM (
    'activo',
    'mantenimiento',
    'inactivo'
);

-- Estado de un bloque de horario
CREATE TYPE estado_horario AS ENUM (
    'disponible',
    'no_disponible',
    'ocupado'
);

-- En HU-S01 solo se usa 'reserva'; 'prestamo' y 'conjunta' son de HU-S02
CREATE TYPE tipo_solicitud AS ENUM (
    'reserva',
    'prestamo',
    'conjunta'
);

-- Criterio 3: 'normal' por defecto (HU-A02 permite cambiarla)
CREATE TYPE prioridad_solicitud AS ENUM (
    'baja',
    'normal',
    'alta'
);

-- Criterio 3: 'pendiente' al crear. El resto lo usan HU-A01 y HU-S04
CREATE TYPE estado_solicitud AS ENUM (
    'pendiente',
    'recibida',
    'aceptada',
    'declinada',
    'cancelada'
);


-- ============================================================
-- TABLA lugares  (espacios: auditorio, patio, salas...)
-- ============================================================
CREATE TABLE lugares (
    id                   SERIAL,
    nombre               VARCHAR(100)   NOT NULL,
    descripcion          TEXT,
    ubicacion            VARCHAR(150),             -- ej. "Pabellón antiguo, 1er piso"
    capacidad            INTEGER        NOT NULL,
    precio               NUMERIC(10,2)  NOT NULL DEFAULT 0,   -- precio base
    estado               estado_recurso NOT NULL DEFAULT 'activo',
    -- Qué roles pueden solicitar este espacio
    roles_permitidos     rol_usuario[]  NOT NULL DEFAULT '{alumno,docente}',
    fecha_creacion       TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_lugares PRIMARY KEY (id),
    CONSTRAINT uq_lugares_nombre UNIQUE (nombre),
    CONSTRAINT chk_lugares_capacidad CHECK (capacidad > 0),
    CONSTRAINT chk_lugares_precio CHECK (precio >= 0),
    CONSTRAINT chk_lugares_roles CHECK (cardinality(roles_permitidos) > 0)
);


-- ============================================================
-- TABLA horarios  (bloques de tiempo de cada espacio)
-- ============================================================
CREATE TABLE horarios (
    id                   SERIAL,
    id_lugar             INTEGER        NOT NULL,  -- HU-S02 lo vuelve opcional al agregar id_objeto
    fecha                DATE           NOT NULL,
    hora_inicio          TIME           NOT NULL,
    hora_fin             TIME           NOT NULL,
    estado               estado_horario NOT NULL DEFAULT 'disponible',  -- criterio 4
    creado_por           INTEGER        NOT NULL,  -- administrativo que lo registró
    fecha_creacion       TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_horarios PRIMARY KEY (id),

    CONSTRAINT fk_horarios_lugar FOREIGN KEY (id_lugar)
        REFERENCES lugares (id) ON DELETE RESTRICT,
    CONSTRAINT fk_horarios_creado_por FOREIGN KEY (creado_por)
        REFERENCES usuarios (id) ON DELETE RESTRICT,

    CONSTRAINT chk_horarios_rango CHECK (hora_fin > hora_inicio),

    -- Necesario para la FK compuesta de reservas
    -- (garantiza que el horario elegido sea del mismo lugar)
    CONSTRAINT uq_horarios_id_lugar UNIQUE (id, id_lugar)
);

-- Criterio 1: listar los horarios de un espacio por fecha
CREATE INDEX idx_horarios_lugar_fecha ON horarios (id_lugar, fecha);


-- ============================================================
-- TABLA solicitudes  (cabecera de la solicitud)
-- ============================================================
CREATE TABLE solicitudes (
    id                   SERIAL,
    id_usuario           INTEGER             NOT NULL,   -- quien envía la solicitud
    tipo                 tipo_solicitud      NOT NULL DEFAULT 'reserva',
    prioridad            prioridad_solicitud NOT NULL DEFAULT 'normal',     -- criterio 3
    estado               estado_solicitud    NOT NULL DEFAULT 'pendiente',  -- criterio 3
    motivo               TEXT                NOT NULL,                      -- criterio 2
    monto_total          NUMERIC(10,2)       NOT NULL DEFAULT 0,  -- informativo, lo calcula el backend
    fecha_creacion       TIMESTAMP           NOT NULL DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP           NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_solicitudes PRIMARY KEY (id),

    CONSTRAINT fk_solicitudes_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id) ON DELETE RESTRICT,

    CONSTRAINT chk_solicitudes_motivo CHECK (length(trim(motivo)) > 0),
    CONSTRAINT chk_solicitudes_monto CHECK (monto_total >= 0)
);

-- "Mis solicitudes" del usuario, ordenadas por fecha
CREATE INDEX idx_solicitudes_usuario ON solicitudes (id_usuario, fecha_creacion DESC);


-- ============================================================
-- TABLA reservas  (detalle: el espacio de una solicitud)
-- ============================================================
CREATE TABLE reservas (
    id                   SERIAL,
    id_solicitud         INTEGER  NOT NULL,
    id_horario           INTEGER  NOT NULL,
    id_lugar             INTEGER  NOT NULL,

    CONSTRAINT pk_reservas PRIMARY KEY (id),

    CONSTRAINT fk_reservas_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes (id) ON DELETE CASCADE,

    -- Criterio 1: FK compuesta, el horario elegido debe pertenecer a ESE lugar.
    -- RESTRICT: no se puede borrar un horario que ya fue reservado.
    CONSTRAINT fk_reservas_horario_lugar FOREIGN KEY (id_horario, id_lugar)
        REFERENCES horarios (id, id_lugar) ON DELETE RESTRICT,

    -- Un solo espacio por solicitud
    CONSTRAINT uq_reservas_solicitud UNIQUE (id_solicitud)
);

CREATE INDEX idx_reservas_horario ON reservas (id_horario);


-- ############################################################
-- PARTE 4 — HU-S02
-- ############################################################

-- ============================================================
-- HU-S02: Enviar solicitud de préstamo de equipo (simple o conjunta)
-- ============================================================
-- Tablas nuevas: objetos, prestamos.
-- Tablas modificadas:
--   - horarios: ahora un bloque puede ser de un lugar O de un objeto.
--   - reservas: se permite reservar VARIOS bloques en una solicitud
--     (decisión de escalabilidad, igual que en prestamos).
--
-- Decisiones de diseño (acordadas con el equipo):
--   - Solicitud conjunta = UNA sola solicitud con su(s) reserva(s) y
--     su(s) préstamo(s), con tipo = 'conjunta' (como el modelo v4).
--   - Varios bloques por solicitud: cada fila de prestamos/reservas es
--     un recurso en un bloque. UNIQUE (id_solicitud, id_horario) impide
--     repetir el mismo bloque dentro de la solicitud. Si el negocio
--     quiere limitar a un solo espacio por solicitud, lo valida el backend.
--
-- Criterios de aceptación cubiertos:
-- 1. Seleccionar uno o más equipos y el periodo de renta
--    -> varias filas en prestamos (id_objeto + id_horario + cantidad)
-- 2. Asociar la renta a una reserva para formar una solicitud conjunta
--    -> prestamos y reservas cuelgan de la misma solicitud;
--       solicitudes.tipo = 'conjunta'
-- 3. Verificar disponibilidad de cada equipo
--    -> objetos.stock, objetos.estado y horarios.estado
--       (el cálculo de unidades libres lo hace el backend)
-- 4. Estado 'pendiente' y prioridad asignable (baja, normal, alta)
--    -> solicitudes.estado y solicitudes.prioridad (ya existen desde HU-S01)
-- 5. Confirmación con el detalle de equipos y espacio
--    -> se arma desde solicitudes + prestamos + reservas
-- ============================================================


-- ============================================================
-- TABLA objetos  (equipos: proyectores, micrófonos, juegos...)
-- ============================================================
CREATE TABLE objetos (
    id                   SERIAL,
    nombre               VARCHAR(100)   NOT NULL,
    descripcion          TEXT,
    stock                INTEGER        NOT NULL DEFAULT 1,   -- unidades totales
    precio               NUMERIC(10,2)  NOT NULL DEFAULT 0,   -- precio base por unidad
    estado               estado_recurso NOT NULL DEFAULT 'activo',
    -- Qué roles pueden solicitar este equipo
    roles_permitidos     rol_usuario[]  NOT NULL DEFAULT '{alumno,docente}',
    fecha_creacion       TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion  TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_objetos PRIMARY KEY (id),
    CONSTRAINT uq_objetos_nombre UNIQUE (nombre),
    CONSTRAINT chk_objetos_stock CHECK (stock >= 0),
    CONSTRAINT chk_objetos_precio CHECK (precio >= 0),
    CONSTRAINT chk_objetos_roles CHECK (cardinality(roles_permitidos) > 0)
);


-- ============================================================
-- MODIFICACIÓN DE horarios  (bloques de un lugar O de un objeto)
-- ============================================================
ALTER TABLE horarios
    ADD COLUMN id_objeto INTEGER;

-- id_lugar deja de ser obligatorio: el bloque puede ser de un objeto
ALTER TABLE horarios
    ALTER COLUMN id_lugar DROP NOT NULL;

ALTER TABLE horarios
    ADD CONSTRAINT fk_horarios_objeto FOREIGN KEY (id_objeto)
        REFERENCES objetos (id) ON DELETE RESTRICT;

-- Arco exclusivo: exactamente uno de los dos, lugar u objeto
ALTER TABLE horarios
    ADD CONSTRAINT chk_horarios_un_recurso
        CHECK (num_nonnulls(id_lugar, id_objeto) = 1);

-- Necesario para la FK compuesta de prestamos
-- (garantiza que el horario elegido sea del mismo objeto)
ALTER TABLE horarios
    ADD CONSTRAINT uq_horarios_id_objeto UNIQUE (id, id_objeto);

-- Criterio 1: listar los horarios de un equipo por fecha
CREATE INDEX idx_horarios_objeto_fecha ON horarios (id_objeto, fecha);


-- ============================================================
-- MODIFICACIÓN DE reservas  (varios bloques por solicitud)
-- ============================================================
-- Antes: UNIQUE (id_solicitud) -> un solo bloque por solicitud.
-- Ahora: UNIQUE (id_solicitud, id_horario) -> varios bloques, sin repetir.
ALTER TABLE reservas
    DROP CONSTRAINT uq_reservas_solicitud;

ALTER TABLE reservas
    ADD CONSTRAINT uq_reservas_solicitud_horario UNIQUE (id_solicitud, id_horario);


-- ============================================================
-- TABLA prestamos  (detalle: equipos de una solicitud)
-- ============================================================
CREATE TABLE prestamos (
    id                   SERIAL,
    id_solicitud         INTEGER  NOT NULL,
    id_horario           INTEGER  NOT NULL,
    id_objeto            INTEGER  NOT NULL,
    cantidad             INTEGER  NOT NULL DEFAULT 1,   -- unidades del equipo

    CONSTRAINT pk_prestamos PRIMARY KEY (id),

    CONSTRAINT fk_prestamos_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes (id) ON DELETE CASCADE,

    -- Criterio 1: FK compuesta, el horario elegido debe pertenecer a ESE objeto.
    -- RESTRICT: no se puede borrar un horario que ya fue solicitado.
    CONSTRAINT fk_prestamos_horario_objeto FOREIGN KEY (id_horario, id_objeto)
        REFERENCES horarios (id, id_objeto) ON DELETE RESTRICT,

    -- Varios equipos y varios bloques por solicitud, sin repetir el mismo bloque
    -- (si se necesitan más unidades, se sube la cantidad)
    CONSTRAINT uq_prestamos_solicitud_horario UNIQUE (id_solicitud, id_horario),

    CONSTRAINT chk_prestamos_cantidad CHECK (cantidad > 0)
);

CREATE INDEX idx_prestamos_horario ON prestamos (id_horario);


-- ############################################################
-- PARTE 5 — HU-S03
-- ############################################################

-- ============================================================
-- HU-S03: Consultar y filtrar mis solicitudes
-- ============================================================
-- No se crean tablas ni columnas: todo lo que se consulta ya existe.
-- Solo se agregan índices para los filtros del usuario.
-- Los comentarios (criterio 4) llegan con la tabla comentarios en
-- la iteración 3 (HU-S04, HU-A01, HU-A02).
--
-- Criterios de aceptación cubiertos:
-- 1. Ver todas mis solicitudes
--    -> solicitudes.id_usuario (idx_solicitudes_usuario, desde HU-S01)
-- 2. Filtrar por estado (pendiente, recibida, aceptada, declinada)
--    -> solicitudes.estado  (idx_solicitudes_usuario_estado)
-- 3. Filtrar por tipo (reserva, renta, conjunta) y rango de fechas
--    -> solicitudes.tipo    (idx_solicitudes_usuario_tipo)
--    -> solicitudes.fecha_creacion (idx_solicitudes_usuario) o
--       horarios.fecha del bloque (idx_horarios_lugar_fecha / objeto_fecha)
-- 4. Ver el detalle (horario, prioridad, estado, comentarios)
--    -> solicitudes + reservas/prestamos + horarios
-- ============================================================

-- Criterio 2: mis solicitudes por estado
CREATE INDEX idx_solicitudes_usuario_estado ON solicitudes (id_usuario, estado);

-- Criterio 3: mis solicitudes por tipo
CREATE INDEX idx_solicitudes_usuario_tipo ON solicitudes (id_usuario, tipo);


-- ############################################################
-- PARTE 6 — HU-H01
-- ############################################################

-- ============================================================
-- HU-H01: Creación de horarios para espacios y equipos
-- ============================================================
-- La tabla horarios ya existe (HU-S01 + HU-S02). Solo se agregan
-- restricciones contra bloques duplicados.
--
-- Decisiones de diseño (acordadas con el equipo):
--   - Sin extensiones: la BD impide bloques DUPLICADOS (mismo recurso,
--     fecha y hora de inicio). Los bloques SUPERPUESTOS
--     (ej. 08:00-10:00 vs 09:00-11:00) los valida el backend.
--   - Horarios recurrentes: el backend genera una fila por bloque
--     (como el modelo v4); no se guarda la serie.
--
-- Criterios de aceptación cubiertos:
-- 1. Crear bloques para un espacio o equipo con fecha y rango horario
--    -> horarios (id_lugar | id_objeto, fecha, hora_inicio, hora_fin)
-- 2. Crear horarios recurrentes
--    -> varias filas en horarios (generadas por el backend)
-- 3. Sin bloques duplicados o superpuestos para un mismo recurso
--    -> uq_horarios_lugar_inicio / uq_horarios_objeto_inicio
--       (superposición: backend)
-- 4. Los horarios nuevos quedan disponibles de inmediato
--    -> horarios.estado DEFAULT 'disponible' (desde HU-S01)
-- 5. Editar o eliminar un bloque que aún no ha sido reservado
--    -> FK de reservas/prestamos con ON DELETE RESTRICT (desde HU-S01/S02)
-- ============================================================

-- Criterio 3: un lugar no puede tener dos bloques que empiecen igual.
-- (las filas de objetos tienen id_lugar NULL y no chocan entre sí)
ALTER TABLE horarios
    ADD CONSTRAINT uq_horarios_lugar_inicio UNIQUE (id_lugar, fecha, hora_inicio);

-- Criterio 3: lo mismo para cada objeto
ALTER TABLE horarios
    ADD CONSTRAINT uq_horarios_objeto_inicio UNIQUE (id_objeto, fecha, hora_inicio);


-- ############################################################
-- PARTE 7 — HU-H02
-- ############################################################

-- ============================================================
-- HU-H02: Gestionar horarios disponibles de espacios y equipos
-- ============================================================
-- Se agrega el motivo de no disponibilidad a horarios y un índice
-- para el calendario general.
--
-- Criterios de aceptación cubiertos:
-- 1. Marcar un horario como 'no disponible' indicando el motivo
--    -> horarios.estado = 'no_disponible' + motivo_no_disponible
--       (obligatorio en ese caso: chk_horarios_motivo)
-- 2. Los usuarios no pueden elegir horarios no disponibles
--    -> horarios.estado (el backend filtra por 'disponible')
-- 3. Revertir a 'disponible'
--    -> horarios.estado (fecha_actualizacion registra el cambio)
-- 4. Calendario general de espacios y equipos ocupados y libres
--    -> idx_horarios_fecha (fecha, estado)
-- ============================================================

ALTER TABLE horarios
    ADD COLUMN motivo_no_disponible VARCHAR(200);   -- ej. "mantenimiento", "reserva previa"

-- Criterio 1: marcar como no disponible exige motivo
ALTER TABLE horarios
    ADD CONSTRAINT chk_horarios_motivo CHECK (
        estado <> 'no_disponible' OR motivo_no_disponible IS NOT NULL
    );

-- Criterio 4: calendario general por fecha y estado
CREATE INDEX idx_horarios_fecha ON horarios (fecha, estado);


-- ------------------------------------------------------------
-- DATO SEMILLA: PRIMER ADMINISTRADOR
-- ------------------------------------------------------------
-- El primer administrador no tiene quién lo valide, por eso se
-- inserta directamente como 'aprobado'. En producción, el hash
-- se genera con bcrypt desde el backend. Descomentar para usarlo.
-- INSERT INTO usuarios (codigo_dni, nombre, correo, password_hash, rol,
--                       documento_validacion, estado_validacion, fecha_validacion)
-- VALUES ('ADMIN0001', 'Administrador FISI', 'admin.fisi@unmsm.edu.pe',
--         '<hash_bcrypt>', 'administrativo',
--         'SEMILLA-INICIAL', 'aprobado', NOW());
