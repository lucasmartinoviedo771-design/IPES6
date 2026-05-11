# Skill: Data Persistence and Multi-Table Synchronization

This skill ensures that all code modifications prioritize data integrity, multi-table consistency, and the preservation of legacy information.

## Core Principles

1. **Dual-Table Persistence**
   - Whenever a business entity is represented in multiple tables (e.g., `ActaExamenDocente` and `MesaExamen`), every creation or update operation MUST synchronize all relevant fields across both tables.
   - Never assume that updating one table will automatically update the other unless a database-level trigger or a Django signal is explicitly verified.

2. **Atomic Operations**
   - Use `transaction.atomic()` for any operation that involves writing to more than one model. This prevents "partial saves" where one table is updated but another fails, leading to out-of-sync data.

3. **Safe Updates (Avoid "Delete and Re-create")**
   - Avoid patterns that delete all related records before re-inserting them unless strictly necessary. If using this pattern, ensure that no data is lost during the gap and that the operation is wrapped in a transaction.
   - Use `update_or_create()` or manual existence checks to preserve as much existing data as possible.

4. **Legacy Data Awareness**
   - Be mindful that older records (e.g., pre-2017) may have missing fields or different data structures.
   - Implement "safe reads" that handle `null` or missing relationships gracefully without crashing the application.
   - When updating old records, do not accidentally overwrite empty fields that should remain empty or that contain "implied" data.

5. **Validation of Synchronization**
   - After performing an update, verify that the state of both tables matches the expected business logic.
   - Log any discrepancies found during the synchronization process for administrative review.

## Application in IPES6

- **Exam Boards**: The tribunal (Presidente, Vocal 1, Vocal 2) must exist in both `core_actaexamendocente` (for the Acta/Folio record) and `core_mesaexamen` (for the final exam management).
- **Student Results**: Grades must be synchronized between `ActaExamenEstudiante` and `InscripcionMesa`.
- **Attendance**: Synchronization between class attendance records and overall student progress statistics.
