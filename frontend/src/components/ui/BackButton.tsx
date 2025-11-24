import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, ButtonProps } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { INSTITUTIONAL_TERRACOTTA, INSTITUTIONAL_TERRACOTTA_DARK } from "@/styles/institutionalColors";

type BackButtonProps = {
  label?: string;
  fallbackPath?: string;
  scope?: "page" | "global";
} & ButtonProps;

export default function BackButton({
  label = "Volver",
  fallbackPath = "/",
  scope = "page",
  sx,
  ...buttonProps
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (fallbackPath) {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant="contained"
      startIcon={<ArrowBackIcon />}
      onClick={handleClick}
      {...buttonProps}
      data-back-button={scope}
      sx={{
        alignSelf: "flex-start",
        textTransform: "none",
        backgroundColor: INSTITUTIONAL_TERRACOTTA,
        "&:hover": {
          backgroundColor: INSTITUTIONAL_TERRACOTTA_DARK,
        },
        mb: 2,
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}
