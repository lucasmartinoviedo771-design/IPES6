
import { Suspense, lazy } from "react";

const SuspenseFallback = (
  <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
    Cargando...
  </div>
);

export const lazyPage = (importer: () => Promise<any>) => {
  const Component = lazy(async () => {
    try {
      const module = await importer();
      console.log('[Lazy] Módulo crudo keys:', Object.keys(module));
      
      // Buscador agresivo de componente
      let comp = module.default || module;
      
      // Si sigue siendo un objeto y tiene default, bajamos un nivel más (Double Default fix)
      if (comp && typeof comp === 'object' && comp.default) {
        comp = comp.default;
      }

      // Si llegamos a algo que no es función/clase, pero es un objeto con __esModule...
      if (typeof comp !== 'function' && comp && comp.default) {
        comp = comp.default;
      }

      console.log('[Lazy] Componente detectado tipo:', typeof comp);

      if (typeof comp !== 'function') {
        console.error('[Lazy] No se encontró una función de componente válida en:', module);
      }

      return { default: comp };
    } catch (err) {
      console.error('[Lazy] Error fatal cargando módulo:', err);
      throw err;
    }
  });

  return (props: any) => (
    <Suspense fallback={SuspenseFallback}>
      <Component {...props} />
    </Suspense>
  );
};
