import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Button from "@mui/material/Button";

import { PageHero, SectionTitlePill } from "./GradientTitles";

afterEach(() => {
  cleanup();
});

describe("PageHero", () => {
  it("muestra título, subtítulo y acciones", () => {
    render(<PageHero title="Panel Principal" subtitle="Resumen general" actions={<Button>Acción rápida</Button>} />);
    expect(screen.getByText("Panel Principal")).toBeInTheDocument();
    expect(screen.getByText("Resumen general")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acción rápida" })).toBeInTheDocument();
  });
});

describe("SectionTitlePill", () => {
  it("renderiza el título destacado", () => {
    render(<SectionTitlePill title="Sección destacada" />);
    expect(screen.getByText("Sección destacada")).toBeInTheDocument();
  });
});
