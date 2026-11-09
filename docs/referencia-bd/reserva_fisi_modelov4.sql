-- ============================================================
-- SISTEMA WEB DE RESERVAS FISI — Grupo 5
-- Modelo completo de base de datos (SOLO ESTRUCTURA)
-- Motor: PostgreSQL 11 o superior
-- Versión: v4 — motivo en solicitudes; precio base en recursos
--
-- NOTA: este script es el MODELO LÓGICO del sistema. La
-- implementación usa Convex (base de datos documental), donde las
-- reglas marcadas aquí como CHECK, FK, EXCLUDE, triggers y vistas
-- deben replicarse en el schema y en las funciones (mutations).
-- ============================================================
-- Historias de usuario cubiertas:
--   Iteración 1: HU-U01, HU-U02
--   Iteración 2: HU-S01, HU-S02, HU-S03, HU-H01, HU-H02
--   Iteración 3: HU-S04, HU-A01, HU-A02
--
-- Convenciones del modelo:
--   - Tablas en plural y snake_case.
--   - Todos los estados/categorías se modelan con tipos ENUM.
--   - Toda tabla "principal" tiene fecha_creacion y fecha_actualizacion;
--     esta última se actualiza sola mediante un trigger.
--   - Restricciones con nombre: pk_, fk_, uq_, chk_, ex_ (exclusión).
--
-- Supuestos a confirmar con el equipo:
--   1. Todo espacio y equipo tiene un precio base. Quién paga y
--      cuánto (exoneraciones, descuentos por rol) es una REGLA DE
--      NEGOCIO del backend. El sistema muestra el monto, pero NO
--      controla pagos.
--   2. Una solicitud reserva como máximo UN espacio, pero puede
--      incluir VARIOS equipos (solicitud conjunta, HU-S02).
--   3. Los horarios recurrentes (HU-H01, criterio 2) los genera el
--      backend como varias filas en "horarios".
--   4. El margen de tiempo para modificar/cancelar (HU-S04) se
--      calcula en el backend a partir de solicitudes.fecha_creacion.
-- ============================================================


-- ============================================================
-- 0. EXTENSIONES
-- ============================================================
-- btree_gist permite usar restricciones EXCLUDE que combinan un
-- entero (id del recurso) con un rango de tiempo. Se usa para
-- impedir horarios superpuestos para un mismo recurso (HU-H01).
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ============================================================
-- 1. TIPOS ENUMERADOS
-- ============================================================
CREATE TYPE rol_usuario AS ENUM (
    'alumno', 'docente', 'administrativo', 'foraneo', 'externo'
);

-- HU-U02: validación de cuentas administrativas
CREATE TYPE estado_validacion_usuario AS ENUM (
    'pendiente', 'aprobado', 'rechazado'
);

-- Estado general de un espacio o equipo
CREATE TYPE estado_recurso AS ENUM (
    'activo', 'mantenimiento', 'inactivo'
);

-- HU-H02: estado de un bloque de horario
CREATE TYPE estado_horario AS ENUM (
    'disponible', 'no_disponible', 'ocupado'
);

-- HU-S03: filtro por tipo (reserva, renta o conjunta)
CREATE TYPE tipo_solicitud AS ENUM (
    'reserva', 'prestamo', 'conjunta'
);

-- HU-A02
CREATE TYPE prioridad_solicitud AS ENUM (
    'baja', 'normal', 'alta'
);

-- Perfil del proyecto + HU-S04 (cancelada)
CREATE TYPE estado_solicitud AS ENUM (
    'pendiente', 'recibida', 'aceptada', 'declinada', 'cancelada'
);

-- usuario           -> comentario del dueño de la solicitud (HU-S04)
-- respuesta_admin   -> motivo al aceptar/rechazar (HU-A01)
-- retroalimentacion -> comentario post servicio (HU-A02)
CREATE TYPE tipo_comentario AS ENUM (
    'usuario', 'respuesta_admin', 'retroalimentacion'
);


-- ============================================================
-- 2. FUNCIÓN PARA fecha_actualizacion
-- ============================================================
CREATE OR REPLACE FUNCTION fn_actualizar_fecha()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 3. USUARIOS  (HU-U01 + HU-U02)
-- ============================================================
-- Una sola tabla para todos los roles. Las columnas de validación
-- solo se usan cuando rol = 'administrativo'. El backend debe
-- tratar como administrador efectivo únicamente a quien tenga
-- rol = 'administrativo' Y estado_validacion = 'aprobado'.
CREATE TABLE usuarios (
    id                      SERIAL,
    codigo_dni              VARCHAR(20)   NOT NULL,
    nombre                  VARCHAR(150)  NOT NULL,
    correo                  VARCHAR(150)  NOT NULL,
    password_hash           VARCHAR(255)  NOT NULL,   -- nunca texto plano
    rol                     rol_usuario   NOT NULL DEFAULT 'alumno',

    -- HU-U02
    documento_validacion    VARCHAR(100),
    estado_validacion       estado_validacion_usuario,
    comentario_validacion   TEXT,
    fecha_validacion        TIMESTAMP,
    validado_por            INTEGER,      -- quien aprobó o rechazó

    fecha_creacion          TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_actualizacion     TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuarios PRIMARY KEY (id),

    -- HU-U01 criterio 2: código/DNI no repetido
    -- (el índice que crea este UNIQUE también acelera el login)
    CONSTRAINT uq_usuarios_codigo_dni UNIQUE (codigo_dni),

    -- Relación auto-referencial: un administrador valida a otro
    CONSTRAINT fk_usuarios_validado_por FOREIGN KEY (validado_por)
        REFERENCES usuarios (id) ON DELETE SET NULL,

    CONSTRAINT chk_usuarios_codigo_dni_formato
        CHECK (codigo_dni ~ '^[A-Za-z0-9]{6,20}$'),

    CONSTRAINT chk_usuarios_correo_formato
        CHECK (correo ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

    -- HU-U02: los datos de validación van atados al rol
    CONSTRAINT chk_usuarios_admin_validacion CHECK (
        (rol = 'administrativo'
            AND documento_validacion IS NOT NULL
            AND estado_validacion IS NOT NULL)
        OR
        (rol <> 'administrativo'
            AND estado_validacion IS NULL)
    ),

    -- HU-U02 criterio 5: un rechazo siempre lleva motivo
    CONSTRAINT chk_usuarios_rechazo_con_motivo CHECK (
        estado_validacion IS DISTINCT FROM 'rechazado'
        OR comentario_validacion IS NOT NULL
    ),

    -- Si ya fue aprobado o rechazado, debe tener fecha de validación
    CONSTRAINT chk_usuarios_validacion_con_fecha CHECK (
        estado_validacion IS NULL
        OR estado_validacion = 'pendiente'
        OR fecha_validacion IS NOT NULL
    ),

    -- Nadie se valida a sí mismo
    CONSTRAINT chk_usuarios_no_autovalidacion CHECK (validado_por <> id)
);

-- Correo único sin distinguir mayúsculas/minúsculas
CREATE UNIQUE INDEX uq_usuarios_correo ON usuarios (LOWER(correo));

-- Panel de administración: listar rápido las validaciones pendientes
CREATE INDEX idx_usuarios_validacion_pendiente ON usuarios (fecha_creacion)
    WHERE estado_validacion = 'pendiente';


-- ============================================================
-- 4. LUGARES  (espacios: auditorio, patio, salas...)
-- ============================================================
CREATE TABLE lugares (
    id                    SERIAL,
    nombre                VARCHAR(100)   NOT NULL,
    descripcion           TEXT,
    ubicacion             VARCHAR(150),            -- ej. "Pabellón antiguo, 1er piso"
    capacidad             INTEGER        NOT NULL,
    precio                NUMERIC(10,2)  NOT NULL DEFAULT 0,  -- precio base
    estado                estado_recurso NOT NULL DEFAULT 'activo',
    -- "permiso": qué roles pueden solicitar este espacio
    roles_permitidos      rol_usuario[]  NOT NULL DEFAULT '{alumno,docente}',
    fecha_creacion        TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_lugares PRIMARY KEY (id),
    CONSTRAINT uq_lugares_nombre UNIQUE (nombre),
    CONSTRAINT chk_lugares_capacidad CHECK (capacidad > 0),
    CONSTRAINT chk_lugares_precio CHECK (precio >= 0),
    CONSTRAINT chk_lugares_roles CHECK (cardinality(roles_permitidos) > 0)
);


-- ============================================================
-- 5. OBJETOS  (equipos: proyectores, micrófonos, juegos...)
-- ============================================================
CREATE TABLE objetos (
    id                    SERIAL,
    nombre                VARCHAR(100)   NOT NULL,
    descripcion           TEXT,
    stock                 INTEGER        NOT NULL DEFAULT 1,  -- unidades totales
    precio                NUMERIC(10,2)  NOT NULL DEFAULT 0,  -- precio base por unidad
    estado                estado_recurso NOT NULL DEFAULT 'activo',
    roles_permitidos      rol_usuario[]  NOT NULL DEFAULT '{alumno,docente}',
    fecha_creacion        TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_objetos PRIMARY KEY (id),
    CONSTRAINT uq_objetos_nombre UNIQUE (nombre),
    CONSTRAINT chk_objetos_stock CHECK (stock >= 0),
    CONSTRAINT chk_objetos_precio CHECK (precio >= 0),
    CONSTRAINT chk_objetos_roles CHECK (cardinality(roles_permitidos) > 0)
);


-- ============================================================
-- 6. HORARIOS  (HU-H01 + HU-H02)
-- ============================================================
-- Cada bloque pertenece a UN recurso: un lugar O un objeto
-- (arco exclusivo). Tiene fecha y rango horario.
CREATE TABLE horarios (
    id                     SERIAL,
    id_lugar               INTEGER,
    id_objeto              INTEGER,
    fecha                  DATE           NOT NULL,
    hora_inicio            TIME           NOT NULL,
    hora_fin               TIME           NOT NULL,
    estado                 estado_horario NOT NULL DEFAULT 'disponible',
    motivo_no_disponible   VARCHAR(200),  -- HU-H02 criterio 1
    creado_por             INTEGER        NOT NULL,
    fecha_creacion         TIMESTAMP      NOT NULL DEFAULT NOW(),
    fecha_actualizacion    TIMESTAMP      NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_horarios PRIMARY KEY (id),

    CONSTRAINT fk_horarios_lugar FOREIGN KEY (id_lugar)
        REFERENCES lugares (id) ON DELETE RESTRICT,
    CONSTRAINT fk_horarios_objeto FOREIGN KEY (id_objeto)
        REFERENCES objetos (id) ON DELETE RESTRICT,
    CONSTRAINT fk_horarios_creado_por FOREIGN KEY (creado_por)
        REFERENCES usuarios (id) ON DELETE RESTRICT,

    -- Exactamente uno de los dos: lugar u objeto
    CONSTRAINT chk_horarios_un_recurso
        CHECK (num_nonnulls(id_lugar, id_objeto) = 1),

    CONSTRAINT chk_horarios_rango CHECK (hora_fin > hora_inicio),

    -- HU-H02: marcar como no disponible exige motivo
    CONSTRAINT chk_horarios_motivo CHECK (
        estado <> 'no_disponible' OR motivo_no_disponible IS NOT NULL
    ),

    -- Necesarios para las FK compuestas de reservas y prestamos
    -- (garantizan que el horario elegido sea del mismo recurso)
    CONSTRAINT uq_horarios_id_lugar  UNIQUE (id, id_lugar),
    CONSTRAINT uq_horarios_id_objeto UNIQUE (id, id_objeto),

    -- HU-H01 criterio 3: sin bloques superpuestos para un mismo recurso.
    -- El rango es [inicio, fin), así 08:00-10:00 y 10:00-12:00 NO chocan.
    CONSTRAINT ex_horarios_lugar_sin_cruce EXCLUDE USING gist (
        id_lugar WITH =,
        (tsrange(fecha + hora_inicio, fecha + hora_fin)) WITH &&
    ),
    CONSTRAINT ex_horarios_objeto_sin_cruce EXCLUDE USING gist (
        id_objeto WITH =,
        (tsrange(fecha + hora_inicio, fecha + hora_fin)) WITH &&
    )
);

-- Calendario general (HU-H02 criterio 4)
CREATE INDEX idx_horarios_fecha ON horarios (fecha, estado);


-- ============================================================
-- 7. SOLICITUDES  (HU-S01..S04, HU-A01, HU-A02)
-- ============================================================
-- Cabecera de la solicitud. El detalle va en reservas (espacio)
-- y/o prestamos (equipos). Si tiene ambos, tipo = 'conjunta'.
CREATE TABLE solicitudes (
    id                    SERIAL,
    id_usuario            INTEGER             NOT NULL,
    tipo                  tipo_solicitud      NOT NULL,
    prioridad             prioridad_solicitud NOT NULL DEFAULT 'normal',
    estado                estado_solicitud    NOT NULL DEFAULT 'pendiente',
    motivo                TEXT                NOT NULL,  -- HU-S01 criterio 2 (vale para toda la solicitud)
    -- Monto calculado por el backend AL CREAR la solicitud, aplicando
    -- las reglas de negocio sobre los precios base. Se guarda para que
    -- un cambio de precio posterior no altere las solicitudes antiguas.
    -- Solo informativo: no hay control de pagos.
    monto_total           NUMERIC(10,2)       NOT NULL DEFAULT 0,
    atendido_por          INTEGER,            -- admin que aceptó/declinó (HU-A01)
    fecha_atencion        TIMESTAMP,
    fecha_creacion        TIMESTAMP           NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMP           NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_solicitudes PRIMARY KEY (id),

    CONSTRAINT fk_solicitudes_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id) ON DELETE RESTRICT,
    CONSTRAINT fk_solicitudes_atendido_por FOREIGN KEY (atendido_por)
        REFERENCES usuarios (id) ON DELETE SET NULL,

    -- Una solicitud aceptada o declinada registra cuándo se atendió
    CONSTRAINT chk_solicitudes_atencion CHECK (
        estado NOT IN ('aceptada', 'declinada') OR fecha_atencion IS NOT NULL
    ),

    CONSTRAINT chk_solicitudes_no_autoatencion CHECK (atendido_por <> id_usuario),

    CONSTRAINT chk_solicitudes_motivo CHECK (length(trim(motivo)) > 0),

    CONSTRAINT chk_solicitudes_monto CHECK (monto_total >= 0)
);

-- HU-S03: "mis solicitudes", ordenadas por fecha
CREATE INDEX idx_solicitudes_usuario ON solicitudes (id_usuario, fecha_creacion DESC);

-- HU-A01 / HU-A02: bandeja del administrador por estado y prioridad
CREATE INDEX idx_solicitudes_estado ON solicitudes (estado, prioridad);


-- ============================================================
-- 8. RESERVAS  (detalle: espacio de una solicitud — HU-S01)
-- ============================================================
CREATE TABLE reservas (
    id              SERIAL,
    id_solicitud    INTEGER  NOT NULL,
    id_horario      INTEGER  NOT NULL,
    id_lugar        INTEGER  NOT NULL,

    CONSTRAINT pk_reservas PRIMARY KEY (id),

    CONSTRAINT fk_reservas_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes (id) ON DELETE CASCADE,

    -- FK compuesta: el horario elegido debe pertenecer a ESE lugar.
    -- RESTRICT cumple HU-H01 criterio 5: no se puede borrar un
    -- horario que ya fue reservado.
    CONSTRAINT fk_reservas_horario_lugar FOREIGN KEY (id_horario, id_lugar)
        REFERENCES horarios (id, id_lugar) ON DELETE RESTRICT,

    -- Supuesto 2: un solo espacio por solicitud
    CONSTRAINT uq_reservas_solicitud UNIQUE (id_solicitud)
);

CREATE INDEX idx_reservas_horario ON reservas (id_horario);


-- ============================================================
-- 9. PRESTAMOS  (detalle: equipos de una solicitud — HU-S02)
-- ============================================================
CREATE TABLE prestamos (
    id              SERIAL,
    id_solicitud    INTEGER  NOT NULL,
    id_horario      INTEGER  NOT NULL,
    id_objeto       INTEGER  NOT NULL,
    cantidad        INTEGER  NOT NULL DEFAULT 1,

    CONSTRAINT pk_prestamos PRIMARY KEY (id),

    CONSTRAINT fk_prestamos_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes (id) ON DELETE CASCADE,

    -- FK compuesta: el horario elegido debe pertenecer a ESE objeto
    CONSTRAINT fk_prestamos_horario_objeto FOREIGN KEY (id_horario, id_objeto)
        REFERENCES horarios (id, id_objeto) ON DELETE RESTRICT,

    -- El mismo equipo no se repite dentro de una solicitud
    -- (si se necesitan más unidades, se sube la cantidad)
    CONSTRAINT uq_prestamos_solicitud_objeto UNIQUE (id_solicitud, id_objeto),

    CONSTRAINT chk_prestamos_cantidad CHECK (cantidad > 0)
);

CREATE INDEX idx_prestamos_horario ON prestamos (id_horario);


-- ============================================================
-- 10. COMENTARIOS  (HU-S04, HU-A01, HU-A02)
-- ============================================================
CREATE TABLE comentarios (
    id                    SERIAL,
    id_solicitud          INTEGER          NOT NULL,
    id_usuario            INTEGER          NOT NULL,   -- autor
    tipo                  tipo_comentario  NOT NULL,
    descripcion           TEXT             NOT NULL,
    calificacion          SMALLINT,                    -- "escala" opcional 1..5
    fecha_creacion        TIMESTAMP        NOT NULL DEFAULT NOW(),
    fecha_actualizacion   TIMESTAMP        NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_comentarios PRIMARY KEY (id),

    CONSTRAINT fk_comentarios_solicitud FOREIGN KEY (id_solicitud)
        REFERENCES solicitudes (id) ON DELETE CASCADE,
    CONSTRAINT fk_comentarios_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuarios (id) ON DELETE RESTRICT,

    CONSTRAINT chk_comentarios_descripcion CHECK (length(trim(descripcion)) > 0),
    CONSTRAINT chk_comentarios_calificacion
        CHECK (calificacion IS NULL OR calificacion BETWEEN 1 AND 5)
);

-- HU-S04 criterio 4: el usuario deja un comentario solo si aún no tiene uno
CREATE UNIQUE INDEX uq_comentarios_usuario_por_solicitud
    ON comentarios (id_solicitud) WHERE tipo = 'usuario';

CREATE INDEX idx_comentarios_solicitud ON comentarios (id_solicitud);


-- ============================================================
-- 11. TRIGGERS DE fecha_actualizacion
-- ============================================================
CREATE TRIGGER trg_usuarios_fecha    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();
CREATE TRIGGER trg_lugares_fecha     BEFORE UPDATE ON lugares
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();
CREATE TRIGGER trg_objetos_fecha     BEFORE UPDATE ON objetos
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();
CREATE TRIGGER trg_horarios_fecha    BEFORE UPDATE ON horarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();
CREATE TRIGGER trg_solicitudes_fecha BEFORE UPDATE ON solicitudes
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();
CREATE TRIGGER trg_comentarios_fecha BEFORE UPDATE ON comentarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_fecha();


-- ============================================================
-- 12. VISTA DE DISPONIBILIDAD DE EQUIPOS  (HU-S02 criterio 3)
-- ============================================================
-- Unidades libres de cada equipo en cada bloque de horario:
-- stock total menos lo ya comprometido en préstamos aceptados.
CREATE VIEW v_disponibilidad_objetos AS
SELECT
    h.id           AS id_horario,
    o.id           AS id_objeto,
    o.nombre       AS objeto,
    h.fecha,
    h.hora_inicio,
    h.hora_fin,
    h.estado       AS estado_horario,
    o.stock,
    COALESCE(SUM(p.cantidad) FILTER (WHERE s.estado = 'aceptada'), 0)
                   AS cantidad_prestada,
    o.stock - COALESCE(SUM(p.cantidad) FILTER (WHERE s.estado = 'aceptada'), 0)
                   AS cantidad_disponible
FROM horarios h
JOIN objetos o          ON o.id = h.id_objeto
LEFT JOIN prestamos p   ON p.id_horario = h.id
LEFT JOIN solicitudes s ON s.id = p.id_solicitud
GROUP BY h.id, o.id;


-- ============================================================
-- 13. DATO SEMILLA: PRIMER ADMINISTRADOR  (HU-U02)
-- ============================================================
-- El primer administrador no tiene quién lo valide, por eso se
-- inserta a mano. Reemplazar los valores antes de ejecutar
-- (el hash se genera con bcrypt desde el backend).
--
-- INSERT INTO usuarios (codigo_dni, nombre, correo, password_hash, rol,
--                       documento_validacion, estado_validacion, fecha_validacion)
-- VALUES ('ADMIN0001', 'Administrador FISI', 'admin.fisi@unmsm.edu.pe',
--         '<hash_bcrypt>', 'administrativo',
--         'SEMILLA-INICIAL', 'aprobado', NOW());
