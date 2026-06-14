from django.contrib.auth.models import User
from core.models import Persona

def run_diagnostico():
    print("\nIniciando diagnóstico de sincronización entre auth.User y Persona...\n")

    usuarios_con_persona = User.objects.filter(
        profile__persona__isnull=False
    ).select_related('profile__persona')

    total_usuarios = usuarios_con_persona.count()
    
    desincronizados_nombre = 0
    desincronizados_apellido = 0
    desincronizados_email = 0
    
    ejemplos_nombre = []
    ejemplos_apellido = []
    ejemplos_email = []

    for user in usuarios_con_persona:
        persona = user.profile.persona
        
        # Comparar Nombre
        if user.first_name != persona.nombre:
            desincronizados_nombre += 1
            if len(ejemplos_nombre) < 5:
                ejemplos_nombre.append(f"User({user.id}) '{user.first_name}' vs Persona({persona.id}) '{persona.nombre}'")
                
        # Comparar Apellido
        if user.last_name != persona.apellido:
            desincronizados_apellido += 1
            if len(ejemplos_apellido) < 5:
                ejemplos_apellido.append(f"User({user.id}) '{user.last_name}' vs Persona({persona.id}) '{persona.apellido}'")
                
        u_email = (user.email or '').lower().strip()
        p_email = (persona.email or '').lower().strip()
        
        if u_email != p_email:
            desincronizados_email += 1
            if len(ejemplos_email) < 5:
                ejemplos_email.append(f"User({user.id}) '{u_email}' vs Persona({persona.id}) '{p_email}'")

    print("=== RESULTADOS DEL DIAGNÓSTICO P-1 ===")
    print(f"Total de perfiles analizados: {total_usuarios}")
    print("-" * 40)
    print(f"Desincronizados en NOMBRE:   {desincronizados_nombre} ({(desincronizados_nombre/total_usuarios)*100 if total_usuarios else 0:.2f}%)")
    print(f"Desincronizados en APELLIDO: {desincronizados_apellido} ({(desincronizados_apellido/total_usuarios)*100 if total_usuarios else 0:.2f}%)")
    print(f"Desincronizados en EMAIL:    {desincronizados_email} ({(desincronizados_email/total_usuarios)*100 if total_usuarios else 0:.2f}%)")
    print("-" * 40)
    
    if desincronizados_nombre > 0:
        print("\nEjemplos Nombre desincronizado:")
        for ej in ejemplos_nombre:
            print(f"  - {ej}")
            
    if desincronizados_apellido > 0:
        print("\nEjemplos Apellido desincronizado:")
        for ej in ejemplos_apellido:
            print(f"  - {ej}")
            
    if desincronizados_email > 0:
        print("\nEjemplos Email desincronizado:")
        for ej in ejemplos_email:
            print(f"  - {ej}")
            
run_diagnostico()
