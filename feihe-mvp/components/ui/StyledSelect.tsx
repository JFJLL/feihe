'use client';

import React, { useState, useMemo, isValidElement, Fragment } from 'react';
import { CustomSelect, SelectOption } from './CustomSelect';

export interface SelectChangeEvent {
  target: { value: string; name?: string; id?: string };
  currentTarget: { value: string; name?: string; id?: string };
  value: string;
  preventDefault: () => void;
  stopPropagation: () => void;
}

export interface StyledSelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (e: SelectChangeEvent) => void;
  onValueChange?: (val: string) => void;
  options?: (string | SelectOption)[];
  children?: React.ReactNode;
  placeholder?: string;
  ariaLabel?: string;
  'aria-label'?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  required?: boolean;
  className?: string;
  style?: React.CSSProperties;
  align?: 'left' | 'right';
  defaultOpen?: boolean;
}

function parseChildrenToOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  type OptionProps = { children?: React.ReactNode; value?: string | number; label?: string; disabled?: boolean };

  const extractText = (node: React.ReactNode): string => {
    if (node === null || node === undefined || typeof node === 'boolean') return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (React.isValidElement<OptionProps>(node)) {
      return extractText(node.props.children);
    }
    return '';
  };

  const traverse = (node: React.ReactNode, currentGroup?: string, groupDisabled = false) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((child) => traverse(child, currentGroup, groupDisabled));
      return;
    }
    if (!isValidElement<OptionProps>(node)) return;

    if (node.type === Fragment) {
      traverse(node.props.children, currentGroup, groupDisabled);
      return;
    }

    if (node.type === 'optgroup') {
      traverse(node.props.children, node.props.label || '', groupDisabled || Boolean(node.props.disabled));
      return;
    }

    if (node.type === 'option') {
      const props = node.props;
      const rawVal = props.value !== undefined ? props.value : extractText(props.children);
      const value = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
      const text = extractText(props.children) || value;
      options.push({
        value,
        label: text,
        disabled: groupDisabled || Boolean(props.disabled),
        group: currentGroup,
      });
    }
  };

  traverse(children);
  return options;
}

export function StyledSelect({
  value: controlledValue,
  defaultValue,
  onChange,
  onValueChange,
  options: explicitOptions,
  children,
  placeholder = '请选择',
  ariaLabel,
  'aria-label': ariaLabelAttr,
  disabled = false,
  name,
  id,
  required = false,
  className = '',
  style,
  align,
  defaultOpen = false,
}: StyledSelectProps) {
  const parsedOptions = useMemo(() => {
    if (children) {
      return parseChildrenToOptions(children);
    }
    if (explicitOptions) {
      return explicitOptions.map((o) =>
        typeof o === 'string' ? { value: o, label: o } : { ...o, value: String(o.value) }
      );
    }
    return [];
  }, [children, explicitOptions]);

  const [uncontrolledValue, setUncontrolledValue] = useState<string>(() => {
    if (defaultValue !== undefined && defaultValue !== null) return String(defaultValue);
    if (parsedOptions.length > 0 && controlledValue === undefined) {
      return parsedOptions.find(option => !option.disabled)?.value || '';
    }
    return '';
  });

  const effectiveValue = controlledValue !== undefined && controlledValue !== null
    ? String(controlledValue)
    : uncontrolledValue;

  const handleChange = (nextVal: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(nextVal);
    }
    onValueChange?.(nextVal);
    if (onChange) {
      const syntheticEvent: SelectChangeEvent = {
        target: { value: nextVal, name: name || '', id: id || '' },
        currentTarget: { value: nextVal, name: name || '', id: id || '' },
        value: nextVal,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onChange(syntheticEvent);
    }
  };

  return (
    <CustomSelect
      value={effectiveValue}
      defaultValue={defaultValue ?? parsedOptions.find(option => !option.disabled)?.value ?? ''}
      onChange={handleChange}
      options={parsedOptions}
      placeholder={placeholder}
      ariaLabel={ariaLabel || ariaLabelAttr}
      disabled={disabled}
      defaultOpen={defaultOpen}
      className={className}
      style={style}
      name={name}
      id={id}
      required={required}
      align={align}
    />
  );
}

export default StyledSelect;
