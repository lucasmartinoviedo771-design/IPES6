from django.contrib.auth.models import User
from core.models import Persona, Estudiante

def run_diagnostico():
    print("\nIniciando diagnóstico de sincronización entre auth.User y Persona (TODOS LOS CAMINOS)...\n")

    # Camino 1: Estudiantes
    estudiantes = Estudiante.objects.filter(
        user__isnull=False, persona__isnull=False
    ).select_related('user', 'persona')

    # Camino 2: Staff / Perfiles
    perfiles = User.objects.filter(
        profile__persona__isnull=False
    ).select_related('profile__persona')

    # Usamos un conjunto para no contar dos veces si alguien tiene ambos caminos
    analizados_ids = set()
    
    desincronizados_nombre = 0
    desincronizados_apellido = 0
    desincronizados_email = 0
    
    ejemplos_nombre = []
    ejemplos_apellido = []
    ejemplos_email = []
    
    def analizar_par(user, persona, camino_desc):
        nonlocal desincronizados_nombre, desincronizados_apellido, desincronizados_email
        
        if user.id in analizados_ids:
            return
        analizados_ids.add(user.id)
        
        # Comparar Nombre
        if user.first_name != persona.nombre:
            desincronizados_nombre += 1
            if len(ejemplos_nombre) < 5:
                ejemplos_nombre.append(f"[{camino_desc}] User({user.id}) '{user.first_name}' vs Persona({persona.id}) '{persona.nombre}'")
                
        # Comparar Apellido
        if user.last_name != persona.apellido:
            desincronizados_apellido += 1
            if len(ejemplos_apellido) < 5:
                ejemplos_apellido.append(f"[{camino_desc}] User({user.id}) '{user.last_name}' vs Persona({persona.id}) '{persona.apellido}'")
                
        u_email = (user.email or '').lower().strip()
        p_email = (persona.email or '').lower().strip()
        
        if u_email != p_email:
            desincronizados_email += 1
            if len(ejemplos_email) < 5:
                ejemplos_email.append(f"[{camino_desc}] User({user.id}) '{u_email}' vs Persona({persona.id}) '{p_email}'")

    for est in estudiantes:
        analizar_par(est.user, est.persona, "Estudiante")

    for u in perfiles:
        analizar_par(u, u.profile.persona, "UserProfile")

    total_usuarios = len(analizados_ids)

    print("=== RESULTADOS DEL DIAGNÓSTICO P-1 (ACTUALIZADO) ===")
    print(f"Total de perfiles analizados únicos: {total_usuarios}")
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
