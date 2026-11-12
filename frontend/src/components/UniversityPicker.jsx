import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/Field";
import { api } from "@/lib/api";

export const useUniversities = () =>
  useQuery({ queryKey: ["universities"], queryFn: () => api.get("/universities").then((r) => r.data) });

export const UniversityPicker = ({ value, onChange, allowNew = true }) => {
  const { data = [] } = useUniversities();
  const [custom, setCustom] = useState(false);
  const options = data.map((u) => ({ value: u.name, label: u.name }));
  return (
    <div className="flex gap-2">
      <div className="flex-1">
        {custom ? (
          <Input className="h-11" value={value} onChange={(e) => onChange(e.target.value)} placeholder="اسم الجامعة الجديدة" data-testid="university-new-input" />
        ) : (
          <SimpleSelect value={value} onChange={onChange} options={options} placeholder="اختر الجامعة" testId="university-select" />
        )}
      </div>
      {allowNew && (
        <Button type="button" variant="outline" className="h-11" onClick={() => { setCustom(!custom); onChange(""); }} data-testid="university-toggle-new">
          {custom ? <List className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {custom ? "القائمة" : "جديد"}
        </Button>
      )}
    </div>
  );
};
