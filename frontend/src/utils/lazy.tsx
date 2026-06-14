
import { ComponentType, Suspense, lazy } from "react";

const SuspenseFallback = (
  <div style={{ padding: 32, textAlign: "center", color: "#666" }}>
    Cargando...
  </div>
);

export const lazyPage = <P extends object>(importer: () => Promise<unknown>) => {
  const Component = lazy(async () => {
    try {
      const module = (await importer()) as Record<string, unknown>;

      // Buscador agresivo de componente (Double Default fix para Rolldown/Vite 8)
      const comp1 = module.default || module;
      const comp2 = (comp1 && typeof comp1 === 'object' && 'default' in comp1)
        ? (comp1 as Record<string, unknown>).default
        : comp1;
      const comp3 = (comp2 && typeof comp2 === 'object' && 'default' in comp2)
        ? (comp2 as Record<string, unknown>).default
        : comp2;

      return { default: comp3 as ComponentType<P> };
    } catch (err) {
      void 0;
      throw err;
    }
  });

  const LazyPageWrapper = (props: P) => {
    const ComponentCast = Component as unknown as ComponentType<P>;
    return (
      <Suspense fallback={SuspenseFallback}>
        <ComponentCast {...props} />
      </Suspense>
    );
  };
  LazyPageWrapper.displayName = "LazyPageWrapper";

  return LazyPageWrapper;
};
