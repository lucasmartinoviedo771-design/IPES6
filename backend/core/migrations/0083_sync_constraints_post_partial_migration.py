# Generated manually on 2026-04-12 to fix inconsistency left by partial migrations 0073/0078.
#
# Root cause:
# - Migration 0073 (original, uncommented) ran partially against production, failing with
#   "Duplicate key name". Before failing, MySQL executed non-transactional DDL:
#     * Dropped unique index 'unique_registro_cohorte_estudiante' from cursointroductorioregistro
#     * Dropped CHECK constraint 'regularidad_lock_scope_defined' from regularidadplanillalock
#     * Dropped the unique_together index on core_materia
# - Developer commented out failing ops and re-ran. Migration was recorded in django_migrations.
# - 0078 repeated the same pattern.
#
# Additional finding (Django 5.2 behavior):
# - RemoveField.state_forwards in Django 5.2 does NOT auto-update unique_together in the
#   migration state. So after 0078's RemoveField(horariocatedra, anio_cursada), the state
#   still has unique_together = {('espacio','turno','anio_cursada','cuatrimestre')}, even
#   though the field no longer exists. A normal AlterUniqueTogether operation would fail
#   trying to resolve the missing 'anio_cursada' field.
#
# Strategy:
# - Use SeparateDatabaseAndState for all ops where DB state diverged from Django state.
# - Use direct RunSQL where index names are known and field resolution would fail.
# - Use normal operations where DB and state are consistent.
#
# Note on MySQL W036: MySQL does not support conditional UniqueConstraints.
# The AddConstraint ops for conditional UniqueConstraints below update Django's
# migration state only — MySQL emits a W036 warning and skips the SQL.

import django.db.models.expressions
from django.db import migrations, models


def drop_materia_unique_if_exists(apps, schema_editor):
    """Drop the old materia unique_together index only if it still exists.

    On production the index was dropped in the partial 0073 run; on a fresh DB
    it would still be here from 0072_materia_edi_refactor.
    MySQL 8.0 does not support ALTER TABLE ... DROP INDEX IF EXISTS, so we
    check first via information_schema.
    """
    index_name = "core_materia_plan_de_estudio_id_anio__8ede7624_uniq"
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "SELECT COUNT(*) FROM information_schema.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'core_materia' AND INDEX_NAME = %s",
            [index_name],
        )
        if cursor.fetchone()[0] > 0:
            cursor.execute(
                f"ALTER TABLE core_materia DROP INDEX `{index_name}`"
            )


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0082_staffasignacion_profesorado_nullable"),
    ]

    operations = [
        # ── State-only fixes (constraints dropped from DB during partial 0073 run) ──

        # unique_registro_cohorte_estudiante was dropped in the partial 0073 run.
        # Django state still thinks it exists (added in 0044). No DB op needed.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="cursointroductorioregistro",
                    name="unique_registro_cohorte_estudiante",
                ),
            ],
        ),
        # regularidad_lock_scope_defined (CheckConstraint from 0056) was also dropped
        # in the partial 0073 run. No DB op needed.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name="regularidadplanillalock",
                    name="regularidad_lock_scope_defined",
                ),
            ],
        ),
        # Materia's unique_together from 0072_materia_edi_refactor was dropped in the
        # partial 0073 run on production. Use IF EXISTS so this is safe on a fresh DB too
        # (where the index would still exist after 0072 and needs to be cleaned up here).
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    drop_materia_unique_if_exists,
                    reverse_code=migrations.RunPython.noop,
                ),
            ],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="materia",
                    unique_together=set(),
                ),
            ],
        ),

        # ── Normal field / metadata changes ──

        # help_text change only — no schema change in MySQL, but Django tracks it.
        migrations.AlterField(
            model_name="staffasignacion",
            name="turno",
            field=models.CharField(
                blank=True,
                choices=[
                    ("manana", "Mañana"),
                    ("tarde", "Tarde"),
                    ("vespertino", "Vespertino"),
                ],
                help_text="Turno que cubre. Requerido para tutores.",
                max_length=12,
                null=True,
            ),
        ),

        # ── unique_together changes ──

        # Comision: the model defines unique_together = (materia, anio_lectivo, codigo)
        # but the DB has the old 6-column constraint (materia, anio_lectivo, codigo,
        # docente, rol, orden) from migration 0068.
        #
        # Applying the 3-column constraint to the DB fails with IntegrityError because
        # production data has multiple comisiones sharing the same (materia, anio, codigo)
        # — each represents a different docente assignment (TIT/INT/SUP) for the same
        # class slot.  This is the current data model reality.
        #
        # Decision: update Django's migration state to 3-column (to match the model code)
        # but leave the DB constraint as 6-column (stricter, data-compatible, still valid).
        # TODO: a follow-up migration should either:
        #   a) Update the model back to 6-column unique_together to match real data structure, OR
        #   b) Clean the data (merge duplicate assignments) and then apply the 3-column constraint.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="comision",
                    unique_together={("materia", "anio_lectivo", "codigo")},
                ),
            ],
        ),
        # HorarioCatedra: change from (espacio, turno, cuatrimestre) to
        # (espacio, turno, anio_academico, cuatrimestre).
        #
        # Cannot use normal AlterUniqueTogether here because:
        # - Django 5.2 RemoveField does not auto-update unique_together in migration state.
        # - After 0078's RemoveField(anio_cursada), the state still has
        #   unique_together = {('espacio','turno','anio_cursada','cuatrimestre')}.
        # - AlterUniqueTogether.database_forwards would try to resolve 'anio_cursada'
        #   as a model field → FieldDoesNotExist.
        #
        # Fix: SeparateDatabaseAndState with explicit RunSQL for DB, AlterUniqueTogether
        # for state only (state_forwards just overwrites the value, no field resolution).
        #
        # Index names (computed via connection.schema_editor._unique_constraint_name):
        #   old: core_horariocatedra_espacio_id_turno_id_anio_4a77af4c_uniq  (3 cols)
        #   new: core_horariocatedra_espacio_id_turno_id_anio_3fd34ca5_uniq  (4 cols)
        #
        # The old index has 3 columns because MySQL auto-removed anio_cursada when
        # 0078 ran DROP COLUMN (no explicit Django index reconstruction took place).
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # CREATE the new 4-column index FIRST — MySQL requires that espacio_id
                # has a covering index at all times (it backs the FK to core_materia).
                # Dropping the old index before creating the new one raises:
                #   OperationalError 1553: needed in a foreign key constraint.
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE core_horariocatedra "
                        "ADD UNIQUE KEY core_horariocatedra_espacio_id_turno_id_anio_3fd34ca5_uniq "
                        "(espacio_id, turno_id, anio_academico, cuatrimestre)"
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Now it's safe to drop the old 3-column index.
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE core_horariocatedra "
                        "DROP INDEX core_horariocatedra_espacio_id_turno_id_anio_4a77af4c_uniq"
                    ),
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="horariocatedra",
                    unique_together={("espacio", "turno", "anio_academico", "cuatrimestre")},
                ),
            ],
        ),

        # ── Add missing constraints ──

        # CheckConstraint: total_alumnos = total_aprobados + total_desaprobados + total_ausentes.
        # Will FAIL if any existing row doesn't satisfy this — check data before applying.
        migrations.AddConstraint(
            model_name="actaexamen",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "total_alumnos",
                        django.db.models.expressions.CombinedExpression(
                            django.db.models.expressions.CombinedExpression(
                                models.F("total_aprobados"),
                                "+",
                                models.F("total_desaprobados"),
                            ),
                            "+",
                            models.F("total_ausentes"),
                        ),
                    )
                ),
                name="acta_examen_totals_parity",
            ),
        ),
        # Conditional UniqueConstraints — MySQL W036: no SQL generated, state-only updates.
        migrations.AddConstraint(
            model_name="cursointroductorioregistro",
            constraint=models.UniqueConstraint(
                condition=models.Q(cohorte__isnull=False),
                fields=["cohorte", "estudiante"],
                name="unique_registro_cohorte_estudiante",
            ),
        ),
        migrations.AddConstraint(
            model_name="cursointroductorioregistro",
            constraint=models.UniqueConstraint(
                condition=models.Q(cohorte__isnull=True),
                fields=["estudiante"],
                name="unique_registro_student_orphan",
            ),
        ),
        migrations.AddConstraint(
            model_name="materia",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_edi=False),
                fields=["plan_de_estudio", "anio_cursada", "nombre", "regimen"],
                name="unique_materia_normal",
            ),
        ),
        migrations.AddConstraint(
            model_name="materia",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_edi=True),
                fields=["plan_de_estudio", "anio_cursada", "nombre", "regimen", "fecha_inicio"],
                name="unique_materia_edi",
            ),
        ),
        # CheckConstraints (enforced at DB level).
        # materia_fecha_range_valid: will FAIL if any row has fecha_fin < fecha_inicio.
        migrations.AddConstraint(
            model_name="materia",
            constraint=models.CheckConstraint(
                condition=models.Q(fecha_fin__isnull=True)
                | models.Q(fecha_fin__gte=models.F("fecha_inicio")),
                name="materia_fecha_range_valid",
            ),
        ),
        # regularidad_lock_scope_xor: will FAIL if any row doesn't match the XOR scope rule.
        migrations.AddConstraint(
            model_name="regularidadplanillalock",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    comision__isnull=False,
                    materia__isnull=True,
                    anio_virtual__isnull=True,
                )
                | models.Q(
                    comision__isnull=True,
                    materia__isnull=False,
                    anio_virtual__isnull=False,
                ),
                name="regularidad_lock_scope_xor",
            ),
        ),
    ]
