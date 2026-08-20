import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type React from "react";

import { formatRange, type Ventana } from "./constants";

type SummaryItem = {
	key: string;
	label: string;
	reference?: Ventana;
	state: { label: string; color: "default" | "success" | "warning" };
};

type Props = {
	summaryItems: SummaryItem[];
	onItemClick: (typeKey: string) => void;
};

const SummaryGrid: React.FC<Props> = ({ summaryItems, onItemClick }) => {
	return (
		<Box sx={{ mb: 4 }}>
			<Grid container spacing={2}>
				{summaryItems.map((item) => {
					const isGestion =
						item.key === "MATERIAS_GESTION" || item.key === "COMISION_GESTION";

					return (
						<Grid item xs={12} sm={6} md={4} key={item.key}>
							<ButtonBase
								onClick={() => onItemClick(item.key)}
								sx={{
									width: "100%",
									textAlign: "left",
									borderRadius: 2,
									border: "1.5px solid",
									borderColor: isGestion ? "#ea580c" : "divider",
									backgroundColor: isGestion ? "#fff7ed" : "#ffffff",
									p: 2,
									transition: "all .15s ease",
									"&:hover": {
										borderColor: isGestion ? "#c2410c" : "primary.main",
										boxShadow: isGestion
											? "rgba(234, 88, 12, 0.25) 0px 0px 0px 3px"
											: (theme) =>
													`${theme.palette.primary.main}33 0px 0px 0px 2px`,
									},
								}}
							>
								<Stack spacing={1} sx={{ width: "100%" }}>
									<Stack
										direction="row"
										justifyContent="space-between"
										alignItems="center"
									>
										<Typography
											variant="subtitle1"
											fontWeight={800}
											sx={{ color: isGestion ? "#c2410c" : "inherit" }}
										>
											{item.label}
										</Typography>
									</Stack>

									<Typography variant="body2" color="text.secondary">
										{item.reference
											? formatRange(item.reference)
											: "Sin períodos cargados"}
									</Typography>
									<Stack
										direction="row"
										spacing={1}
										alignItems="center"
										flexWrap="wrap"
										gap={0.5}
									>
										{isGestion && (
											<Chip
												size="small"
												label="USO INTERNO"
												sx={{
													backgroundColor: "#ea580c",
													color: "#ffffff",
													fontWeight: 700,
													fontSize: "0.7rem",
												}}
											/>
										)}
										<Chip
											size="small"
											label={item.state.label}
											color={item.state.color}
										/>
										{item.reference?.activo && (
											<Chip size="small" label="Habilitado" color="success" />
										)}
									</Stack>
								</Stack>
							</ButtonBase>
						</Grid>
					);
				})}
			</Grid>
		</Box>
	);
};

export default SummaryGrid;
