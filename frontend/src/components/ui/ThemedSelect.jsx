import { Children, isValidElement } from 'react';
import { SearchableSelect } from '../forms/SearchableSelect';
import { cn } from '../../lib/cn';

// Drop-in for a native <select>: same <option>/<optgroup> children, same onChange(event) with
// event.target.value, but it opens the app's themed pop-up instead of the OS list, so every
// dropdown looks the same. Only layout classes (width, flex, margin, grid span) are kept from
// className; the trigger always uses the shared look.

const LAYOUT_CLASS = /^(?:[a-z0-9-]+:)*(?:w-|min-w-|max-w-|flex-|shrink|grow|basis-|col-span|row-span|-?m[trblxy]?-|self-|order-|hidden$|block$|inline)/;

function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(node.props.children);
  return '';
}

function collectOptions(children, group = '') {
  const options = [];
  Children.toArray(children).forEach((child) => {
    if (!isValidElement(child)) return;
    if (child.type === 'optgroup') {
      options.push(...collectOptions(child.props.children, child.props.label || group));
      return;
    }
    if (child.type === 'option') {
      const label = textOf(child.props.children);
      options.push({
        value: String(child.props.value ?? label),
        label,
        disabled: Boolean(child.props.disabled),
        group
      });
      return;
    }
    // Fragments or wrappers that return options.
    if (child.props?.children) options.push(...collectOptions(child.props.children, group));
  });
  return options;
}

export function ThemedSelect({
  value,
  defaultValue,
  onChange,
  children,
  className = '',
  disabled = false,
  name,
  id,
  placeholder = 'Select…',
  searchable = 'auto',
  'aria-label': ariaLabel,
  title
}) {
  const options = collectOptions(children);
  const classes = String(className).split(/\s+/).filter(Boolean);
  const layout = classes.filter((c) => LAYOUT_CLASS.test(c));
  const large = classes.some((c) => /^(?:[a-z0-9-]+:)?(?:text-sm|text-base|py-2\.5|py-3|h-10|h-11|h-12)$/.test(c));
  const current = value ?? defaultValue ?? '';

  return (
    <SearchableSelect
      id={id}
      aria-label={ariaLabel || title}
      value={String(current)}
      options={options}
      placeholder={placeholder}
      searchable={searchable}
      disabled={disabled}
      className={cn('min-w-[8rem]', layout)}
      triggerClassName={large ? 'py-2.5 text-sm' : ''}
      onChange={(next) => {
        const nextValue = next == null ? '' : String(next);
        const target = { value: nextValue, name };
        onChange?.({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} });
      }}
    />
  );
}
