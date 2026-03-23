
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

      // Buscador agresivo de componente (Double Default fix para Rolldown/Vite 8)
      let comp = module.default || module;

      if (comp && typeof comp === 'object' && comp.default) {
        comp = comp.default;
      }

      if (typeof comp !== 'function' && comp && comp.default) {
        comp = comp.default;
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
