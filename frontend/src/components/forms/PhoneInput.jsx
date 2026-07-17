import { useEffect, useMemo, useState } from 'react';
import ReactPhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { cn } from '../../lib/cn';

export function PhoneInput({
  name,
  value = '',
  onChange,
  onCountryChange,
  placeholder,
  className,
  required,
  defaultCountry = 'in',
  defaultDialCode = '91'
}) {
  const [activeDialCode, setActiveDialCode] = useState(defaultDialCode);

  useEffect(() => {
    setActiveDialCode(defaultDialCode);
  }, [defaultDialCode, defaultCountry]);

  const normalizeDigits = (phoneValue) => String(phoneValue || '').replace(/\D/g, '');
  const formatStorageValue = (phoneValue, fallbackDialCode) => {
    const raw = String(phoneValue || '').trim();
    if (!raw) {
      const dial = String(fallbackDialCode || '').replace(/\D/g, '');
      return dial ? `+${dial}` : '';
    }
    if (raw.startsWith('+')) return raw;
    const digits = normalizeDigits(raw);
    return digits ? `+${digits}` : raw;
  };

  const handlePhoneChange = (phoneValue, country, event, formattedValue) => {
    const dialCode = String(country?.dialCode || activeDialCode || defaultDialCode || '').replace(/\D/g, '');
    const nextValue = normalizeDigits(phoneValue);
    const finalValue = formatStorageValue(formattedValue || nextValue || dialCode, dialCode);

    if (country?.dialCode) {
      setActiveDialCode(String(country.dialCode).replace(/\D/g, ''));
    }

    if (onChange) {
      onChange({ target: { name, value: finalValue } });
    }
    if (onCountryChange) {
      onCountryChange(country || null, {
        value: finalValue,
        formattedValue: formattedValue || phoneValue,
        event
      });
    }
  };

  const handleMount = (value, country) => {
    if (country?.dialCode) {
      setActiveDialCode(String(country.dialCode).replace(/\D/g, ''));
    }
  };

  // SVG string for a nice Lucide-like search icon
  const searchIconSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'%3E%3C/circle%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'%3E%3C/line%3E%3C/svg%3E")`;

  const inputPropsMemo = useMemo(() => ({
    name: name,
    required: required,
  }), [name, required]);

  return (
    <div className={cn("phone-input-wrapper w-full relative", className)}>
      <ReactPhoneInput
        country={defaultCountry}
        value={normalizeDigits(value) || activeDialCode || defaultDialCode}
        onChange={handlePhoneChange}
        onMount={handleMount}
        disableInitialCountryGuess={false}
        enableSearch={true}
        disableSearchIcon={true}
        disableCountryCode={false}
        countryCodeEditable={false}
        prefix="+"
        searchPlaceholder="Search country..."
        placeholder={placeholder || 'Phone number'}
        inputProps={inputPropsMemo}
        containerClass="w-full"
        inputClass="form-control !w-full !rounded-[var(--radius-input,0.75rem)] !border-[color:var(--border)] !bg-[color:var(--surface)] !px-4 !py-3 !text-sm !text-[color:var(--text-main)] !outline-none !transition focus:!border-[color:var(--accent)] focus:!ring-2 focus:!ring-[color:color-mix(in_srgb,var(--accent)_20%,transparent)] !pl-[48px] !h-auto"
        buttonClass="!border-none !bg-transparent !rounded-l-[var(--radius-input,0.75rem)] hover:!bg-transparent !w-[44px] !pl-2"
        dropdownClass="!shadow-[0_12px_40px_rgba(0,0,0,0.12)] !rounded-[var(--radius-card,1rem)] !border-[color:var(--border)]"
        searchClass="custom-search-input"
      />
      <style>{`
        .phone-input-wrapper {
          container-type: inline-size;
        }
        .phone-input-wrapper .react-tel-input .flag-dropdown {
          border: none !important;
        }
        .phone-input-wrapper .react-tel-input .selected-flag {
          width: 48px !important;
          padding-left: 12px !important;
          background: transparent !important;
        }
        .phone-input-wrapper .react-tel-input .selected-flag .flag {
          transform: scale(1.05);
        }
        .phone-input-wrapper .react-tel-input .flag-dropdown.open {
          z-index: 9999;
          background: transparent !important;
        }
        .phone-input-wrapper .react-tel-input .selected-flag:hover, 
        .phone-input-wrapper .react-tel-input .selected-flag:focus {
          background-color: transparent;
        }
        .phone-input-wrapper .react-tel-input .country-list {
          z-index: 9999;
          margin-top: 6px;
          border-radius: var(--radius-card, 1rem);
          width: 100cqi;
          border-color: var(--border);
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          overflow-y: auto;
          overflow-x: hidden;
          max-height: 300px; /* Ensure there is a max-height so it scrolls */
        }

        .phone-input-wrapper .react-tel-input .country-list .search {
          padding: 8px !important;
          background-color: #fff !important;
          width: 100% !important;
          box-sizing: border-box !important;
          border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list input.custom-search-input,
        .phone-input-wrapper .react-tel-input .country-list input.search-box {
          width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 10px 16px 10px 36px !important;
          border: 1px solid var(--border) !important;
          border-radius: var(--radius-input, 0.75rem) !important;
          font-size: 14px !important;
          line-height: 20px !important;
          background-color: var(--surface, #fff) !important;
          background-image: ${searchIconSvg} !important;
          background-size: 14px 14px !important;
          background-repeat: no-repeat !important;
          background-position: 12px center !important;
          outline: none !important;
          display: block !important;
          color: var(--text-main) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list input.custom-search-input:focus,
        .phone-input-wrapper .react-tel-input .country-list input.search-box:focus {
          border-color: var(--border) !important;
          box-shadow: none !important;
        }
        .phone-input-wrapper .react-tel-input .country-list .country {
          padding: 8px 12px;
          display: flex;
          align-items: center;
          font-size: 14px;
        }
        .phone-input-wrapper .react-tel-input .country-list .country:hover {
          background-color: color-mix(in srgb, var(--primary) 5%, transparent);
        }
        .phone-input-wrapper .react-tel-input .country-list .country.highlight {
          background-color: color-mix(in srgb, var(--primary) 8%, transparent);
        }
      `}</style>
    </div>
  );
}
