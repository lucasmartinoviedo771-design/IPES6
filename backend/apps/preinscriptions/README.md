# Requisitos documentales por profesorado

Este módulo incorpora plantillas reutilizables para los requisitos de documentación
pedidos durante la confirmación de preinscripciones. Cada profesorado recibe una
copia inicial de la plantilla global y luego puede ajustar títulos, obligatoriedad
y orden sin impactar en el resto.

## Flujo general

1. Las plantillas base se definen en `core.RequisitoDocumentacionTemplate`. La
   migración `0037_requisitodocumentaciontemplate_and_more` crea los registros
   iniciales que replican el checklist actual (DNI, fotos, folios, etc.).
2. Al crear un nuevo `Profesorado` se disparan automáticamente los requisitos
   específicos (`ProfesoradoRequisitoDocumentacion`) copiando la plantilla global.
3. Los endpoints Ninja permiten listar y actualizar los requisitos visibles para
   cada rol autorizado (admin, secretaría, bedel, coordinador, jefes):

   - `GET /api/preinscriptions/profesorados/{id}/requisitos-documentacion`
   - `PUT /api/preinscriptions/profesorados/{id}/requisitos-documentacion`

   El `PUT` acepta una lista de elementos con los campos opcionales a modificar.
   Enviar `personalizado=false` sobre un requisito vuelve a sincronizarlo con la
   plantilla global.

4. El servicio `apps.preinscriptions.services.requisitos.sync_profesorado_requisitos`
   se puede invocar manualmente (por ejemplo, desde un comando de mantenimiento)
   para volver a clonar plantillas nuevas en todos los profesorados existentes.

## Próximos pasos sugeridos

- Ajustar el frontend (pantalla de confirmación / checklist) para consumir los
  requisitos dinámicos en lugar del listado hardcodeado.
- Añadir tests específicos que cubran las rutas Ninja y la lógica de
  sincronización de plantillas.
- Definir descripciones y documentación adicional según las necesidades de cada
  profesorado (por ejemplo, adjuntar instructivos PDF).
