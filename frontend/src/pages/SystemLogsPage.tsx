import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getSystemLogs, resolveSystemLog } from "@/api/system";
import { useState, useMemo } from "react";
import {
    Box, Typography, Card, CardContent, CardActions, Button, Chip, Stack, Alert, Divider
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import FilterListIcon from "@mui/icons-material/FilterList";

export default function SystemLogsPage() {
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<string | null>(null);

    const { data: logs, isLoading } = useQuery({
        queryKey: ["systemLogs"],
        queryFn: () => getSystemLogs(false),
    });

    const resolveMutation = useMutation({
        mutationFn: resolveSystemLog,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["systemLogs"] });
        },
    });

    // Calcular contadores
    const stats = useMemo(() => {
        if (!logs) return { total: 0, byType: {} as Record<string, number> };
        const byType = logs.reduce((acc, log) => {
            acc[log.tipo] = (acc[log.tipo] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        return { total: logs.length, byType };
    }, [logs]);

    // Filtrar logs
    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        if (!filter) return logs;
        return logs.filter(l => l.tipo === filter);
    }, [logs, filter]);

    if (isLoading) return <Typography p={3}>Cargando alertas...</Typography>;

    return (
        <Box p={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" fontWeight="bold">Alertas de Sistema</Typography>
                <Chip
                    label={`Total: ${stats.total}`}
                    color="primary"
                    variant="filled"
                    sx={{ fontWeight: "bold", px: 1 }}
                />
            </Stack>

            {/* Filtros y Contadores */}
            <Box mb={4} sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: 2, border: "1px solid #e2e8f0" }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                    <FilterListIcon color="action" sx={{ mr: 1 }} />
                    <Typography variant="body2" fontWeight="bold" color="text.secondary" sx={{ mr: 2 }}>FILTRAR POR TIPO:</Typography>

                    <Chip
                        label="Todas"
                        onClick={() => setFilter(null)}
                        color={filter === null ? "primary" : "default"}
                        variant={filter === null ? "filled" : "outlined"}
                        clickable
                    />

                    {Object.entries(stats.byType).map(([tipo, count]) => (
                        <Chip
                            key={tipo}
                            label={`${tipo} (${count})`}
                            onClick={() => setFilter(tipo)}
                            color={filter === tipo ? "primary" : "default"}
                            variant={filter === tipo ? "filled" : "outlined"}
                            clickable
                        />
                    ))}
                </Stack>
            </Box>

            {filteredLogs.length === 0 ? (
                <Alert severity="success" icon={<CheckCircleIcon fontSize="inherit" />}>
                    {filter
                        ? `No hay alertas de tipo "${filter}".`
                        : "No hay alertas pendientes. Todo parece estar sincronizado."
                    }
                </Alert>
            ) : (
                <Stack spacing={2}>
                    {filteredLogs.map((log) => (
                        <Card key={log.id} sx={{ borderLeft: "6px solid #ed6c02", boxShadow: 2 }}>
                            <CardContent>
                                <Stack direction="row" spacing={1} mb={2} alignItems="center" justifyContent="space-between">
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <WarningIcon color="warning" />
                                        <Typography variant="subtitle1" fontWeight="bold">
                                            {log.tipo}
                                        </Typography>
                                    </Stack>
                                    <Chip label={new Date(log.created_at).toLocaleString()} size="small" variant="outlined" />
                                </Stack>
                                <Typography variant="body1" mb={2} sx={{ whiteSpace: "pre-wrap", fontWeight: 500 }}>
                                    {log.mensaje}
                                </Typography>

                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                    <Box sx={{ bgcolor: "#f1f5f9", p: 2, borderRadius: 1, border: "1px solid #cbd5e1" }}>
                                        <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={0.5}>DATOS TÉCNICOS:</Typography>
                                        <pre style={{ margin: 0, fontSize: "0.75rem", fontFamily: "monospace", overflowX: "auto" }}>
                                            {JSON.stringify(log.metadata, null, 2)}
                                        </pre>
                                    </Box>
                                )}
                            </CardContent>
                            <Divider />
                            <CardActions sx={{ justifyContent: "flex-end", px: 2, py: 1.5 }}>
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    onClick={() => resolveMutation.mutate(log.id)}
                                    disabled={resolveMutation.isPending}
                                    startIcon={!resolveMutation.isPending && <CheckCircleIcon />}
                                >
                                    {resolveMutation.isPending ? "Procesando..." : "Resolver"}
                                </Button>
                            </CardActions>
                        </Card>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
