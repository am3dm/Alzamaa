import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, SimpleSelect } from "@/components/Field";
import { UniversityPicker } from "@/components/UniversityPicker";
import { MapPicker } from "@/components/MapPicker";
import { TRIP_TYPES, GENDERS, PICKUP_TIMES, LEG_LABELS, formatTime } from "@/lib/constants";

const toOptions = (obj) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const timeOptions = PICKUP_TIMES.map((t) => ({ value: t, label: formatTime(t) }));

const StudentInfo = ({ value, set }) => (
  <>
    <Field label="اسم الطالب الكامل">
      <Input className="h-11" value={value.student_name} onChange={(e) => set({ student_name: e.target.value })} data-testid="booking-name-input" />
    </Field>
    <Field label="رقم الهاتف">
      <Input className="h-11" dir="ltr" value={value.phone} onChange={(e) => set({ phone: e.target.value })} data-testid="booking-phone-input" />
    </Field>
    <Field label="الجنس">
      <SimpleSelect value={value.gender} onChange={(v) => set({ gender: v })} options={toOptions(GENDERS)} testId="booking-gender-select" />
    </Field>
    <Field label="الجامعة">
      <UniversityPicker value={value.university} onChange={(v) => set({ university: v })} />
    </Field>
  </>
);

export const BookingFields = ({ value, onChange, withStudent, showSave }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  const leg = LEG_LABELS[value.trip_type] || LEG_LABELS.go;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {withStudent && <StudentInfo value={value} set={set} />}
      <Field label="نوع الرحلة">
        <SimpleSelect value={value.trip_type} onChange={(v) => set(
          (value.trip_type === "return") !== (v === "return")
            ? { trip_type: v, location: value.dropoff_location, address: value.dropoff_address || "", dropoff_location: value.location, dropoff_address: value.address || "" }
            : { trip_type: v },
        )} options={toOptions(TRIP_TYPES)} testId="booking-triptype-select" />
      </Field>
      <Field label="التاريخ">
        <Input type="date" className="h-11" value={value.date} onChange={(e) => set({ date: e.target.value })} data-testid="booking-date-input" />
      </Field>
      <Field label={value.trip_type === "round" ? "وقت الالتقاط — الذهاب (من بلد)" : "وقت الالتقاط"} className={value.trip_type === "round" ? "" : "sm:col-span-2"}>
        <SimpleSelect value={value.pickup_time} onChange={(v) => set({ pickup_time: v })} options={timeOptions} testId="booking-time-select" />
      </Field>
      {value.trip_type === "round" && (
        <Field label="وقت الالتقاط — الإياب (من بغداد)">
          <SimpleSelect value={value.return_pickup_time} onChange={(v) => set({ return_pickup_time: v })} options={timeOptions} placeholder="اختر وقت الإياب" testId="booking-return-time-select" />
        </Field>
      )}
      <div className="sm:col-span-2 rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3" data-testid="booking-pickup-section">
        <div className="flex items-center gap-2 font-bold text-primary"><span className="h-3 w-3 rounded-full bg-primary" /> {leg.pickup}</div>
        <Input className="h-11 bg-white" placeholder="العنوان / أقرب نقطة دالة" value={value.address} onChange={(e) => set({ address: e.target.value })} data-testid="booking-address-input" />
        <MapPicker key={`p-${value.trip_type}`} value={value.location} onChange={(loc) => set({ location: loc })} center={leg.pc} testPrefix="pickup-map" hint="اضغط على الخريطة لتحديد مكان الالتقاط" />
      </div>
      <div className="sm:col-span-2 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3" data-testid="booking-dropoff-section">
        <div className="flex items-center gap-2 font-bold text-emerald-700"><span className="h-3 w-3 rounded-full bg-emerald-600" /> {leg.dropoff}</div>
        <Input className="h-11 bg-white" placeholder="مثال: بوابة الجامعة / المنطقة" value={value.dropoff_address || ""} onChange={(e) => set({ dropoff_address: e.target.value })} data-testid="booking-dropoff-address-input" />
        <MapPicker key={`d-${value.trip_type}`} value={value.dropoff_location} onChange={(loc) => set({ dropoff_location: loc })} center={leg.dc} color="#059669" testPrefix="dropoff-map" hint="اضغط على الخريطة لتحديد مكان الوصول" />
      </div>
      {showSave && (
        <label className="sm:col-span-2 flex items-center gap-2 text-sm cursor-pointer" data-testid="booking-save-places">
          <Checkbox checked={!!value.save_places} onCheckedChange={(c) => set({ save_places: !!c })} data-testid="booking-save-places-checkbox" />
          حفظ هاتين النقطتين كعنوان السكن (بلد) والجامعة (بغداد) لتظهرا تلقائياً في الحجوزات القادمة
        </label>
      )}
      <Field label="ملاحظات" className="sm:col-span-2">
        <Textarea value={value.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="booking-notes-input" />
      </Field>
    </div>
  );
};
