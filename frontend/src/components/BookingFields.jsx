import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, SimpleSelect } from "@/components/Field";
import { UniversityPicker } from "@/components/UniversityPicker";
import { MapPicker } from "@/components/MapPicker";
import { TRIP_TYPES, GENDERS, PICKUP_TIMES, formatTime } from "@/lib/constants";

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

export const BookingFields = ({ value, onChange, withStudent }) => {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {withStudent && <StudentInfo value={value} set={set} />}
      <Field label="نوع الرحلة">
        <SimpleSelect value={value.trip_type} onChange={(v) => set({ trip_type: v })} options={toOptions(TRIP_TYPES)} testId="booking-triptype-select" />
      </Field>
      <Field label="التاريخ">
        <Input type="date" className="h-11" value={value.date} onChange={(e) => set({ date: e.target.value })} data-testid="booking-date-input" />
      </Field>
      <Field label="وقت الالتقاط">
        <SimpleSelect value={value.pickup_time} onChange={(v) => set({ pickup_time: v })} options={timeOptions} testId="booking-time-select" />
      </Field>
      <Field label="العنوان / أقرب نقطة دالة">
        <Input className="h-11" value={value.address} onChange={(e) => set({ address: e.target.value })} data-testid="booking-address-input" />
      </Field>
      <Field label="موقع الالتقاط على الخريطة" className="sm:col-span-2">
        <MapPicker value={value.location} onChange={(loc) => set({ location: loc })} />
      </Field>
      <Field label="ملاحظات" className="sm:col-span-2">
        <Textarea value={value.notes} onChange={(e) => set({ notes: e.target.value })} data-testid="booking-notes-input" />
      </Field>
    </div>
  );
};
