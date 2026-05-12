import { type DropdownOption } from '../types';

export const resolveSlotProps = <
  TSlotProps extends Record<string, any>,
  TOwnerState = any,
>(
  userSlotProps: TSlotProps | ((ownerState: TOwnerState) => TSlotProps) | undefined,
  defaultProps: Partial<TSlotProps> | null,
  ownerState: TOwnerState,
): TSlotProps => {
  const resolvedUserProps =
    typeof userSlotProps === 'function'
      ? userSlotProps(ownerState)
      : userSlotProps ?? ({} as TSlotProps);

  const mergedSx = [
    ...(defaultProps?.sx
      ? Array.isArray(defaultProps.sx)
        ? defaultProps.sx
        : [defaultProps.sx]
      : []),
    ...(resolvedUserProps?.sx
      ? Array.isArray(resolvedUserProps.sx)
        ? resolvedUserProps.sx
        : [resolvedUserProps.sx]
      : []),
  ];

  return {
    ...defaultProps,
    ...resolvedUserProps,
    ...(mergedSx.length > 0 ? { sx: mergedSx } : {}),
  } as TSlotProps;
};

export const parseFromValuesOrFunc = <T, U>(
  fn: ((arg: U) => T) | T | undefined,
  arg: U,
): T | undefined => (fn instanceof Function ? fn(arg) : fn);

export const getValueAndLabel = (
  option?: DropdownOption | null,
): { label: string; value: string } => {
  let label: string = '';
  let value: string = '';
  if (option) {
    if (typeof option !== 'object') {
      label = option;
      value = option;
    } else {
      label = option.label ?? option.value;
      value = option.value ?? label;
    }
  }
  return { label, value };
};
