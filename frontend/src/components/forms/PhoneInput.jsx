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
  defaultDialCode = '91',
  compact = false
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
        inputClass={cn(
          'form-control !w-full !rounded-[var(--radius-input,0.625rem)] !border-[var(--input-border)] !bg-[var(--surface)] !px-3.5 !py-2 !text-xs !font-medium !text-[var(--text-main)] !outline-none !transition focus:!border-[var(--primary)] focus:!ring-2 focus:!ring-[var(--primary-subtle)] !pl-[48px] !h-auto shadow-2xs',
          compact && '!py-1.5'
        )}
        buttonClass="!border-none !bg-transparent !rounded-l-xl hover:!bg-transparent !w-[44px] !pl-2 cursor-pointer"
        dropdownClass="!shadow-[var(--shadow-modal)] !rounded-2xl !border-[var(--border-glass)] !bg-[var(--surface)] !text-[var(--text-main)]"
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
          border-radius: 1rem !important;
          width: 100cqi;
          background-color: var(--surface) !important;
          border: 1px solid var(--border-glass) !important;
          box-shadow: var(--shadow-modal) !important;
          color: var(--text-main) !important;
          overflow-y: auto;
          overflow-x: hidden;
          max-height: 300px;
        }
        .phone-input-wrapper .react-tel-input .country-list .search {
          padding: 8px !important;
          background-color: var(--surface) !important;
          width: 100% !important;
          box-sizing: border-box !important;
          border-bottom: 1px solid var(--border) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list input.custom-search-input,
        .phone-input-wrapper .react-tel-input .country-list input.search-box {
          width: 100% !important;
          box-sizing: border-box !important;
          margin: 0 !important;
          padding: 8px 14px 8px 34px !important;
          border: 1px solid var(--border) !important;
          border-radius: 0.75rem !important;
          font-size: 12px !important;
          line-height: 18px !important;
          background-color: var(--input-bg) !important;
          background-image: ${searchIconSvg} !important;
          background-size: 14px 14px !important;
          background-repeat: no-repeat !important;
          background-position: 10px center !important;
          outline: none !important;
          display: block !important;
          color: var(--text-main) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list input.custom-search-input:focus,
        .phone-input-wrapper .react-tel-input .country-list input.search-box:focus {
          border-color: var(--primary) !important;
          box-shadow: none !important;
        }
        .phone-input-wrapper .react-tel-input .country-list .country {
          padding: 8px 12px;
          display: flex;
          align-items: center;
          font-size: 13px;
          color: var(--text-main) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list .country .dial-code {
          color: var(--text-muted) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list .country:hover {
          background-color: var(--hover-bg) !important;
        }
        .phone-input-wrapper .react-tel-input .country-list .country.highlight {
          background-color: var(--primary-subtle) !important;
          color: var(--primary) !important;
        }
      `}</style>
    </div>
  );
}
