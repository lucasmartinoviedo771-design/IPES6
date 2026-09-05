# .vulture_whitelist.py
# Falsos positivos de Django, Ninja, Pydantic y Celery/Command runner

# 1. Django Models & ORM
_.clean
_.clean_fields
_.full_clean
_.get_absolute_url
_.save
_.delete
_.__str__
_.objects

# 2. Django Admin
_.get_queryset
_.has_add_permission
_.has_change_permission
_.has_delete_permission
_.has_module_permission
_.list_display
_.list_filter
_.search_fields
_.readonly_fields
_.inlines
_.autocomplete_fields

# 3. Schemas, Pydantic & Django Ninja
_.resolve_
_.Meta
_.Config
_.Field
_.from_orm

# 4. Django Management Commands & Middleware
_.add_arguments
_.handle
_.process_request
_.process_response
_.process_view
_.process_exception

# 5. Django Apps & Signals
_.ready
_.default_auto_field
