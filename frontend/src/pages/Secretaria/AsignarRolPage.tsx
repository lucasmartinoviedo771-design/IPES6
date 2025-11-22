import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { listarDocentes, DocenteDTO } from "@/api/docentes";
import { fetchCarreras, Carrera } from "@/api/carreras";
import { useAuth } from "@/context/AuthContext";
import { asignarRolADocente } from "@/api/roles";
import { toast } from "@/utils/toast";
import { PageHero } from "@/components/ui/GradientTitles";

const ALL_ROLES = [
  "admin",
  "secretaria",
  "bedel",
  "jefa_aaee",
  "jefes",
  "tutor",
  "coordinador",
  "consulta",
];

const ROLES_CON_PROFESORADOS = new Set(["bedel", "tutor", "coordinador"]);

const ROLE_ASSIGN_MATRIX: Record<string, string[]> = {
  admin: ALL_ROLES,
  secretaria: ALL_ROLES.filter((role) => role !== "admin"),
  bedel: [],
  jefa_aaee: ["bedel", "tutor", "coordinador"],
  jefes: [],
  tutor: [],
  coordinador: [],
  consulta: [],
};

export default function AsignarRolPage() {
  const { user } = useAuth();
  const [docenteSeleccionado, setDocenteSeleccionado] = useState<DocenteDTO | null>(null);
  const [rolSeleccionado, setRolSeleccionado] = useState<string>("");
  const [profesoradosSeleccionados, setProfesoradosSeleccionados] = useState<number[]>([]);

  const docentesQuery = useQuery({
    queryKey: ["docentes", "listado"],
    queryFn: listarDocentes,
    staleTime: 5 * 60 * 1000,
  });
  const docentes = docentesQuery.data ?? [];

  const profesoradosQuery = useQuery({
    queryKey: ["profesorados", "vigentes"],
    queryFn: fetchCarreras,
    staleTime: 5 * 60 * 1000,
  });
  const profesorados: Carrera[] = profesoradosQuery.data ?? [];

  const userRoles = useMemo(
    () => (user?.roles ?? []).map((role) => role.toLowerCase()),
    [user?.roles],
  );

  const assignableRoles = useMemo(() => {
    if (user?.is_superuser || user?.is_staff) {
      return ALL_ROLES;
    }
    const grantable = new Set<string>();
    userRoles.forEach((role) => {
      ROLE_ASSIGN_MATRIX[role]?.forEach((grant) => grantable.add(grant));
    });
    return ALL_ROLES.filter((role) => grantable.has(role));
  }, [user?.is_staff, user?.is_superuser, userRoles]);

  useEffect(() => {
    if (!assignableRoles.length) {
      setRolSeleccionado("");
      return;
    }
    if (!assignableRoles.includes(rolSeleccionado)) {
      setRolSeleccionado(assignableRoles[0]);
    }
  }, [assignableRoles, rolSeleccionado]);

  const rolRequiereProfesorados = useMemo(
    () => ROLES_CON_PROFESORADOS.has(rolSeleccionado.toLowerCase()),
    [rolSeleccionado],
  );

  useEffect(() => {
    if (!rolRequiereProfesorados) {
      setProfesoradosSeleccionados([]);
    }
  }, [rolRequiereProfesorados]);

  const noAssignableRoles = assignableRoles.length === 0;

  const asignarRolMutation = useMutation({
    mutationFn: async () => {
      if (!docenteSeleccionado || !rolSeleccionado) {
        throw new Error("Se requiere docente y rol.");
      }
      if (rolRequiereProfesorados && profesoradosSeleccionados.length === 0) {
        throw new Error("Seleccioná al menos un profesorado para este rol.");
      }
      return asignarRolADocente(docenteSeleccionado.id, {
        role: rolSeleccionado,
        profesorados: rolRequiereProfesorados ? profesoradosSeleccionados : undefined,
      });
    },
    onSuccess: (data) => {
      toast.success(
        `Se asignó el rol ${data.role} a ${docenteSeleccionado?.apellido}, ${docenteSeleccionado?.nombre}.`,
      );
      if (rolRequiereProfesorados) {
        setProfesoradosSeleccionados(data.profesorados ?? []);
      }
    },
    onError: (error) => {
      let message = "No se pudo asignar el rol.";
      if (error instanceof AxiosError && error.response?.data) {
        const detail = (error.response.data as any)?.detail;
        if (typeof detail === "string") {
          message = detail;
        }
      }
      toast.error(message);
    },
  });

  const asignarDisabled =
    !docenteSeleccionado ||
    !rolSeleccionado ||
    asignarRolMutation.status === "pending" ||
    (rolRequiereProfesorados && profesoradosSeleccionados.length === 0);

  return (
    <Stack gap={3}>
      <PageHero
        title="Asignar Rol"
        subtitle="Gestioná permisos y responsabilidades del personal"
      />
      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1.5}>
          <Autocomplete
            options={docentes}
            value={docenteSeleccionado}
            onChange={(_, value) => setDocenteSeleccionado(value)}
            loading={docentesQuery.isLoading}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(option) => `${option.apellido}, ${option.nombre} (${option.dni})`}
            sx={{ minWidth: 260 }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="Docente"
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {docentesQuery.isLoading ? (
                        <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
                      ) : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
          />
          <TextField
            size="small"
            label="Rol"
            select
            value={rolSeleccionado}
            onChange={(event) => setRolSeleccionado(event.target.value)}
            sx={{ minWidth: 220 }}
            helperText={
              noAssignableRoles
                ? "No tenés permisos para asignar roles."
                : "Elegí el rol que querés otorgar al docente seleccionado."
            }
            disabled={noAssignableRoles}
          >
            {ALL_ROLES.map((role) => (
              <MenuItem key={role} value={role} disabled={!assignableRoles.includes(role)}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          {rolRequiereProfesorados && (
            <Autocomplete
              multiple
              options={profesorados}
              value={profesorados.filter((carrera) =>
                profesoradosSeleccionados.includes(carrera.id),
              )}
              onChange={(_, values) =>
                setProfesoradosSeleccionados(values.map((value) => value.id))
              }
              loading={profesoradosQuery.isLoading}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionLabel={(option) => option.nombre}
              sx={{ minWidth: 260 }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Profesorados"
                  placeholder="Seleccionar profesorados"
                  helperText="Asigná los profesorados que podrá gestionar."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {profesoradosQuery.isLoading ? (
                          <CircularProgress color="inherit" size={18} sx={{ mr: 1 }} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          )}
          <Button
            variant="contained"
            disabled={asignarDisabled}
            onClick={() => asignarRolMutation.mutate()}
          >
            Asignar
          </Button>
        </Stack>
        {docentesQuery.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            No pudimos cargar el listado de docentes. Intentá nuevamente más tarde.
          </Alert>
        )}
        {profesoradosQuery.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            Ocurrió un problema al obtener los profesorados. Intentá más tarde.
          </Alert>
        )}
      </Paper>
    </Stack>
  );
}
