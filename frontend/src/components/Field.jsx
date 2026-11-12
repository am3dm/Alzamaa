import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Field = ({ label, children, className = "" }) => (
  <div className={`space-y-1.5 ${className}`}>
    <Label className="text-sm font-bold text-slate-700">{label}</Label>
    {children}
  </div>
);

export const SimpleSelect = ({ value, onChange, options, placeholder, testId }) => (
  <Select value={value || undefined} onValueChange={onChange} dir="rtl">
    <SelectTrigger className="h-11 bg-white" data-testid={testId}>
      <SelectValue placeholder={placeholder || "اختر"} />
    </SelectTrigger>
    <SelectContent className="bg-white max-h-72">
      {options.map((o) => (
        <SelectItem key={o.value} value={o.value} data-testid={`${testId}-option-${o.value}`}>{o.label}</SelectItem>
      ))}
    </SelectContent>
  </Select>
);
