import { type MutableRefObject, type Ref, type RefCallback } from 'react';
import { type DropdownOption } from '../types';

//A plain function (not a component/hook), so React Compiler doesn't apply Rules-of-React
//analysis to its internals - lets it safely write to whatever ref it's given, including one
//reached through a consumer-supplied props object, without the compiler flagging the mutation.
export const mergeRefs =
  <T,>(...refs: Array<Ref<T> | undefined>): RefCallback<T> =>
  (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') {
        ref(node);
      } else if (ref) {
        (ref as MutableRefObject<T | null>).current = node;
      }
    }
  };

//Same rationale as mergeRefs - writing into a shared ref map (e.g. table.refs.editInputRefs)
//from inside a component gets flagged as mutating a hook-returned value, since React Compiler's
//ref allowance only covers a direct `ref.current = x` assignment made locally, not one reached
//through an object handed down from elsewhere. A plain external function sidesteps that.
export const setRefMapEntry = <T,>(
  refMap:
    | MutableRefObject<Record<string, T> | null | undefined>
    | undefined,
  key: string,
  value: T,
) => {
  if (refMap?.current) refMap.current[key] = value;
};

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
