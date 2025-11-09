import { Controller, useFormContext } from "react-hook-form";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs, { type Dayjs } from "dayjs";

export default function RHFDate({
  name,
  label,
  minDate,
  maxDate,
}: {
  name: string;
  label: string;
  minDate?: Dayjs | null;
  maxDate?: Dayjs | null;
}) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <DatePicker
          label={label}
          format="DD/MM/YYYY"
          value={field.value ? dayjs(field.value) : null}         // <<--- siempre Dayjs
          onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
          minDate={minDate ?? undefined}
          maxDate={maxDate ?? undefined}
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!fieldState.error,
              helperText: fieldState.error?.message,
            },
          }}
        />
      )}
    />
  );
}
