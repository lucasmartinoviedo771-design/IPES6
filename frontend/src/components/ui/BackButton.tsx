import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Button, ButtonProps } from "@mui/material";
import { useNavigate } from "react-router-dom";

type BackButtonProps = {
  label?: string;
  fallbackPath?: string;
} & ButtonProps;

export default function BackButton({
  label = "Volver",
  fallbackPath = "/",
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
      color="inherit"
      startIcon={<ArrowBackIcon />}
      onClick={handleClick}
      {...buttonProps}
      sx={{
        alignSelf: "flex-start",
        textTransform: "none",
        ...sx,
      }}
    >
      {label}
    </Button>
  );
}
