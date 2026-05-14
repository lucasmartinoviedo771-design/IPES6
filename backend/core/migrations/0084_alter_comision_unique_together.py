# State-only migration: restores Comision.unique_together to 6 columns.
#
# Context:
# - Migration 0083 set the Django state to 3-column unique_together for Comision
#   (matching what the model said at the time), but skipped the DB change because
#   production data has multiple docente assignments per (materia, anio_lectivo, codigo).
# - After investigation, the 6-column unique_together is the CORRECT data model:
#   a single "comision" code can have multiple teachers assigned simultaneously
#   (e.g., Lenguaje Artístico has 4 docentes sharing the same cátedra slot).
# - The DB already enforces the 6-column constraint (from migration 0068).
#
# This migration syncs the Django state back to 6 columns with no DB operation.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0083_sync_constraints_post_partial_migration"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterUniqueTogether(
                    name="comision",
                    unique_together={
                        ("materia", "anio_lectivo", "codigo", "docente", "rol", "orden")
                    },
                ),
            ],
        ),
    ]
