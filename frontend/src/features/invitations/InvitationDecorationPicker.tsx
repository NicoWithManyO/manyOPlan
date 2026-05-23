import { useId } from "react";
import { Input } from "../../components/ui/Input";
import type { InvitationDecoration } from "../../types/models";
import { cn } from "../../utils/cn";
import { DECORATION_LOGO, DECORATION_TEXT, DECORATION_TEXT_MAX } from "./utils";

interface Props {
  value: InvitationDecoration;
  onChange: (next: InvitationDecoration) => void;
  hasOrgLogo: boolean;
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}

function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-gray-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-gray-300"
        />
        <span className="font-mono text-xs text-gray-500">{value}</span>
      </div>
    </div>
  );
}

interface OptionProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
}

function DecorationOption({ selected, onSelect, label }: OptionProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs",
        selected
          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
          : "border-gray-200 text-gray-600 hover:bg-gray-50",
      )}
    >
      <input
        type="radio"
        className="hidden"
        checked={selected}
        onChange={onSelect}
      />
      {label}
    </label>
  );
}

export function InvitationDecorationPicker({ value, onChange, hasOrgLogo }: Props) {
  const baseId = useId();
  const isText = value.decoration_type === DECORATION_TEXT;

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium text-gray-700">Décoration du QR code</p>
      <div className="flex flex-wrap gap-2">
        <DecorationOption
          selected={!isText}
          onSelect={() => onChange({ ...value, decoration_type: DECORATION_LOGO })}
          label="Logo de l'association"
        />
        <DecorationOption
          selected={isText}
          onSelect={() => onChange({ ...value, decoration_type: DECORATION_TEXT })}
          label="Texte personnalisé"
        />
      </div>
      {!isText && !hasOrgLogo && (
        <p className="text-xs text-amber-600">
          L'association n'a pas de logo : le QR sera affiché sans décoration.
        </p>
      )}
      {isText && (
        <div className="space-y-2 pt-1">
          <Input
            id={`${baseId}-text`}
            label={`Texte (${DECORATION_TEXT_MAX} caractères max)`}
            placeholder="Ex : FEST"
            value={value.decoration_text}
            maxLength={DECORATION_TEXT_MAX}
            onChange={(e) =>
              onChange({ ...value, decoration_text: e.target.value })
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <ColorField
              id={`${baseId}-bg`}
              label="Couleur de fond"
              value={value.decoration_bg_color}
              onChange={(next) =>
                onChange({ ...value, decoration_bg_color: next })
              }
            />
            <ColorField
              id={`${baseId}-fg`}
              label="Couleur du texte"
              value={value.decoration_text_color}
              onChange={(next) =>
                onChange({ ...value, decoration_text_color: next })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
